/**
 * 스킬 1,045종과 동기화 단계.
 *
 * **단계를 전량 전개한다**(스펙 3.3). 원본 mj 는 델타 방식이라 값이 바뀐 단계만
 * 담는다(실측 2,561행). 이것을 1–5 전부로 펴면 조회가 `WHERE uptie = 3` 한 줄로
 * 끝난다. 델타 정보는 `changedHere` 로 보존하므로 원본 충실성을 잃지 않는다.
 *
 * **출처가 셋이다.** 초판은 mj `skills.json` 하나만 읽어 두 가지를 통째로 잃었다.
 *
 *   구조·텍스트   mj `skills.json`                     levels[] (델타)
 *   단계 수치      limbus-assets `identity-details/*`    skills[id].data[] (델타)
 *   코인 문장      loc-ko/en/ja `Skills*.json`          levelList[].coinlist[]
 *
 * 세 출처의 단계 축이 저마다 성기다. 어느 쪽이든 「요청 단계 이하 중 가장 큰
 * 원본」을 쓴다 — 같은 규칙 하나로 셋을 맞춘다.
 *
 * **동기화 III 해금.** 3번 공격 스킬은 게임에서 동기화 III 에 풀린다(위키
 * "Tables for Uptie I and II do not display Skill 3 data—Locked until Tier 3").
 * 초판은 3단계 값을 1·2 로 복사해 **없는 것을 있는 것처럼 만들었다.**
 * 슬롯 3 이면서 첫 원본이 3단계인 206건은 1·2 단계 행을 만들지 않는다.
 *
 * 코인 효과 문자열은 **원문 그대로** 담는다. 대괄호 토큰 215종의 분해는
 * 계획 6에서 상태 어휘와 함께 한다 — 상태 테이블이 있어야 외래 키가 선다.
 */
import { arr, num, str, type RawIndex } from '../source.js';
import { descOf, stripMarkup } from './markup.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const LOC = 'loc-ko/en/ja';
const EVIDENCE = 'docs/data/identity/03-limbus-data-mj-skills.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/** 동기화 최대 단계 */
const MAX_UPTIE = 5;

/** 객체인가. 배열과 null 을 제외한다. */
function obj(v: unknown): Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: {};
}

export interface ExpandedStage {
	uptie: number;
	/** 원본 델타가 이 단계에 있었나 */
	changedHere: boolean;
	/** 이 단계가 쓰는 원본 level 객체 */
	source: unknown;
}

/**
 * 델타 `levels` 를 1–5 전량으로 편다.
 *
 * 요청 단계 이하 중 **가장 큰 원본**을 쓴다. 그보다 앞선 원본이 없으면
 * (첫 원본이 level 4 인 경우 등) 가장 앞 원본으로 채우고 `changedHere` 는
 * false 로 둔다 — 그 단계에 원본이 없었다는 사실이 남아야 한다.
 */
export function expandStages(levels: unknown[]): ExpandedStage[] {
	const byLevel = new Map<number, unknown>();
	for (const l of levels) {
		if (typeof l !== 'object' || l === null) continue;
		const lv = num(l as Record<string, unknown>, 'level');
		if (lv !== null) byLevel.set(lv, l);
	}
	if (byLevel.size === 0) return [];

	const sorted = [...byLevel.keys()].sort((a, b) => a - b);
	const first = sorted[0] as number;
	const out: ExpandedStage[] = [];
	for (let uptie = 1; uptie <= MAX_UPTIE; uptie += 1) {
		const at = sorted.filter((l) => l <= uptie).pop() ?? first;
		out.push({ uptie, changedHere: byLevel.has(uptie), source: byLevel.get(at) });
	}
	return out;
}

/**
 * 델타 배열을 「축 값 → 그 단계까지 누적된 객체」로 편다.
 *
 * `identity-details` 의 `data[]` 가 이 모양이다 — 뒤 단계는 **바뀐 필드만** 갖는다.
 * 앞 단계 값을 이어받고 그 단계에 온 필드만 덮어야 원본과 같아진다.
 */
export function accumulateDeltas(
	entries: unknown[],
	axis: string,
): Map<number, Record<string, unknown>> {
	const sorted: Array<[number, Record<string, unknown>]> = [];
	for (const e of entries) {
		const o = obj(e);
		const at = num(o, axis);
		if (at !== null) sorted.push([at, o]);
	}
	sorted.sort((a, b) => a[0] - b[0]);

	const byAxis = new Map<number, Record<string, unknown>>();
	let acc: Record<string, unknown> = {};
	for (const [at, o] of sorted) {
		acc = { ...acc, ...o };
		byAxis.set(at, acc);
	}
	return byAxis;
}

/**
 * 축 맵에서 요청 단계의 값을 고른다.
 *
 * 요청 이하 중 가장 큰 것. 그보다 앞선 원본이 없으면 가장 앞 원본을 쓴다 —
 * `expandStages` 와 같은 규칙이다.
 */
