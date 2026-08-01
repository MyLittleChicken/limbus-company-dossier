/**
 * 인격 184종과 패시브 709종, 그리고 연결 다섯 갈래.
 *
 * 인격은 mj 와 assets 가 **완전히 같은 집합**이다(교집합 184 · 차집합 0).
 * 필드마다 정본이 갈린다 — 구조는 mj, 수치는 assets, 표시 문자열은 loc.
 *
 * 저항은 물리 3축(slash · pierce · blunt)이다. E.G.O 는 죄악 7축, 적은 10축이라
 * 계열마다 축이 다르다(`docs/09-resistance.md`).
 */
import { arr, bool, num, str, strArr, type RawIndex } from '../source.js';
import { keywordIdOf } from './vocab.js';
import { descOf } from './markup.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const EVIDENCE = 'docs/data/identity/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

const ATK_TYPES = ['slash', 'pierce', 'blunt'] as const;

export interface IdentityInput {
	mj: RawIndex;
	mjDetail: RawIndex;
	assets: RawIndex;
	mjPassives: RawIndex;
	locKo: RawIndex;
	locEn: RawIndex;
	locJa: RawIndex;
	passiveKo: RawIndex;
	passiveEn: RawIndex;
	passiveJa: RawIndex;
	knownSkills: Set<string>;
	knownAssociations: Set<string>;
	knownKeywords: Set<string>;
	/** canonical.status 에 실제로 있는 id. 계획 6에서 이어진다 */
	knownStatuses: Set<string>;
	keywordDict: Map<string, string>;
}

export interface IdentityRow {
	id: string;
	sinnerId: number;
	star: number;
	teamCodeEligible: boolean;
	season: number | null;
	hp: number | null;
	stagger: number[];
	defCorrection: number | null;
	releaseDate: string | null;
}

export interface IdentityTextRow {
	identityId: string;
	locale: Loc;
	name: string;
	title: string | null;
}

export interface IdentityResistRow {
	identityId: string;
	atkType: string;
	value: number;
}

export interface IdentitySpeedRow {
	identityId: string;
	min: number;
	max: number;
}

export interface IdentitySkillRow {
	identityId: string;
	skillId: string;
	role: string;
	ordinal: number;
	slot: number | null;
	copies: number | null;
}

export interface IdentityPassiveRow {
	identityId: string;
	passiveId: string;
	role: string;
	level: number;
}

export interface IdentityAssociationRow {
	identityId: string;
	associationId: string;
}

export interface IdentityKeywordRow {
	identityId: string;
	keywordId: string;
	skillSlots: number[];
}

export interface IdentityUnitKeywordRow {
	identityId: string;
	keyword: string;
}

export interface IdentityStatusRow {
	identityId: string;
	statusId: string;
}

export interface PassiveRow {
	id: string;
	conditions: string[];
}

export interface PassiveTextRow {
	passiveId: string;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
}

export interface IdentityTables {
	identity: IdentityRow[];
	identityText: IdentityTextRow[];
	identityResist: IdentityResistRow[];
	identitySpeed: IdentitySpeedRow[];
	identitySkill: IdentitySkillRow[];
	identityPassive: IdentityPassiveRow[];
	identityAssociation: IdentityAssociationRow[];
	identityKeyword: IdentityKeywordRow[];
	identityUnitKeyword: IdentityUnitKeywordRow[];
	identityStatus: IdentityStatusRow[];
	passive: PassiveRow[];
	passiveText: PassiveTextRow[];
}

