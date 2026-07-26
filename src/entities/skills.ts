/**
 * 스킬 · 코인 · 패시브.
 *
 * 정본 배정(ADR-04 2.1, 2026-07-26 정정)  limbus-assets
 *   수치(baseValue·coinValue·atkWeight·levelCorrection)와 코인 종류, 패시브 발동 조건이
 *   여기에만 있다. mj 는 텍스트와 코인 설명만 갖는다.
 * 허용 보강  limbus-data-mj — 한국어 스킬명·설명, 한국어 패시브명·설명
 *
 * 정본은 동기화 1→4 **델타**로 저장한다. 앞 단계부터 병합해야 최종값이 나온다.
 */
import { readJson, readJsonDir, readJsonGlob, toRecords, type DataList } from '../io.js';
import { stripMarkup, toDisplay } from '../text.js';
import type { Ctx } from './basics.js';

const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];

interface AssetCoin {
	descs?: string[];
	type?: string;
}

/** 동기화 단계 하나. 첫 단계만 전체이고 이후는 변경분만 담는다. */
interface AssetStage {
	uptie?: number;
	name?: string;
	desc?: string;
	affinity?: string;
	atkType?: string;
	defType?: string;
	atkWeight?: number;
	baseValue?: number;
	coinValue?: number;
	levelCorrection?: number;
	coins?: AssetCoin[];
}

interface AssetDetail {
	skills?: Record<string, { tier?: number; data?: AssetStage[] }>;
	passiveData?: Record<
		string,
		{
			name?: string;
			desc?: string;
			condition?: { type?: string; requirement?: Array<{ type?: string; value?: number }> };
		}
	>;
}

interface MjSkill {
	id: number;
	/** 분류값. 정본에도 있으나 정본에 스킬 자체가 없는 6종에서는 이것만이 유일한 출처다. */
	sin?: string;
	attackType?: string;
	defType?: string;
	skillTier?: number;
	levels?: Array<{
		level?: number;
		name?: string;
		nameKo?: string;
		desc?: string | null;
		descKo?: string | null;
	}>;
}

interface MjPassive {
	id: number;
	name?: string;
	nameKo?: string;
	desc?: string;
	descKo?: string;
}

/**
 * 로케일 파일의 스킬 텍스트. 코인 설명이 여기에만 한국어로 있다.
 *
 * 정본(limbus-assets)의 `coins[].descs` 는 영문뿐이라, 로케일 구분 없이 그것만 쓰면
 * `[OnSucceedAttackHead] Inflict 1 침잠` 처럼 영문에 상태명만 치환된 혼종이 나온다.
 * `(스킬 id, level, 코인 index)` 로 조인하면 정본의 코인 위치와 정확히 대응한다.
 */
interface LocSkill {
	id?: string | number;
	levelList?: Array<{
		level?: number;
		name?: string;
		desc?: string;
		coinlist?: Array<{ coindescs?: Array<{ desc?: string }> } | null>;
	}>;
}

/** `(skillId, level, coinIndex)` → 코인 설명 */
function collectCoinText(locale: 'loc-ko' | 'loc-en'): Map<string, string> {
	const out = new Map<string, string>();
	for (const file of readJsonGlob<DataList<LocSkill>>(['identities', locale], 'Skills')) {
		for (const entry of file.dataList ?? []) {
			if (entry.id === undefined || entry.id === null) continue;
			for (const level of entry.levelList ?? []) {
				(level.coinlist ?? []).forEach((coin, index) => {
					const desc = (coin?.coindescs ?? [])
						.map((d) => d.desc)
						.filter((d): d is string => Boolean(d))
						.join('\n');
					if (!desc) return;
					const key = `${entry.id}|${level.level ?? 1}|${index}`;
					if (!out.has(key)) out.set(key, desc);
				});
			}
		}
	}
	return out;
}

interface MjDetail {
	id: number;
	attackSkills?: Array<{ slot?: number; copies?: number; skillId?: number }>;
	defenseSkills?: number[];
	battlePassives?: Array<{ level?: number; passives?: number[] }>;
	supporterPassives?: Array<{ level?: number; passives?: number[] }>;
}