export function pickAt<T>(byAxis: Map<number, T>, at: number): T | null {
	const keys = [...byAxis.keys()].sort((a, b) => a - b);
	if (keys.length === 0) return null;
	const key = keys.filter((k) => k <= at).pop() ?? (keys[0] as number);
	return byAxis.get(key) ?? null;
}

/**
 * `identity-details` 를 **스킬 id** 로 다시 색인한다.
 *
 * 원본은 인격 하나가 파일 하나이고(184) 그 안에 `skills: {스킬id: {data: [...]}}`
 * 가 들어 있다. 단계 수치는 이 경로에만 있다 — mj 에는 아예 없는 필드다.
 */
export function indexDetailSkills(details: RawIndex): Map<string, Map<number, Record<string, unknown>>> {
	const out = new Map<string, Map<number, Record<string, unknown>>>();
	for (const payload of details.values()) {
		for (const [skillId, raw] of Object.entries(obj(payload['skills']))) {
			out.set(skillId, accumulateDeltas(arr(obj(raw), 'data'), 'uptie'));
		}
	}
	return out;
}

/**
 * 인격 상세의 공격 스킬 중 지정 슬롯인 것의 id 집합.
 *
 * 동기화 III 해금 판정에 쓴다. 슬롯은 인격 쪽 정보라 스킬 원본에는 없다.
 */
export function skillIdsInSlot(mjIdentityDetail: RawIndex, slot: number): Set<string> {
	const out = new Set<string>();
	for (const detail of mjIdentityDetail.values()) {
		for (const raw of arr(detail, 'attackSkills')) {
			const o = obj(raw);
			const skillId = o['skillId'];
			if (skillId === undefined || skillId === null) continue;
			if (num(o, 'slot') === slot) out.add(String(skillId));
		}
	}
	return out;
}

export interface SkillInput {
	mjSkills: RawIndex;
	/** identity-details/limbus-assets. 인격 id 로 색인돼 있고 안에 skills 가 있다 */
	details: RawIndex;
	/** mj identities_detail. 슬롯을 알아야 동기화 III 해금을 판정할 수 있다 */
	mjIdentityDetail: RawIndex;
	/** loc `Skills*.json` 만. Passives 와 id 가 289건 겹쳐 파일로 갈라야 한다 */
	locKo: RawIndex;
	locEn: RawIndex;
	locJa: RawIndex;
}

export interface SkillRow {
	id: string;
	sin: string | null;
	attackType: string | null;
	kind: string | null;
	skillTier: number | null;
}

export interface SkillStageRow {
	skillId: string;
	uptie: number;
	changedHere: boolean;
	baseValue: number | null;
	coinValue: number | null;
	atkWeight: number | null;
	levelCorrection: number | null;
	clashable: boolean | null;
}

export interface SkillStageTextRow {
	skillId: string;
	uptie: number;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
}

export interface SkillCoinRow {
	skillId: string;
	uptie: number;
	index: number;
	locale: Loc;
	effects: string[];
	type: string | null;
}

export interface SkillTables {
	skill: SkillRow[];
	skillStage: SkillStageRow[];
	skillStageText: SkillStageTextRow[];
	skillCoin: SkillCoinRow[];
}

/** loc 의 `levelList` 를 단계로 색인한다. 성긴 축이며 델타처럼 이어받는다. */
function locStages(index: RawIndex, skillId: string): Map<number, Record<string, unknown>> {
	const out = new Map<number, Record<string, unknown>>();
	const entry = index.get(skillId);
	if (entry === undefined) return out;
	for (const raw of arr(entry, 'levelList')) {
		const o = obj(raw);
		const level = num(o, 'level');
		if (level !== null) out.set(level, o);
	}
	return out;
}

/** loc 한 단계의 코인 문장. `coinlist[].coindescs[].desc` 이며 마크업을 지운다. */
function locCoins(stage: Record<string, unknown> | null): string[][] {
	if (stage === null) return [];
	return arr(stage, 'coinlist').map((coin) =>
		arr(obj(coin), 'coindescs')
			.map((d) => str(obj(d), 'desc'))
			.filter((d): d is string => d !== null)
			.map(stripMarkup),
	);
}

/**
 * mj 한 단계의 코인 문장. 영문이며 loc-en 이 비었을 때만 쓴다.
 *
 * mj 도 마크업을 담는다(실측 469행, 전부 E.G.O 스킬). loc 과 같게 지운다 —
 * `effects` 에는 원문 보관 자리가 없어 두 출처가 다른 모양이면 소비자가 갈린다.
 */
function mjCoins(src: Record<string, unknown>): string[][] {
	return arr(src, 'coins').map((coin) =>
		(Array.isArray(coin)
			? coin.filter((c): c is string => typeof c === 'string')
			: typeof coin === 'string'
				? [coin]
				: []
		).map(stripMarkup),
	);
}

