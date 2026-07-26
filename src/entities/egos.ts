/**
 * E.G.O · 거울 던전 구성 · 데이터셋 스탬프.
 *
 * 정본 배정(ADR-04 2.1)  limbus-assets
 *   E.G.O 의 저항·침식·보유 상태·추출 정보와 거울 던전 은총이 여기에만 있다.
 * 허용 보강  limbus-data-mj — 한국어 E.G.O 명
 */
import { readJson, readJsonDir, toRecords, listJsonNames } from '../io.js';
import { stripMarkup, toDisplay, toIsoDate, lookupTerm } from '../text.js';
import type { Ctx } from './basics.js';

const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'] as const;

interface AssetEgo {
	sinnerId: number;
	rank: string;
	season: number;
	date: string;
	name: string;
	awakeningType?: { affinity?: string; type?: string };
	corrosionType?: { affinity?: string; type?: string };
	cost?: Record<string, number>;
	resists?: Record<string, number>;
	statuses?: string[];
	extractable?: boolean;
	maxThreadspin?: number;
}

interface AssetEgoDetail {
	passiveList?: Array<{ name?: string; desc?: string }>;
}

interface MjEgo {
	id: number;
	nameKo?: string;
}

export function buildEgos(ctx: Ctx) {
	const assets = readJson<Record<string, AssetEgo>>('egos', 'limbus-assets', 'egos.json');
	const details = readJsonDir<AssetEgoDetail>('ego-details', 'limbus-assets');
	const mj = new Map(
		toRecords(
			readJson<Record<string, MjEgo> | MjEgo[]>('egos', 'limbus-data-mj', 'egos.json'),
		).map((e) => [e.id, e]),
	);
	const statusIds = new Set(
		Object.keys(readJson<Record<string, unknown>>('mechanics', 'limbus-assets', 'statuses.json')),
	);

	const ego: Array<{
		id: number;
		sinnerId: number;
		rank: string;
		season: number;
		releaseDate: string | null;
		awakenAffinity: string;
		awakenAtkType: string;
		corrosionAffinity: string | null;
		corrosionAtkType: string | null;
		extractable: boolean;
		maxThreadspin: number | null;
	}> = [];
	const egoText: Array<{ egoId: number; locale: Locale; name: string }> = [];
	const cost: Array<{ egoId: number; sin: string; amount: number }> = [];
	const resist: Array<{ egoId: number; sin: string; value: number }> = [];
	const status: Array<{ egoId: number; statusId: string }> = [];
	const passive: Array<{ egoId: number; index: number }> = [];
	const passiveText: Array<{
		egoId: number;
		index: number;
		locale: Locale;
		name: string;
		desc: string;
		descRaw: string;
	}> = [];

	for (const [key, e] of Object.entries(assets)) {
		const id = Number(key);
		const releaseDate = toIsoDate(e.date);
		if (releaseDate === null) ctx.report.unmapped('E.G.O 출시일 형식 불명', e.date, key);

		const awaken = e.awakeningType ?? {};
		if (!awaken.affinity || !awaken.type) {
			ctx.report.unmapped('E.G.O 각성 속성 결손', key, e.name);
			continue;
		}

		ego.push({
			id,
			sinnerId: e.sinnerId,
			rank: e.rank,
			season: e.season,
			releaseDate,
			awakenAffinity: awaken.affinity,
			awakenAtkType: awaken.type,
			// 침식이 없는 E.G.O 가 12종 있다.
			corrosionAffinity: e.corrosionType?.affinity ?? null,
			corrosionAtkType: e.corrosionType?.type ?? null,
			extractable: e.extractable === true,
			maxThreadspin: e.maxThreadspin ?? null,
		});

		const ko = mj.get(id)?.nameKo ?? lookupTerm(ctx.terms.ko, id, ['egos'])?.name ?? e.name;
		const en = lookupTerm(ctx.terms.en, id, ['egos'])?.name ?? e.name;
		egoText.push({ egoId: id, locale: 'ko', name: stripMarkup(ko) });
		egoText.push({ egoId: id, locale: 'en', name: stripMarkup(en) });

		// 죄악 자원 소모량. 소모가 없는 속성은 행을 만들지 않는다.
		for (const [sin, amount] of Object.entries(e.cost ?? {})) {
			if (!SINS.includes(sin as (typeof SINS)[number])) {
				ctx.report.unmapped('E.G.O 코스트의 죄악 속성 불명', sin, key);
				continue;
			}
			cost.push({ egoId: id, sin, amount });
		}

		// E.G.O 의 저항은 죄악 7종을 축으로 한다. 인격(공격 타입 3종)과 다르다.
		for (const sin of SINS) {
			const value = e.resists?.[sin];
			if (value === undefined) {
				ctx.report.unmapped('E.G.O 저항 결손', sin, key);
				continue;
			}
			resist.push({ egoId: id, sin, value });
		}

		for (const statusId of e.statuses ?? []) {
			if (!statusIds.has(statusId)) {
				ctx.report.unmapped('E.G.O 상태가 상태 목록에 없음', statusId, key);
				continue;
			}
			status.push({ egoId: id, statusId });
		}

		// 패시브는 요약 파일에 없고 개별 상세 파일에만 있다.
		const list = details.get(key)?.passiveList ?? [];
		if (list.length === 0) ctx.report.note('E.G.O 패시브 없음', key, e.name);
		list.forEach((p, index) => {
			passive.push({ egoId: id, index });
			for (const locale of LOCALES) {
				const rawName = p.name ?? '';
				const rawDesc = p.desc ?? '';
				passiveText.push({
					egoId: id,
					index,
					locale,
					name: stripMarkup(rawName),
					desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `ego-passive:${id}`),
					descRaw: rawDesc,
				});
			}
		});
	}

	ctx.report.rows('ego', ego.length);
	ctx.report.rows('ego_text', egoText.length);
	ctx.report.rows('ego_cost', cost.length);
	ctx.report.rows('ego_resist', resist.length);
	ctx.report.rows('ego_status', status.length);
	ctx.report.rows('ego_passive', passive.length);
	ctx.report.rows('ego_passive_text', passiveText.length);

	return { ego, egoText, cost, resist, status, passive, passiveText };
}