/** 스킬 하나의 출처와 내용. 정본에 없으면 보강 출처로 내려간다. */
interface SkillSource {
	identityId: number;
	tier: number | undefined;
	data: AssetStage[] | undefined;
	/** canonical 정본 · supplement 구버전 스냅샷 · metadata 수치 없이 분류만 */
	origin: 'canonical' | 'supplement' | 'metadata';
}

export function buildSkills(ctx: Ctx) {
	const details = readJsonDir<AssetDetail>('identity-details', 'limbus-assets');
	// 정본에 정의가 없는 스킬을 구버전 스냅샷에서 보강한다(ADR-04 2.3).
	// 겹치는 699 스킬 2,035 단계를 전수 대조해 수치 불일치 0 을 확인했으므로 값이 어긋나지 않는다.
	const supplement = readJsonDir<AssetDetail>('identity-details', 'shared-library');
	const coinTexts = { ko: collectCoinText('loc-ko'), en: collectCoinText('loc-en') };
	const mjSkills = new Map(
		toRecords(
			readJson<Record<string, MjSkill> | MjSkill[]>('identities', 'limbus-data-mj', 'skills.json'),
		).map((s) => [s.id, s]),
	);
	const mjPassives = new Map(
		toRecords(
			readJson<Record<string, MjPassive> | MjPassive[]>(
				'identities',
				'limbus-data-mj',
				'passives.json',
			),
		).map((p) => [p.id, p]),
	);
	const mjDetails = new Map(
		toRecords(
			readJson<Record<string, MjDetail> | MjDetail[]>(
				'identities',
				'limbus-data-mj',
				'identities_detail.json',
			),
		).map((d) => [d.id, d]),
	);

	const skill: Array<{
		id: number;
		identityId: number;
		deckCount: number;
		affinity: string | null;
		atkType: string | null;
		defType: string;
		tier: number;
	}> = [];
	const stage: Array<{
		skillId: number;
		uptie: number;
		baseValue: number;
		coinValue: number;
		atkWeight: number | null;
		levelCorrection: number | null;
	}> = [];
	const coin: Array<{ skillId: number; uptie: number; index: number; type: string }> = [];
	const stageText: Array<{
		skillId: number;
		uptie: number;
		locale: Locale;
		name: string;
		desc: string;
		descRaw: string;
	}> = [];
	const coinText: Array<{
		skillId: number;
		uptie: number;
		index: number;
		locale: Locale;
		desc: string;
		descRaw: string;
	}> = [];

	const passive: Array<{ id: string; condType: string | null }> = [];
	const passiveReq: Array<{ passiveId: string; index: number; type: string; value: number }> = [];
	const passiveText: Array<{
		passiveId: string;
		locale: Locale;
		name: string;
		desc: string;
		descRaw: string;
	}> = [];
	const identityPassive: Array<{
		identityId: number;
		passiveId: string;
		kind: string;
		uptie: number;
	}> = [];

	const seenPassive = new Set<string>();

	// ── 스킬 출처를 한 곳에 모은다. 정본 → 구버전 보강 → 분류만 순으로 내려간다. ──
	const skillSources = new Map<number, SkillSource>();
	const collect = (
		source: ReadonlyMap<string, AssetDetail>,
		origin: 'canonical' | 'supplement',
	): void => {
		for (const [fileKey, detail] of source) {
			const identityId = Number(fileKey);
			if (!Number.isFinite(identityId)) {
				ctx.report.unmapped('인격 상세 파일명이 id가 아님', fileKey);
				continue;
			}
			for (const [skillKey, entry] of Object.entries(detail.skills ?? {})) {
				const skillId = Number(skillKey);
				if (skillSources.has(skillId)) continue;
				skillSources.set(skillId, { identityId, tier: entry.tier, data: entry.data, origin });
			}
		}
	};
	collect(details, 'canonical');
	collect(supplement, 'supplement');

	// 배정되었으나 두 곳 모두에 정의가 없는 스킬. 수치는 어디에도 없고 분류만 있다.
	for (const detail of mjDetails.values()) {
		const assigned = [
			...(detail.attackSkills ?? []).map((s) => s.skillId),
			...(detail.defenseSkills ?? []),
		];
		for (const skillId of assigned) {
			if (skillId === undefined || skillSources.has(skillId)) continue;
			skillSources.set(skillId, {
				identityId: detail.id,
				tier: undefined,
				data: undefined,
				origin: 'metadata',
			});
		}
	}

	// 인격별 덱 매수는 보강 출처가 준다.
	const deckCounts = new Map<number, number>();
	for (const detail of mjDetails.values()) {
		for (const s of detail.attackSkills ?? []) {
			if (s.skillId !== undefined) deckCounts.set(s.skillId, s.copies ?? 0);
		}
	}

	// id 오름차순으로 돌아 산출 순서를 고정한다.
	for (const skillId of [...skillSources.keys()].sort((a, b) => a - b)) {
		const source = skillSources.get(skillId);
		if (source === undefined) continue;
		const { identityId, origin } = source;
		const stages = source.data ?? [];
		const base = stages[0];

		if (base === undefined) {
			// 수치가 없다. 분류만 담고 단계는 만들지 않는다 — 0 으로 채우면 없는 값을 지어내는 것이다.
			const meta = mjSkills.get(skillId);
			if (meta === undefined) {
				ctx.report.unmapped('스킬 정의를 어느 출처에서도 못 찾음', String(skillId), String(identityId));
				continue;
			}
			skill.push({
				id: skillId,
				identityId,
				deckCount: deckCounts.get(skillId) ?? 0,
				affinity: meta.sin && meta.sin !== 'none' ? meta.sin : null,
				atkType: meta.attackType ?? null,
				defType: meta.defType ?? 'attack',
				tier: meta.skillTier ?? 1,
			});
			ctx.report.note('스킬 수치가 어느 출처에도 없음(분류만 적재)', String(skillId), String(identityId));
			continue;
		}

		if (origin === 'supplement') {
			ctx.report.note('스킬 정의를 구버전 스냅샷에서 보강', String(skillId), String(identityId));
		}

		skill.push({
			id: skillId,
			identityId,
			// 방어 스킬과 조건부 스킬은 덱 매수가 없다. 0 으로 둔다.
			deckCount: deckCounts.get(skillId) ?? 0,
			// 원본이 `none` 으로 표기하는 스킬이 131건 있다. 열거값이 아니므로 null 로 둔다.
			affinity: base.affinity && base.affinity !== 'none' ? base.affinity : null,
			atkType: base.atkType ?? null,
			defType: base.defType ?? 'attack',
			tier: source.tier ?? 1,
		});

		// 델타 병합 — 앞 단계 값을 이어받고 이번 단계에 있는 것만 덮어쓴다.
		let merged: AssetStage = {};
		for (const delta of stages) {
			merged = { ...merged, ...delta };
			const uptie = delta.uptie ?? merged.uptie ?? 1;

			stage.push({
				skillId,
				uptie,
				baseValue: merged.baseValue ?? 0,
				coinValue: merged.coinValue ?? 0,
				atkWeight: merged.atkWeight ?? null,
				levelCorrection: merged.levelCorrection ?? null,
			});

			// 보강 출처는 **변경된 단계만** 담는다. 없는 단계는 앞 단계 값을 이어받아야 한다.
			// 이월하지 않으면 중간 단계만 영문으로 튄다.
			const levels = mjSkills.get(skillId)?.levels ?? [];
			const mjLevel = levels.reduce<(typeof levels)[number] | undefined>(
				(carried, l) => ((l.level ?? 0) <= uptie ? l : carried),
				undefined,
			);
			for (const locale of LOCALES) {
				const rawName = (locale === 'ko' ? mjLevel?.nameKo : mjLevel?.name) ?? merged.name ?? '';
				const rawDesc =
					(locale === 'ko' ? mjLevel?.descKo : mjLevel?.desc) ?? merged.desc ?? '';
				// 한국어가 없으면 정본의 영문이 그대로 나간다(ADR-03 5절). 결손이므로 눈에 보이게 남긴다.
				if (locale === 'ko' && !mjLevel?.nameKo) {
					ctx.report.note(
						rawName ? '스킬 이름 한국어 없음(영문 유지)' : '스킬 이름이 어느 출처에도 없음',
						String(skillId),
						`동기화 ${uptie}`,
					);
				}
				stageText.push({
					skillId,
					uptie,
					locale,
					name: stripMarkup(rawName),
					desc: toDisplay(rawDesc, ctx.triggers[locale], ctx.report, `skill:${skillId}`),
					descRaw: rawDesc,
				});
			}

			(merged.coins ?? []).forEach((c, index) => {
				coin.push({ skillId, uptie, index, type: c.type ?? 'normal' });
				const fallback = (c.descs ?? []).join('\n');
				for (const locale of LOCALES) {
					// 로케일 파일도 변경된 단계만 담으므로 uptie 이하에서 가장 가까운 단계를 찾는다.
					let rawDesc = '';
					for (let level = uptie; level >= 1; level -= 1) {
						const hit = coinTexts[locale].get(`${skillId}|${level}|${index}`);
						if (hit !== undefined) {
							rawDesc = hit;
							break;
						}
					}
					if (!rawDesc) {
						rawDesc = fallback;
						if (locale === 'ko' && fallback) {
							ctx.report.note('코인 한국어 없음(영문 유지)', String(skillId));
						}
					}
					coinText.push({
						skillId,
						uptie,
						index,
						locale,
						desc: toDisplay(rawDesc, ctx.triggers[locale], ctx.report, `coin:${skillId}`),
						descRaw: rawDesc,
					});
				}
			});
		}
	}

	// ── 패시브. 정본에 없는 것은 구버전 스냅샷에서 보강한다. ──
	for (const source of [details, supplement]) {
		for (const detail of source.values()) {
			for (const [passiveKey, entry] of Object.entries(detail.passiveData ?? {})) {
				if (seenPassive.has(passiveKey)) continue;
				seenPassive.add(passiveKey);
				passive.push({ id: passiveKey, condType: entry.condition?.type ?? null });
				(entry.condition?.requirement ?? []).forEach((req, index) => {
					passiveReq.push({
						passiveId: passiveKey,
						index,
						type: req.type ?? '',
						value: req.value ?? 0,
					});
				});
				const mjPassive = mjPassives.get(Number(passiveKey));
				for (const locale of LOCALES) {
					const rawName =
						(locale === 'ko' ? mjPassive?.nameKo : mjPassive?.name) ?? entry.name ?? '';
					const rawDesc =
						(locale === 'ko' ? mjPassive?.descKo : mjPassive?.desc) ?? entry.desc ?? '';
					passiveText.push({
						passiveId: passiveKey,
						locale,
						name: stripMarkup(rawName),
						desc: toDisplay(rawDesc, ctx.triggers[locale], ctx.report, `passive:${passiveKey}`),
						descRaw: rawDesc,
					});
				}
			}
		}
	}

	// 인격–패시브는 해금 단계를 함께 담는다. 어휘가 숫자 id 라 보강 출처를 그대로 쓴다.
	for (const detail of mjDetails.values()) {
		for (const [kind, groups] of [
			['combat', detail.battlePassives ?? []],
			['support', detail.supporterPassives ?? []],
		] as const) {
			for (const group of groups) {
				for (const passiveId of group.passives ?? []) {
					identityPassive.push({
						identityId: detail.id,
						passiveId: String(passiveId),
						kind,
						uptie: group.level ?? 1,
					});
				}
			}
		}
	}

	/**
	 * 정본에 정의가 없는 패시브를 처리한다.
	 *
	 * **보강 출처가 스킬을 패시브로 잘못 올린 건이 있다.** 실측 16건(고유 6종)이 전부
	 * 다음 세 조건을 동시에 만족한다 — 정본에 패시브 정의가 없고, mj `passives.json` 의
	 * 항목이 이름·설명이 모두 null 인 껍데기이며, **같은 인격의 정본 스킬 id 다.**
	 * 예를 들어 1011003 은 인격 10110 의 3번 공격 스킬이지 패시브가 아니다.
	 * 이것을 받아들이면 이름 없는 패시브 6종을 지어내게 되므로 링크째 버리고 보고한다.
	 *
	 * 껍데기가 아닌 진짜 보강은 규칙(ADR-04 2.3)대로 받는다. 현행 스냅샷에는 해당 건이 없다.
	 */
	const known = new Set(passive.map((p) => p.id));
	const rejected = new Set<string>();
	for (const row of identityPassive) {
		if (known.has(row.passiveId)) continue;
		const mjPassive = mjPassives.get(Number(row.passiveId));
		const isStub =
			mjPassive !== undefined &&
			!mjPassive.name &&
			!mjPassive.nameKo &&
			!mjPassive.desc &&
			!mjPassive.descKo;
		if (isStub && skillSources.get(Number(row.passiveId))?.identityId === row.identityId) {
			if (!rejected.has(row.passiveId)) {
				rejected.add(row.passiveId);
				ctx.report.note(
					'보강 출처가 스킬을 패시브로 등재(링크 버림)',
					row.passiveId,
					String(row.identityId),
				);
			}
			continue;
		}
		if (mjPassive === undefined || isStub) {
			ctx.report.unmapped('패시브 정의를 어느 출처에서도 못 찾음', row.passiveId, String(row.identityId));
			continue;
		}
		known.add(row.passiveId);
		passive.push({ id: row.passiveId, condType: null });
		for (const locale of LOCALES) {
			const rawName = (locale === 'ko' ? mjPassive.nameKo : mjPassive.name) ?? '';
			const rawDesc = (locale === 'ko' ? mjPassive.descKo : mjPassive.desc) ?? '';
			passiveText.push({
				passiveId: row.passiveId,
				locale,
				name: stripMarkup(rawName),
				desc: toDisplay(rawDesc, ctx.triggers[locale], ctx.report, `passive:${row.passiveId}`),
				descRaw: rawDesc,
			});
		}
		ctx.report.note('패시브 정의가 보강 출처에만 있음(발동 조건 없음)', row.passiveId);
	}
	// 배정된 스킬이 하나도 빠지지 않았는지 확인한다. 이제 정본·보강·분류 셋을 다 훑으므로
	// 여기서 걸리는 것이 있으면 어느 출처에도 없다는 뜻이다.
	const built = new Set(skill.map((s) => s.id));
	for (const detail of mjDetails.values()) {
		const assigned = [
			...(detail.attackSkills ?? []).map((s) => s.skillId),
			...(detail.defenseSkills ?? []),
		];
		for (const skillId of assigned) {
			if (skillId === undefined || built.has(skillId)) continue;
			ctx.report.unmapped('배정된 스킬을 어느 출처에서도 못 찾음', String(skillId), String(detail.id));
		}
	}

	// 같은 패시브가 여러 단계에 중복 등재된다. 열쇠는 (인격, 패시브, 종류)이고
	// 의미상 값은 **해금되는 가장 이른 단계**이므로 최소값으로 접는다.
	const folded = new Map<string, (typeof identityPassive)[number]>();
	for (const row of identityPassive) {
		if (!known.has(row.passiveId)) continue;
		const key = `${row.identityId}|${row.passiveId}|${row.kind}`;
		const seen = folded.get(key);
		if (seen === undefined || row.uptie < seen.uptie) folded.set(key, row);
	}
	const linked = [...folded.values()];

	ctx.report.rows('skill', skill.length);
	ctx.report.rows('skill_stage', stage.length);
	ctx.report.rows('skill_coin', coin.length);
	ctx.report.rows('skill_stage_text', stageText.length);
	ctx.report.rows('skill_coin_text', coinText.length);
	ctx.report.rows('passive', passive.length);
	ctx.report.rows('passive_requirement', passiveReq.length);
	ctx.report.rows('passive_text', passiveText.length);
	ctx.report.rows('identity_passive', linked.length);

	return {
		skill,
		stage,
		coin,
		stageText,
		coinText,
		passive,
		passiveReq,
		passiveText,
		identityPassive: linked,
	};
}
