/**
 * E.G.O 115종 — 플레이 110 + 연출 전용 5.
 *
 * 정본은 limbus-assets 다(ADR-04) — 인격과 뒤집힌다. 다만 **loc 가 mj 보다 넓다.**
 *
 *   연출 전용 E.G.O 5건    Egos-a1c9p3.json · id 는 기본 id + "1" · 컷신 전용
 *   두 번째 각성 스킬 2건   mj 의 awakeningSkill 은 값이 하나뿐이다
 *                          2060812 오혈읍루-종 · 2120912 눈부시지 않은 영광-광휘
 *
 * 스킬의 정본은 **ego-details**(limbus-assets 110파일)다 — 플레이 E.G.O 110종을 다 덮고
 * 스킬 id 집합이 위키와 완전 일치한다(docs/audit/wiki/02-ego.md §1).
 * loc 은 표시 문자열만 담당한다.
 *
 * E.G.O 스킬은 인격 스킬과 **구조가 다르다**.
 *   문자열   loc 의 levelList[].coinlist[].coindescs[] · 문구가 안 바뀐 단계는 아예 없다
 *   수치     ego-details 의 awakeningSkills[].data[] · **델타 배열**이라 전개해야 한다
 * 그래서 단계 집합은 둘의 합집합이다(실측 loc 에 없고 ego-details 에만 있는 단계 29건).
 */
import { arr, bool, num, str, type RawIndex } from '../source.js';
import { descOf } from './markup.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const LOC = 'loc-ko/en/ja';
const EVIDENCE = 'docs/data/ego/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/** 죄악 7종. 저항·자원의 축이다. */
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'] as const;

/**
 * 전작 로보토미 코퍼레이션의 저항 축. **현재 게임에 없다**(마스터북 게임 확인).
 * 버리지 않되 게임 사실과 섞지 않는다 — tool_annotation 으로 격리한다.
 */
const LEGACY_RESISTS = ['white', 'black'] as const;

export interface EgoInput {
	mj: RawIndex;
	mjDetail: RawIndex;
	assets: RawIndex;
	/** ego-details/limbus-assets — E.G.O id 로 열린다. 스킬 id 집합과 단계별 수치의 정본 */
	details: RawIndex;
	locEgoKo: RawIndex;
	locEgoEn: RawIndex;
	locEgoJa: RawIndex;
	locSkillKo: RawIndex;
	locSkillEn: RawIndex;
	locSkillJa: RawIndex;
	locPassiveKo: RawIndex;
	locPassiveEn: RawIndex;
	locPassiveJa: RawIndex;
	knownSinners: Set<number>;
	/** canonical.status 에 실제로 있는 id. 계획 6에서 이어진다 */
	knownStatuses: Set<string>;
}

export interface EgoRow {
	id: string;
	sinnerId: number;
	rank: string | null;
	sin: string | null;
	attackType: string | null;
	season: number | null;
	releaseDate: string | null;
	maxThreadspin: number | null;
	extractable: boolean;
	presentationOnly: boolean;
}

export interface EgoTextRow {
	egoId: string;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
}

export interface EgoResistRow {
	egoId: string;
	sin: string;
	value: number;
}

export interface EgoCostRow {
	egoId: string;
	sin: string;
	count: number;
}

export interface EgoCorrosionRow {
	egoId: string;
	index: number;
	section: number;
	probability: number;
}

export interface EgoRequirementRow {
	egoId: string;
	attributeType: string;
	num: number;
}

export interface EgoSkillRow {
	id: string;
	egoId: string;
	role: string;
	ordinal: number;
}

/** 단계별 수치 5종. ego-details 만이 갖는다 — loc 에도 mj 에도 없다 */
export interface StageNumbers {
	spCost: number | null;
	baseValue: number | null;
	coinValue: number | null;
	atkWeight: number | null;
	levelCorrection: number | null;
}

export interface EgoSkillStageRow extends StageNumbers {
	skillId: string;
	uptie: number;
}

export interface EgoSkillStageTextRow {
	skillId: string;
	uptie: number;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
	abName: string | null;
}

export interface EgoSkillCoinRow {
	skillId: string;
	uptie: number;
	index: number;
	locale: Loc;
	effects: string[];
}

export interface EgoPassiveRow {
	id: string;
}

export interface EgoPassiveTextRow {
	passiveId: string;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
}

export interface EgoPassiveLinkRow {
	egoId: string;
	passiveId: string;
}

export interface EgoStatusRow {
	egoId: string;
	statusId: string;
}