// ── 거울 던전 ─────────────────────────────────────────────────

interface Grace {
	index: number;
	id: string;
	name: string;
	cost: number;
	descs?: string[][];
}

/**
 * 거울 던전 버전은 데이터에 명시되어 있지 않다(`docs/01-data-source.md` 8절 미결).
 * 로컬라이즈 파일명의 `Mirror<n>` · `MD<n>` 에서 최대값을 취해 `MD7` 형태로 만든다.
 * 파일에서 도출한 사실이며 지어낸 표기가 아니다.
 */
function detectVersion(): string {
	// 표제어 id 로 찾으면 안 된다. `MD6147` 같은 상태 식별자가 걸려 버전이 6147 이 된다.
	// 파일명의 `_Mirror<n>` · `_MD<n>` 만 본다.
	const pattern = /_(?:Mirror|MD)(\d+)(?:\.json$|_)/;
	let max = 0;
	for (const dir of ['loc-ko', 'loc-en']) {
		for (const name of listJsonNames('mirror-dungeon', dir)) {
			const m = pattern.exec(name);
			if (m?.[1]) max = Math.max(max, Number(m[1]));
		}
	}
	return max > 0 ? `MD${max}` : 'unknown';
}

export function buildMirrorDungeon(ctx: Ctx) {
	const details = readJson<{ grace?: Grace[] }>(
		'mirror-dungeon',
		'limbus-assets',
		'md__details.json',
	);
	const floors = readJson<Record<string, Record<string, string[]>>>(
		'mirror-dungeon',
		'limbus-assets',
		'md_floor_packs.json',
	);

	// 층 수는 층 테이블의 구간 표기에서 도출한다. hard 는 11-15, normal 은 1-5 로 끝난다.
	const bounds = (difficulty: string): number => {
		let max = 0;
		for (const range of Object.keys(floors[difficulty] ?? {})) {
			for (const part of range.split('-')) max = Math.max(max, Number(part) || 0);
		}
		return max;
	};
	const totalFloors = bounds('hard');
	const baseFloors = bounds('normal');
	const version = detectVersion();

	const dungeon = [{ version, totalFloors, baseFloors }];
	const grace: Array<{ id: string; version: string; index: number; cost: number }> = [];
	const graceText: Array<{ graceId: string; locale: Locale; name: string; descs: string[] }> = [];

	for (const g of details.grace ?? []) {
		grace.push({ id: g.id, version, index: g.index, cost: g.cost });
		for (const locale of LOCALES) {
			graceText.push({
				graceId: g.id,
				locale,
				name: stripMarkup(g.name),
				// 강화 단계별 효과가 문자열 배열의 배열이다. 단계마다 한 줄로 합친다.
				descs: (g.descs ?? []).map((step) => step.join(' · ')),
			});
		}
	}

	ctx.report.rows('mirror_dungeon', dungeon.length);
	ctx.report.rows('grace_option', grace.length);
	ctx.report.rows('grace_option_text', graceText.length);
	return { dungeon, grace, graceText };
}

// ── 데이터셋 스탬프 ───────────────────────────────────────────

/**
 * 데이터셋 전체에 기준 버전을 남긴다(02-data-model 원칙 5).
 *
 * **실행 시각을 넣지 않는다.** 같은 입력이면 같은 결과가 나와야 한다(ADR-02 원칙 3).
 * 모든 값을 원본 매니페스트에서 가져오므로 몇 번을 돌려도 산출물이 같다.
 */
export function buildDataset(ctx: Ctx, mdVersion: string) {
	const manifest = readJson<{ gameStateAnchor?: string; generatedAt?: string }>(
		'..',
		'manifest.json',
	);
	const snapshotDate = manifest.generatedAt ?? null;
	if (snapshotDate === null) ctx.report.unmapped('매니페스트에 수집일이 없음', 'generatedAt');
	const rows = [
		{
			id: 1,
			gameVersion: manifest.gameStateAnchor ?? 'unknown',
			mdVersion,
			snapshotDate,
			sourceAnchor: manifest.gameStateAnchor ?? 'unknown',
			generatedAt: snapshotDate,
		},
	];
	ctx.report.rows('dataset', rows.length);
	return rows;
}
