/**
 * 테마 팩과 층별 등장 팩.
 *
 * 정본 배정(ADR-04 2.1)
 *   테마 팩        limbus-data-mj  — 층·변형·중첩·극한이 여기에만 있다
 *   층별 등장 팩   limbus-assets   — 난이도·구간 단위 테이블이 원본 형태에 가깝다
 * 허용 보강(ADR-04 2.2)
 *   pack_boss_encounter  limbus-assets `bossEncounters`  정본에 없다
 *
 * 층 정보는 두 출처가 겹치는 유일한 지점이다. 정본을 쓰되 대조 결과를 리포트에 남긴다.
 */
import { readJson } from '../io.js';
import { stripMarkup, lookupTerm } from '../text.js';
import type { Ctx } from './basics.js';

const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];

interface MjPack {
	id: number;
	name: string;
	nameKo?: string;
	category: string;
	chapter?: number | string | null;
	variant?: string | null;
	sprite: string;
	normalFloors?: number[];
	hardFloors?: number[];
	superposition?: boolean;
	extreme?: boolean;
	floorLength?: number | null;
}

interface AssetPack {
	bossEncounters?: string[];
	category?: string[];
	image?: string;
	name?: string;
}

/** `{ hard: { "1": [...], "6-10": [...] }, normal: { ... } }` */
type FloorTable = Record<string, Record<string, string[]>>;

export function buildPacks(ctx: Ctx) {
	const mjPacks = readJson<MjPack[]>('packs', 'limbus-data-mj', 'packs.json');
	const assets = readJson<Record<string, AssetPack>>(
		'packs',
		'limbus-assets',
		'md_theme_packs.json',
	);
	const floorTable = readJson<FloorTable>(
		'mirror-dungeon',
		'limbus-assets',
		'md_floor_packs.json',
	);

	const pack: Array<{
		id: string;
		category: string;
		chapter: string | null;
		variant: string | null;
		sprite: string;
		superposition: boolean;
		extreme: boolean;
		floorLength: number | null;
	}> = [];
	const packText: Array<{ packId: string; locale: Locale; name: string }> = [];
	const bosses: Array<{ packId: string; encounterId: string }> = [];

	for (const p of mjPacks) {
		const id = String(p.id);
		pack.push({
			id,
			category: p.category,
			chapter: p.chapter === null || p.chapter === undefined ? null : String(p.chapter),
			variant: p.variant ?? null,
			sprite: p.sprite,
			superposition: p.superposition === true,
			extreme: p.extreme === true,
			floorLength: p.floorLength ?? null,
		});

		// 한국어는 정본이 직접 갖고 있다. 없으면 로케일 파일, 그것도 없으면 영문을 유지한다.
		const ko = p.nameKo ?? lookupTerm(ctx.terms.ko, id, ['packs'])?.name ?? p.name;
		const en = lookupTerm(ctx.terms.en, id, ['packs'])?.name ?? p.name;
		packText.push({ packId: id, locale: 'ko', name: stripMarkup(ko) });
		packText.push({ packId: id, locale: 'en', name: stripMarkup(en) });

		// 보스 인카운터는 정본에 없어 limbus-assets 로 보강한다.
		for (const encounterId of assets[id]?.bossEncounters ?? []) {
			bosses.push({ packId: id, encounterId });
		}
	}

	const known = new Set(pack.map((p) => p.id));
	const floorPack: Array<{ difficulty: string; floorRange: string; packId: string }> = [];
	for (const [difficulty, ranges] of Object.entries(floorTable)) {
		for (const [floorRange, packIds] of Object.entries(ranges)) {
			for (const raw of packIds) {
				const packId = String(raw);
				if (!known.has(packId)) {
					ctx.report.unmapped('층 테이블의 팩이 팩 목록에 없음', packId, `${difficulty} ${floorRange}`);
					continue;
				}
				floorPack.push({ difficulty, floorRange, packId });
			}
		}
	}

	crossCheckFloors(ctx, mjPacks, floorTable);

	ctx.report.rows('pack', pack.length);
	ctx.report.rows('pack_text', packText.length);
	ctx.report.rows('pack_boss_encounter', bosses.length);
	ctx.report.rows('floor_pack', floorPack.length);

	return { pack, packText, bosses, floorPack };
}

/**
 * 두 출처의 층 정보를 대조한다.
 *
 * 정본(`md_floor_packs`)은 난이도별 구간 단위로, 보강 출처(mj)는 팩별 층 배열로 담는다.
 * 구간 표기가 달라 층 번호를 직접 비교할 수는 없으므로, **난이도별로 어떤 팩이 등장하는가**를
 * 집합으로 맞춘다. 어긋나면 어느 쪽이 틀렸는지가 아니라 어긋난다는 사실이 정보다.
 */
function crossCheckFloors(ctx: Ctx, mjPacks: MjPack[], floorTable: FloorTable): void {
	for (const [difficulty, field] of [
		['normal', 'normalFloors'],
		['hard', 'hardFloors'],
	] as const) {
		const canonical = new Set<string>();
		for (const packIds of Object.values(floorTable[difficulty] ?? {})) {
			for (const id of packIds) canonical.add(String(id));
		}
		const supplement = new Set(
			mjPacks.filter((p) => (p[field] ?? []).length > 0).map((p) => String(p.id)),
		);

		// extreme 팩은 두 출처가 표현 방식만 다르다. 정본은 hard 11-15 구간에 넣고,
		// 보강 출처는 hardFloors 를 비운 채 extreme 플래그로 표시한다. 모순이 아니다.
		const extremeIds = new Set(mjPacks.filter((p) => p.extreme === true).map((p) => String(p.id)));
		const onlyCanonical = [...canonical].filter(
			(id) => !supplement.has(id) && !extremeIds.has(id),
		);
		const onlySupplement = [...supplement].filter((id) => !canonical.has(id));
		if (onlyCanonical.length === 0 && onlySupplement.length === 0) continue;

		ctx.report.unmapped(
			`층 정보 출처 간 불일치 (${difficulty})`,
			`정본만 ${onlyCanonical.length} · 보강만 ${onlySupplement.length}`,
			[...onlyCanonical.slice(0, 3), ...onlySupplement.slice(0, 3)].join(', '),
		);
	}
}