export interface ToolAnnotationRow {
	source: string;
	entity: string;
	entityId: string;
	field: string;
	value: unknown;
}

export interface EgoTables {
	ego: EgoRow[];
	egoText: EgoTextRow[];
	egoResist: EgoResistRow[];
	egoCost: EgoCostRow[];
	egoCorrosion: EgoCorrosionRow[];
	egoRequirement: EgoRequirementRow[];
	egoSkill: EgoSkillRow[];
	egoSkillStage: EgoSkillStageRow[];
	egoSkillStageText: EgoSkillStageTextRow[];
	egoSkillCoin: EgoSkillCoinRow[];
	egoPassive: EgoPassiveRow[];
	egoPassiveText: EgoPassiveTextRow[];
	egoPassiveLink: EgoPassiveLinkRow[];
	egoStatus: EgoStatusRow[];
	toolAnnotation: ToolAnnotationRow[];
}

/** 객체인가. 배열과 null 을 제외한다. */
function obj(v: unknown): Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: {};
}

/** ego-details 의 스킬 묶음 두 갈래. 배열 순서가 곧 ordinal 이다 */
const SKILL_GROUPS = [
	['awakeningSkills', 'awakening'],
	['corrosionSkills', 'corrosion'],
] as const;

const NUMBER_FIELDS = [
	'spCost',
	'baseValue',
	'coinValue',
	'atkWeight',
	'levelCorrection',
] as const;

const NO_NUMBERS: StageNumbers = {
	spCost: null,
	baseValue: null,
	coinValue: null,
	atkWeight: null,
	levelCorrection: null,
};

/**
 * ego-details 의 data[] 를 단계별 전량으로 편다.
 *
 * **델타 배열이다** — 뒤 단계는 바뀐 필드만 갖는다(실측 640항목 중 spCost 는 210개,
 * 즉 uptie 1 에만 온다). 앞 단계 값을 이어받고 그 단계에 온 필드만 덮는다.
 */
function expandStageNumbers(data: unknown[]): Map<number, StageNumbers> {
	const out = new Map<number, StageNumbers>();
	let carried: StageNumbers = NO_NUMBERS;
	const rows = data
		.map((raw) => obj(raw))
		.filter((d) => num(d, 'uptie') !== null)
		.sort((a, b) => (num(a, 'uptie') ?? 0) - (num(b, 'uptie') ?? 0));
	for (const d of rows) {
		const next: StageNumbers = { ...carried };
		for (const f of NUMBER_FIELDS) {
			const v = num(d, f);
			if (v !== null) next[f] = v;
		}
		carried = next;
		out.set(num(d, 'uptie') as number, next);
	}
	return out;
}

/**
 * 그 단계의 수치. ego-details 에 그 단계가 없으면 **바로 앞 단계 값**을 쓴다 —
 * 델타이므로 없는 단계는 곧 "바뀐 것이 없다"는 뜻이다.
 */
function numbersAt(m: Map<number, StageNumbers>, uptie: number): StageNumbers {
	let best = NO_NUMBERS;
	let bestKey = Number.NEGATIVE_INFINITY;
	for (const [k, v] of m) {
		if (k <= uptie && k > bestKey) {
			bestKey = k;
			best = v;
		}
	}
	return best;
}

