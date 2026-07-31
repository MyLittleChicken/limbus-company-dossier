/**
 * 스킬 1,045종과 동기화 단계.
 *
 * **단계를 전량 전개한다**(스펙 3.3). 원본 mj 는 델타 방식이라 값이 바뀐 단계만
 * 담는다(실측 2,561행). 이것을 1–5 전부로 펴면 5,225행이 되고, 조회가
 * `WHERE uptie = 3` 한 줄로 끝난다.
 *
 * 델타 정보는 `changedHere` 로 보존하므로 원본 충실성을 잃지 않는다.
 *
 * 코인 효과 문자열은 **원문 그대로** 담는다. 대괄호 토큰 215종의 분해는
 * 계획 6에서 상태 어휘와 함께 한다 — 상태 테이블이 있어야 외래 키가 선다.
 */
import { arr, num, str, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const EVIDENCE = 'docs/data/identity/03-limbus-data-mj-skills.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/** 동기화 최대 단계 */
const MAX_UPTIE = 5;

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

export interface SkillInput {
	mjSkills: RawIndex;
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
}

export interface SkillStageTextRow {
	skillId: string;
	uptie: number;
	locale: Loc;
	name: string;
	desc: string | null;
}

export interface SkillCoinRow {
	skillId: string;
	uptie: number;
	index: number;
	effects: string[];
}

export interface SkillTables {
	skill: SkillRow[];
	skillStage: SkillStageRow[];
	skillStageText: SkillStageTextRow[];
	skillCoin: SkillCoinRow[];
}

/** `loc` 의 `levelList` 에서 해당 단계를 찾는다. */
function locStage(index: RawIndex, skillId: string, uptie: number): Record<string, unknown> | null {
	const entry = index.get(skillId);
	if (entry === undefined) return null;
	for (const l of arr(entry, 'levelList')) {
		if (typeof l !== 'object' || l === null) continue;
		const o = l as Record<string, unknown>;
		if (num(o, 'level') === uptie) return o;
	}
	return null;
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

		for (const stage of stages) {
			skillStage.push({ skillId: id, uptie: stage.uptie, changedHere: stage.changedHere });
			const src = (stage.source ?? {}) as Record<string, unknown>;

			for (const locale of LOCALES) {
				const loc = locStage(locByName[locale], id, stage.uptie);
				const mjName = locale === 'ko' ? str(src, 'nameKo') : locale === 'en' ? str(src, 'name') : null;
				const mjDesc = locale === 'ko' ? str(src, 'descKo') : locale === 'en' ? str(src, 'desc') : null;
				const name = str(loc ?? {}, 'name') ?? mjName;
				if (name === null) continue;
				skillStageText.push({
					skillId: id,
					uptie: stage.uptie,
					locale,
					name,
					desc: str(loc ?? {}, 'desc') ?? mjDesc,
				});
			}

			arr(src, 'coins').forEach((coin, index) => {
				const effects = Array.isArray(coin)
					? coin.filter((c): c is string => typeof c === 'string')
					: typeof coin === 'string'
						? [coin]
						: [];
				skillCoin.push({ skillId: id, uptie: stage.uptie, index, effects });
			});
		}
	}

	return { skill, skillStage, skillStageText, skillCoin };
}