export function buildSkills(input: SkillInput, meta: Meta): SkillTables {
	const skill: SkillRow[] = [];
	const skillStage: SkillStageRow[] = [];
	const skillStageText: SkillStageTextRow[] = [];
	const skillCoin: SkillCoinRow[] = [];

	const locByName: Record<Loc, RawIndex> = {
		ko: input.locKo,
		en: input.locEn,
		ja: input.locJa,
	};
	const detailSkills = indexDetailSkills(input.details);
	const slot3 = skillIdsInSlot(input.mjIdentityDetail, 3);

	for (const [id, s] of input.mjSkills) {
		skill.push({
			id,
			sin: str(s, 'sin'),
			attackType: str(s, 'attackType'),
			kind: str(s, 'defType'),
			skillTier: num(s, 'skillTier'),
		});
		meta.source('skill', id, 'core', 'mj-only', [MJ]);

		const stages = expandStages(arr(s, 'levels'));
		if (stages.length === 0) {
			meta.gap('skill', id, 'levels', 'levels 가 비어 있어 단계를 만들 수 없다', EVIDENCE);
			continue;
		}
		meta.source('skill', id, 'stages', 'mj-only-expanded', [MJ]);

		const values = detailSkills.get(id) ?? new Map<number, Record<string, unknown>>();
		if (values.size > 0) meta.source('skill', id, 'values', 'assets-only', [ASSETS]);

		const locStageMap: Record<Loc, Map<number, Record<string, unknown>>> = {
			ko: locStages(locByName.ko, id),
			en: locStages(locByName.en, id),
			ja: locStages(locByName.ja, id),
		};

		// 슬롯 3 스킬은 동기화 III 에서 해금된다. 첫 원본도 3단계인 206건이
		// 위키가 확인해 준 바로 그 모양이다 — 1·2 단계는 게임에 존재하지 않는다.
		// 첫 원본이 4단계인 1건과 방어 7건 등 나머지 10건은 판정이 안 나 현행을 둔다.
		const firstLevel = stages.find((x) => x.changedHere)?.uptie ?? null;
		const lockedUntil3 = slot3.has(id) && firstLevel === 3;
		if (lockedUntil3) meta.source('skill', id, 'unlock', 'game-verified', [MJ, ASSETS]);

		for (const stage of stages) {
			if (lockedUntil3 && stage.uptie < 3) continue;
			const src = (stage.source ?? {}) as Record<string, unknown>;
			const v = pickAt(values, stage.uptie) ?? {};

			skillStage.push({
				skillId: id,
				uptie: stage.uptie,
				changedHere: stage.changedHere,
				baseValue: num(v, 'baseValue'),
				coinValue: num(v, 'coinValue'),
				atkWeight: num(v, 'atkWeight'),
				levelCorrection: num(v, 'levelCorrection'),
				// 원본이 명시할 때만 있다(실측 52건). 없는 것은 false 가 아니라 모름이다
				clashable: v['clashable'] === undefined ? null : v['clashable'] === true,
			});

			// 코인 종류는 로케일과 무관하다. 위치로 맞춘다
			const coinMeta = arr(v, 'coins');

			for (const locale of LOCALES) {
				const loc = pickAt(locStageMap[locale], stage.uptie);

				const mjName = locale === 'ko' ? str(src, 'nameKo') : locale === 'en' ? str(src, 'name') : null;
				const mjDesc = locale === 'ko' ? str(src, 'descKo') : locale === 'en' ? str(src, 'desc') : null;
				const name = str(loc ?? {}, 'name') ?? mjName;
				if (name !== null) {
					skillStageText.push({
						skillId: id,
						uptie: stage.uptie,
						locale,
						name,
						...descOf(str(loc ?? {}, 'desc') ?? mjDesc),
					});
				}

				// 코인 문장은 loc 이 정본이다. 영문만은 mj 가 같은 문장을 갖고 있어 폴백이 선다
				const fromLoc = locCoins(loc);
				if (fromLoc.length > 0) meta.source('skill', id, 'coinText', 'loc-only', [LOC]);
				const effectsList = fromLoc.length > 0 ? fromLoc : locale === 'en' ? mjCoins(src) : [];
				// **코인 개수는 assets 가 안다.** 효과 문구가 없는 코인도 코인이다 —
				// 문장만 세면 그런 코인이 통째로 빠진다(실측 public 대비 43행).
				const count = Math.max(coinMeta.length, effectsList.length);
				for (let index = 0; index < count; index += 1) {
					skillCoin.push({
						skillId: id,
						uptie: stage.uptie,
						index,
						locale,
						effects: effectsList[index] ?? [],
						type: str(obj(coinMeta[index]), 'type'),
					});
				}
			}
		}
	}

	return { skill, skillStage, skillStageText, skillCoin };
}