export function buildEgos(input: EgoInput, meta: Meta): EgoTables {
	const t: EgoTables = {
		ego: [],
		egoText: [],
		egoResist: [],
		egoCost: [],
		egoCorrosion: [],
		egoRequirement: [],
		egoSkill: [],
		egoSkillStage: [],
		egoSkillStageText: [],
		egoSkillCoin: [],
		egoPassive: [],
		egoPassiveText: [],
		egoPassiveLink: [],
		egoStatus: [],
		toolAnnotation: [],
	};

	const egoLoc: Record<Loc, RawIndex> = {
		ko: input.locEgoKo,
		en: input.locEgoEn,
		ja: input.locEgoJa,
	};
	const skillLoc: Record<Loc, RawIndex> = {
		ko: input.locSkillKo,
		en: input.locSkillEn,
		ja: input.locSkillJa,
	};
	const passiveLoc: Record<Loc, RawIndex> = {
		ko: input.locPassiveKo,
		en: input.locPassiveEn,
		ja: input.locPassiveJa,
	};

	// 대상 id — mj 전량 + loc 에만 있는 연출 전용
	const ids = new Set<string>(input.mj.keys());
	for (const locale of LOCALES) {
		for (const id of egoLoc[locale].keys()) ids.add(id);
	}

	const passiveIds = new Set<string>();

	for (const id of [...ids].sort()) {
		const mj = input.mj.get(id);
		const presentationOnly = mj === undefined;
		const m = mj ?? {};
		const detail = input.mjDetail.get(id) ?? {};
		const a = input.assets.get(id) ?? {};

		// 연출 전용은 sinnerId 를 기본 id 에서 되찾는다 — 201011 → 20101
		const sinnerId =
			num(m, 'sinnerId') ??
			num(a, 'sinnerId') ??
			num(input.mj.get(id.slice(0, -1)) ?? {}, 'sinnerId');
		if (sinnerId === null || !input.knownSinners.has(sinnerId)) {
			meta.gap('ego', id, 'sinnerId', '수감자를 특정할 수 없다', EVIDENCE);
			continue;
		}

		// rank — mj rarity(소문자) ↔ assets rank(대문자). 대문자로 정규화
		const rarity = str(m, 'rarity');
		const rank = str(a, 'rank') ?? (rarity === null ? null : rarity.toUpperCase());

		t.ego.push({
			id,
			sinnerId,
			rank,
			sin: str(m, 'sin'),
			attackType: str(m, 'attackType'),
			season: num(m, 'season') ?? num(a, 'season'),
			releaseDate: str(a, 'date'),
			maxThreadspin: num(a, 'maxThreadspin'),
			extractable: bool(a, 'extractable'),
			presentationOnly,
		});
		meta.source('ego', id, 'core', presentationOnly ? 'loc-only' : 'mj+assets', [
			presentationOnly ? LOC : MJ,
		]);

		// ── 표시 문자열 ─────────────────────────────────────────
		for (const locale of LOCALES) {
			const loc = egoLoc[locale].get(id) ?? {};
			const mjName = locale === 'ko' ? str(m, 'nameKo') : locale === 'en' ? str(m, 'name') : null;
			const name = str(loc, 'name') ?? mjName;
			if (name === null) {
				meta.gap('ego', id, 'name', `${locale} 표시명이 어느 출처에도 없다`, EVIDENCE, locale);
				continue;
			}
			t.egoText.push({ egoId: id, locale, name, ...descOf(str(loc, 'desc')) });
		}

		if (presentationOnly) continue;

		// ── 저항 — 죄악 7축 + 로보토미 유산 격리 ──────────────────
		const resists = obj(detail['attributeResists']);
		for (const sin of SINS) {
			const value = num(resists, sin);
			if (value === null) continue;
			t.egoResist.push({ egoId: id, sin, value });
		}
		const legacy: Record<string, number> = {};
		for (const axis of LEGACY_RESISTS) {
			const value = num(resists, axis);
			if (value !== null) legacy[axis] = value;
		}
		if (Object.keys(legacy).length > 0) {
			t.toolAnnotation.push({
				source: MJ,
				entity: 'ego',
				entityId: id,
				field: 'legacyResist',
				value: legacy,
			});
		}
		meta.source('ego', id, 'resists', 'mj-only', [MJ]);

		// ── 자원 소모 ──────────────────────────────────────────
		const cost = obj(m['resourceCost']);
		for (const sin of SINS) {
			const count = num(cost, sin);
			if (count === null) continue;
			t.egoCost.push({ egoId: id, sin, count });
		}

		// ── 침식 확률표 ────────────────────────────────────────
		arr(detail, 'corrosion').forEach((raw, index) => {
			const c = obj(raw);
			const section = num(c, 'section');
			const probability = num(c, 'probability');
			if (section === null || probability === null) return;
			t.egoCorrosion.push({ egoId: id, index, section, probability });
		});

		// ── 색 토큰 요구 ───────────────────────────────────────
		for (const raw of arr(detail, 'requirements')) {
			const r = obj(raw);
			const attributeType = str(r, 'attributeType');
			const n = num(r, 'num');
			if (attributeType === null || n === null) continue;
			t.egoRequirement.push({ egoId: id, attributeType, num: n });
		}

		// ── 스킬 — ego-details 가 정본 ──────────────────────────
		// mj 의 awakeningSkill 은 **스칼라**라 두 번째 각성 스킬(20608 · 21209)을 못 담는다.
		// 초판은 그것을 loc 접두 스캔(`length === id.length + 2`)으로 메웠는데, 연출 전용
		// E.G.O 의 스킬(2010112 등 5건)이 길이 규칙에 걸려 기본 E.G.O 로 끌려왔다(감사 §4.3).
		// ego-details 의 awakeningSkills[].data[].id 집합은 위키와 완전 일치하므로 그것을 쓴다.
		const details = input.details.get(id);
		if (details === undefined) {
			meta.gap('ego', id, 'skills', 'ego-details 가 없어 스킬을 특정할 수 없다', EVIDENCE);
		} else {
			for (const [key, role] of SKILL_GROUPS) {
				arr(details, key).forEach((raw, ordinal) => {
					// 한 그룹의 data[] 는 한 스킬의 단계들이다. id 는 전부 같다
					const data = arr(obj(raw), 'data');
					const skillId = str(obj(data[0] ?? {}), 'id');
					if (skillId === null) return;
					t.egoSkill.push({ id: skillId, egoId: id, role, ordinal });
					pushSkillStages(t, skillLoc, skillId, expandStageNumbers(data));
				});
			}
			meta.source('ego', id, 'skills', 'assets-only', [ASSETS]);
		}

		// ── 다루는 상태 — 계획 6에서 이어진 연결. 실측 100 % 걸린다 ──
		let droppedStatuses = 0;
		for (const statusId of new Set(arr(a, 'statuses').map((v) => String(v)))) {
			if (!input.knownStatuses.has(statusId)) {
				droppedStatuses += 1;
				continue;
			}
			t.egoStatus.push({ egoId: id, statusId });
		}
		if (droppedStatuses > 0) {
			meta.gap('ego', id, 'statuses', `상태 목록에 없는 id 를 ${droppedStatuses}건 가리킨다`, EVIDENCE);
		}

		// ── 패시브 ────────────────────────────────────────────
		for (const raw of arr(detail, 'awakeningPassives')) {
			const passiveId = String(raw);
			passiveIds.add(passiveId);
			t.egoPassiveLink.push({ egoId: id, passiveId });
		}
	}

	// ── 패시브 본체와 표시 문자열 ────────────────────────────────
	for (const passiveId of [...passiveIds].sort()) {
		t.egoPassive.push({ id: passiveId });
		for (const locale of LOCALES) {
			const loc = passiveLoc[locale].get(passiveId) ?? {};
			const name = str(loc, 'name');
			if (name === null) continue;
			t.egoPassiveText.push({ passiveId, locale, name, ...descOf(str(loc, 'desc')) });
		}
		meta.source('ego_passive', passiveId, 'name', 'loc-only', [LOC]);
	}

	return t;
}

