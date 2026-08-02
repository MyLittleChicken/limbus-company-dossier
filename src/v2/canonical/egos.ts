/**
 * E.G.O 115종 — 플레이 110 + 연출 전용 5.
 *
 * 정본은 limbus-assets 다(ADR-04) — 인격과 뒤집힌다. 다만 **loc 가 mj 보다 넓다.**
 *
 *   연출 전용 E.G.O 5건    Egos-a1c9p3.json · id 는 기본 id + "1" · 컷신 전용
 *   두 번째 각성 스킬 2건   mj 의 awakeningSkill 은 값이 하나뿐이다
 *                          2060812 오혈읍루-종 · 2120912 눈부시지 않은 영광-광휘
 *
 * E.G.O 스킬은 인격 스킬과 **구조가 다르다** — levelList[].coinlist[].coindescs[] 이고
 * 단계가 델타가 아니라 실제로 그 단계만 존재한다. 전량 전개하지 않는다.
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

export interface EgoSkillStageRow {
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

		// ── 스킬 — mj ∪ loc ────────────────────────────────────
		// mj 의 awakeningSkill 은 값이 하나뿐이라 두 번째 각성 스킬을 못 담는다.
		// loc 에서 이 E.G.O 로 시작하는 스킬 id 를 전부 찾아 보완한다.
		const mjAwaken = detail['awakeningSkill'];
		const mjCorrosion = detail['corrosionSkill'];
		const awakenIds = new Set<string>();
		if (mjAwaken !== null && mjAwaken !== undefined) awakenIds.add(String(mjAwaken));
		for (const locale of LOCALES) {
			for (const skillId of skillLoc[locale].keys()) {
				if (skillId.startsWith(id) && skillId.length === id.length + 2) awakenIds.add(skillId);
			}
		}
		const corrosionId =
			mjCorrosion === null || mjCorrosion === undefined ? null : String(mjCorrosion);
		if (corrosionId !== null) awakenIds.delete(corrosionId);

		[...awakenIds].sort().forEach((skillId, ordinal) => {
			t.egoSkill.push({ id: skillId, egoId: id, role: 'awakening', ordinal });
			pushSkillStages(t, skillLoc, skillId);
		});
		if (awakenIds.size > 1) {
			meta.source('ego', id, 'awakeningSkills', 'mj+loc', [MJ, LOC]);
		}
		if (corrosionId !== null) {
			t.egoSkill.push({ id: corrosionId, egoId: id, role: 'corrosion', ordinal: 0 });
			pushSkillStages(t, skillLoc, corrosionId);
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
 * 스킬 단계와 코인. **전량 전개하지 않는다** — E.G.O 스킬은 델타가 아니라
 * 실제로 그 단계만 존재한다(실측 1·3·4 가 주력이고 2·5 는 드물다).
 */
function pushSkillStages(t: EgoTables, skillLoc: Record<Loc, RawIndex>, skillId: string): void {
	const seen = new Set<number>();
	for (const locale of LOCALES) {
		const entry = skillLoc[locale].get(skillId);
		if (entry === undefined) continue;
		for (const raw of arr(entry, 'levelList')) {
			const l = obj(raw);
			const uptie = num(l, 'level');
			if (uptie === null) continue;
			if (!seen.has(uptie)) {
				seen.add(uptie);
				t.egoSkillStage.push({ skillId, uptie });
			}
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
				const effects = arr(obj(coinRaw), 'coindescs')
					.map((d) => str(obj(d), 'desc'))
					.filter((d): d is string => d !== null);
				if (effects.length === 0) return;
				t.egoSkillCoin.push({ skillId, uptie, index, locale, effects });
			});
		}
	}
}
