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
import { readJson, readJsonDir, toRecords } from '../io.js';
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

interface MjDetail {
	id: number;
	attackSkills?: Array<{ slot?: number; copies?: number; skillId?: number }>;
	defenseSkills?: number[];
	battlePassives?: Array<{ level?: number; passives?: number[] }>;
	supporterPassives?: Array<{ level?: number; passives?: number[] }>;
}

export function buildSkills(ctx: Ctx) {
	const details = readJsonDir<AssetDetail>('identity-details', 'limbus-assets');
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

	for (const [fileKey, detail] of details) {
		const identityId = Number(fileKey);
		if (!Number.isFinite(identityId)) {
			ctx.report.unmapped('인격 상세 파일명이 id가 아님', fileKey);
			continue;
		}
		const mjDetail = mjDetails.get(identityId);
		const deckCounts = new Map<number, number>();
		for (const s of mjDetail?.attackSkills ?? []) {
			if (s.skillId !== undefined) deckCounts.set(s.skillId, s.copies ?? 0);
		}

		for (const [skillKey, entry] of Object.entries(detail.skills ?? {})) {
			const skillId = Number(skillKey);
			const stages = entry.data ?? [];
			const base = stages[0];
			if (base === undefined) {
				ctx.report.unmapped('스킬에 동기화 단계가 없음', skillKey, String(identityId));
				continue;
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
				tier: entry.tier ?? 1,
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
					stageText.push({
						skillId,
						uptie,
						locale,
						name: stripMarkup(rawName),
						desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `skill:${skillId}`),
						descRaw: rawDesc,
					});
				}

				(merged.coins ?? []).forEach((c, index) => {
					coin.push({ skillId, uptie, index, type: c.type ?? 'normal' });
					for (const locale of LOCALES) {
						const rawDesc = (c.descs ?? []).join('\n');
						coinText.push({
							skillId,
							uptie,
							index,
							locale,
							desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `coin:${skillId}`),
							descRaw: rawDesc,
						});
					}
				});
			}
		}

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
				const rawName = (locale === 'ko' ? mjPassive?.nameKo : mjPassive?.name) ?? entry.name ?? '';
				const rawDesc = (locale === 'ko' ? mjPassive?.descKo : mjPassive?.desc) ?? entry.desc ?? '';
				passiveText.push({
					passiveId: passiveKey,
					locale,
					name: stripMarkup(rawName),
					desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `passive:${passiveKey}`),
					descRaw: rawDesc,
				});
			}
		}

		// 인격–패시브는 해금 단계를 함께 담는다. 정본 파일명이 인격 id 이므로 mj 를 쓴다.
		for (const [kind, groups] of [
			['combat', mjDetail?.battlePassives ?? []],
			['support', mjDetail?.supporterPassives ?? []],
		] as const) {
			for (const group of groups) {
				for (const passiveId of group.passives ?? []) {
					identityPassive.push({
						identityId,
						passiveId: String(passiveId),
						kind,
						uptie: group.level ?? 1,
					});
				}
			}
		}
	}

	// 정본에 정의가 없고 보강 출처에만 있는 패시브가 6종 있다. 정본에 없는 것은 보강으로
	// 채운다는 규칙(ADR-04 2.3)대로 이름과 설명만 받아 넣는다. 발동 조건은 정본에만 있으므로 빈다.
	const known = new Set(passive.map((p) => p.id));
	for (const row of identityPassive) {
		if (known.has(row.passiveId)) continue;
		const mjPassive = mjPassives.get(Number(row.passiveId));
		if (mjPassive === undefined) {
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
				desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `passive:${row.passiveId}`),
				descRaw: rawDesc,
			});
		}
		ctx.report.note('패시브 정의가 보강 출처에만 있음(발동 조건 없음)', row.passiveId);
	}
	// 정본에 정의가 없는 스킬은 집합에서 빠질 뿐 아니라 리포트에도 안 남는다.
	// 보강 출처가 인격에 배정한 스킬과 대조해 그 차이를 드러낸다.
	const built = new Set(skill.map((s) => s.id));
	for (const detail of mjDetails.values()) {
		const assigned = [
			...(detail.attackSkills ?? []).map((s) => s.skillId),
			...(detail.defenseSkills ?? []),
		];
		for (const skillId of assigned) {
			if (skillId === undefined || built.has(skillId)) continue;
			ctx.report.unmapped('인격에 배정된 스킬이 정본에 없음', String(skillId), String(detail.id));
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