/**
 * 스킬 단계와 코인.
 *
 * 단계 집합은 **loc ∪ ego-details** 다. 둘이 담는 범위가 다르다 —
 * loc 은 문구가 안 바뀐 단계를 아예 싣지 않고(실측 2010311 은 1·3 뿐), ego-details 는
 * 수치가 바뀐 단계를 싣는다(같은 스킬의 uptie 4 에 atkWeight 3 이 온다).
 * 어느 한쪽만 보면 그 단계가 통째로 사라진다.
 */
function pushSkillStages(
	t: EgoTables,
	skillLoc: Record<Loc, RawIndex>,
	skillId: string,
	numbers: Map<number, StageNumbers>,
): void {
	const upties = new Set<number>(numbers.keys());
	for (const locale of LOCALES) {
		const entry = skillLoc[locale].get(skillId);
		if (entry === undefined) continue;
		for (const raw of arr(entry, 'levelList')) {
			const l = obj(raw);
			const uptie = num(l, 'level');
			if (uptie === null) continue;
			upties.add(uptie);
			const name = str(l, 'name');
			if (name !== null) {
				t.egoSkillStageText.push({
					skillId,
					uptie,
					locale,
					name,
					...descOf(str(l, 'desc')),
					abName: str(l, 'abName'),
				});
			}
			arr(l, 'coinlist').forEach((coinRaw, index) => {
				// **효과 문구가 없어도 코인 행은 남긴다.** 원본이 coindescs 를 [{}] 로 두는
				// 스킬이 있는데(2120611 · 2120911 — 위키 coin=1), 초판은 그것을 코인 0개로
				// 만들어 버렸다. 코인 수는 클래시 계산의 입력이라 잃으면 안 된다(감사 §3.5)
				const effects = arr(obj(coinRaw), 'coindescs')
					.map((d) => str(obj(d), 'desc'))
					.filter((d): d is string => d !== null);
				t.egoSkillCoin.push({ skillId, uptie, index, locale, effects });
			});
		}
	}
	for (const uptie of [...upties].sort((a, b) => a - b)) {
		t.egoSkillStage.push({ skillId, uptie, ...numbersAt(numbers, uptie) });
	}
}