export function buildIdentities(input: IdentityInput, meta: Meta): IdentityTables {
	const t: IdentityTables = {
		identity: [],
		identityText: [],
		identityResist: [],
		identitySpeed: [],
		identitySkill: [],
		identityPassive: [],
		identityAssociation: [],
		identityKeyword: [],
		identityUnitKeyword: [],
		identityStatus: [],
		passive: [],
		passiveText: [],
	};

	const locByName: Record<Loc, RawIndex> = { ko: input.locKo, en: input.locEn, ja: input.locJa };
	const passiveLoc: Record<Loc, RawIndex> = {
		ko: input.passiveKo,
		en: input.passiveEn,
		ja: input.passiveJa,
	};

	// ── 패시브 ───────────────────────────────────────────────────
	// 이름이 전부 null 인 6건이 마스터북의 「유령」이다. 적재하되 결손으로 남긴다.
	for (const [id, p] of input.mjPassives) {
		// 원본 필드명은 cost 이지만 발동 조건 코드 배열이다 (CheckAwakenLevel4 등)
		t.passive.push({ id, conditions: strArr(p, 'cost') });
		let any = false;
		for (const locale of LOCALES) {
			const loc = passiveLoc[locale].get(id) ?? {};
			const mjName = locale === 'ko' ? str(p, 'nameKo') : locale === 'en' ? str(p, 'name') : null;
			const mjDesc = locale === 'ko' ? str(p, 'descKo') : locale === 'en' ? str(p, 'desc') : null;
			const name = str(loc, 'name') ?? mjName;
			if (name === null) continue;
			any = true;
			t.passiveText.push({
				passiveId: id,
				locale,
				name,
				...descOf(str(loc, 'desc') ?? mjDesc),
			});
		}
		if (!any) {
			meta.gap(
				'passive',
				id,
				'name',
				'이름이 어느 출처에도 없다 — 마스터북의 「유령」 (회차 4·10·13 세 번 확인)',
				EVIDENCE,
			);
		} else {
			meta.source('passive', id, 'name', 'mj+loc', [MJ, 'loc-ko/en/ja']);
		}
	}

	// ── 인격 ────────────────────────────────────────────────────
	for (const [id, mj] of input.mj) {
		const detail = input.mjDetail.get(id) ?? {};
		const a = input.assets.get(id) ?? {};

		const sinnerId = num(mj, 'sinnerId');
		const star = num(mj, 'star');
		if (sinnerId === null || star === null) {
			meta.gap('identity', id, 'core', 'sinnerId 나 star 가 없다', EVIDENCE);
			continue;
		}

		// hp 는 mj 가 정수, assets 는 {base, level} 이다. mj 를 쓴다.
		const hpAssets = a['hp'];
		const hpBase =
			typeof hpAssets === 'object' && hpAssets !== null && !Array.isArray(hpAssets)
				? num(hpAssets as Record<string, unknown>, 'base')
				: null;
		const hp = num(mj, 'hp') ?? hpBase;

		t.identity.push({
			id,
			sinnerId,
			star,
			teamCodeEligible: bool(mj, 'teamCodeEligible'),
			season: num(mj, 'season'),
			hp,
			// 흐트러짐 구간 임계값 배열이다 — [65, 35, 15]. 스칼라가 아니다
			stagger: arr(mj, 'stagger')
				.map((v) => Number(v))
				.filter((v) => Number.isFinite(v)),
			defCorrection: num(detail, 'defCorrection') ?? num(a, 'defCorrection'),
			releaseDate: str(a, 'date'),
		});
		meta.source('identity', id, 'core', 'mj-only', [MJ]);
		if (str(a, 'date') !== null) meta.source('identity', id, 'releaseDate', 'assets-only', [ASSETS]);

		// ── 표시 문자열 — loc 우선, mj 폴백 ─────────────────────
		for (const locale of LOCALES) {
			const loc = locByName[locale].get(id) ?? {};
			const mjName = locale === 'ko' ? str(mj, 'nameKo') : locale === 'en' ? str(mj, 'name') : null;
			const mjTitle =
				locale === 'ko' ? str(mj, 'titleKo') : locale === 'en' ? str(mj, 'title') : null;
			const name = str(loc, 'name') ?? mjName;
			if (name === null) {
				meta.gap('identity', id, 'name', `${locale} 표시명이 어느 출처에도 없다`, EVIDENCE, locale);
				continue;
			}
			t.identityText.push({ identityId: id, locale, name, title: str(loc, 'title') ?? mjTitle });
		}

		// ── 저항 3축 ────────────────────────────────────────────
		const resists = mj['resists'];
		if (typeof resists === 'object' && resists !== null && !Array.isArray(resists)) {
			const r = resists as Record<string, unknown>;
			for (const atkType of ATK_TYPES) {
				const value = num(r, atkType);
				if (value === null) {
					meta.gap('identity', id, `resist.${atkType}`, '저항 값이 없다', EVIDENCE);
					continue;
				}
				t.identityResist.push({ identityId: id, atkType, value });
			}
			meta.source('identity', id, 'resists', 'mj-only', [MJ]);
		}

		// ── 속도 ───────────────────────────────────────────────
		const speed = arr(mj, 'speed');
		if (speed.length === 2) {
			const min = Number(speed[0]);
			const max = Number(speed[1]);
			if (Number.isFinite(min) && Number.isFinite(max)) {
				t.identitySpeed.push({ identityId: id, min, max });
			}
		}

		// ── 스킬 연결 ───────────────────────────────────────────
		// 공격 스킬은 {slot, copies, skillId} 라 덱 구성 정보를 함께 갖는다.
		// 방어·패닉은 평평한 id 다.
		let droppedSkills = 0;
		const pushSkill = (
			role: string,
			ordinal: number,
			skillId: string,
			slot: number | null,
			copies: number | null,
		): void => {
			if (!input.knownSkills.has(skillId)) {
				droppedSkills += 1;
				return;
			}
			t.identitySkill.push({ identityId: id, skillId, role, ordinal, slot, copies });
		};

		arr(detail, 'attackSkills').forEach((raw, ordinal) => {
			if (typeof raw !== 'object' || raw === null) {
				pushSkill('attack', ordinal, String(raw), null, null);
				return;
			}
			const o = raw as Record<string, unknown>;
			const skillId = o['skillId'];
			if (skillId === undefined || skillId === null) return;
			pushSkill('attack', ordinal, String(skillId), num(o, 'slot'), num(o, 'copies'));
		});
		strArr(detail, 'defenseSkills').forEach((skillId, ordinal) => {
			pushSkill('defense', ordinal, skillId, null, null);
		});
		const panic = detail['panicSkill'];
		if (panic !== undefined && panic !== null) pushSkill('panic', 0, String(panic), null, null);

		if (droppedSkills > 0) {
			meta.gap('identity', id, 'skills', `스킬 목록에 없는 id 를 ${droppedSkills}건 가리킨다`, EVIDENCE);
		}

		// ── 패시브 연결 ─────────────────────────────────────────
		// 원본이 {level, passives:[id]} 라 공명 요구 레벨을 함께 담는다.
		let droppedPassives = 0;
		for (const [role, key] of [
			['battle', 'battlePassives'],
			['supporter', 'supporterPassives'],
		] as const) {
			for (const group of arr(detail, key)) {
				if (typeof group !== 'object' || group === null) continue;
				const g = group as Record<string, unknown>;
				const level = num(g, 'level') ?? 0;
				for (const passiveId of strArr(g, 'passives')) {
					if (!input.mjPassives.has(passiveId)) {
						droppedPassives += 1;
						continue;
					}
					t.identityPassive.push({ identityId: id, passiveId, role, level });
				}
			}
		}
		if (droppedPassives > 0) {
			meta.gap('identity', id, 'passives', `패시브 목록에 없는 id 를 ${droppedPassives}건 가리킨다`, EVIDENCE);
		}

		// ── 소속 ───────────────────────────────────────────────
		for (const associationId of strArr(mj, 'associations')) {
			if (!input.knownAssociations.has(associationId)) {
				meta.gap('identity', id, 'associations', `소속 목록에 없는 코드 ${associationId}`, EVIDENCE);
				continue;
			}
			t.identityAssociation.push({ identityId: id, associationId });
		}

		// ── 기믹 키워드 — 기프트와 같은 어휘를 쓴다 ────────────────
		const keywordSkills = mj['keywordSkills'];
		const ks =
			typeof keywordSkills === 'object' && keywordSkills !== null && !Array.isArray(keywordSkills)
				? (keywordSkills as Record<string, unknown>)
				: {};
		for (const raw of strArr(mj, 'keywords')) {
			const keywordId = keywordIdOf(raw, input.keywordDict);
			if (keywordId === null || !input.knownKeywords.has(keywordId)) {
				meta.gap('identity', id, 'keywords', `키워드 "${raw}" 가 사전에 없다`, EVIDENCE);
				continue;
			}
			const slots = arr(ks, raw)
				.map((v) => Number(v))
				.filter((v) => Number.isFinite(v));
			t.identityKeyword.push({ identityId: id, keywordId, skillSlots: slots });
		}

		// ── 특성 키워드 — 소속과 별개 축이다(backlog/01) ───────────
		for (const keyword of strArr(detail, 'unitKeywords')) {
			t.identityUnitKeyword.push({ identityId: id, keyword });
		}

		// ── 다루는 상태 — 계획 6에서 이어진 연결. 실측 100 % 걸린다 ──
		let droppedStatuses = 0;
		for (const statusId of new Set(strArr(a, 'statuses'))) {
			if (!input.knownStatuses.has(statusId)) {
				droppedStatuses += 1;
				continue;
			}
			t.identityStatus.push({ identityId: id, statusId });
		}
		if (droppedStatuses > 0) {
			meta.gap('identity', id, 'statuses', `상태 목록에 없는 id 를 ${droppedStatuses}건 가리킨다`, EVIDENCE);
		}
	}

	return t;
}
