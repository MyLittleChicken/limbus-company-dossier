/**
 * 수감자와 인격.
 *
 * 정본 배정(ADR-04 2.1)  limbus-data-mj
 *   identities.json 과 identities_detail.json 이 limbus-assets 의 인격 필드를 모두 덮고
 *   한국어를 인라인으로 갖는다.
 *
 * 관계의 정본(ADR-04 2.2)  limbus-assets
 *   인격–소속과 인격–상태는 mj 에도 있으나 **어휘 체계가 다르다.**
 *   mj 는 `LIMBUS_COMPANY_LCB` · `sinking` 을 쓰고, 우리 테이블은 `Limbus Company` ·
 *   `AttackDmgUp` 을 요구한다. 어휘의 정본인 limbus-assets 에서 가져온다.
 */
import { readJson, toRecords } from '../io.js';
import { stripMarkup, toIsoDate } from '../text.js';
import type { Ctx } from './basics.js';

const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];
const ATK_TYPES = ['slash', 'pierce', 'blunt'] as const;
/** 동기화 단계는 1–4다. 속도 배열의 길이와 대응한다. */
const UPTIES = [1, 2, 3, 4] as const;

interface MjIdentity {
	id: number;
	sinnerId: number;
	/** 게임 표기 0 / 00 / 000 에 대응하는 1–3. 실측 분포 1:12 · 2:51 · 3:121 */
	star: number;
	season?: number;
	updatedDate: number;
	/** 수감자명이다. 인격명은 title 이다 */
	name: string;
	nameKo?: string;
	title: string;
	titleKo?: string;
}

interface MjDetail {
	id: number;
	hp?: { defaultStat?: number; incrementByLevel?: number };
	defCorrection?: number;
	minSpeed?: number[];
	maxSpeed?: number[];
	resists?: Record<string, number>;
	stagger?: number[];
}

interface AssetIdentity {
	tags?: string[];
	statuses?: string[];
	/** 정본에 `season` 이 없는 2종을 채우는 데 쓴다(ADR-04 2.3 보강). */
	season?: number;
}

export function buildIdentities(ctx: Ctx) {
	const mjList = toRecords(
		readJson<MjIdentity[] | Record<string, MjIdentity>>(
			'identities',
			'limbus-data-mj',
			'identities.json',
		),
	);
	const details = new Map(
		toRecords(
			readJson<MjDetail[] | Record<string, MjDetail>>(
				'identities',
				'limbus-data-mj',
				'identities_detail.json',
			),
		).map((d) => [d.id, d]),
	);
	const assets = readJson<Record<string, AssetIdentity>>(
		'identities',
		'limbus-assets',
		'identities.json',
	);
	const affiliationIds = new Set(
		readJson<string[]>('identities', 'limbus-assets', 'identity_tag_list.json')
			.map(stripMarkup)
			.filter(Boolean),
	);
	const statusIds = new Set(
		Object.keys(readJson<Record<string, unknown>>('mechanics', 'limbus-assets', 'statuses.json')),
	);

	const sinner = new Map<number, { name: string; nameKo: string }>();
	const identity: Array<{
		id: number;
		sinnerId: number;
		rarity: number;
		season: number;
		releaseDate: string | null;
		hpBase: number;
		hpPerLevel: number;
		defCorrection: number;
		breakSection: number[];
	}> = [];
	const identityText: Array<{ identityId: number; locale: Locale; name: string }> = [];
	const resists: Array<{ identityId: number; atkType: string; value: number }> = [];
	const speeds: Array<{ identityId: number; uptie: number; min: number; max: number }> = [];
	const affiliations: Array<{ identityId: number; affiliationId: string }> = [];
	const statuses: Array<{ identityId: number; statusId: string }> = [];

	for (const m of mjList) {
		const detail = details.get(m.id);
		if (detail === undefined) {
			ctx.report.unmapped('인격 상세 없음', String(m.id), m.title);
			continue;
		}

		if (!sinner.has(m.sinnerId)) {
			sinner.set(m.sinnerId, { name: m.name, nameKo: m.nameKo ?? m.name });
		}

		const releaseDate = toIsoDate(m.updatedDate);
		if (releaseDate === null) ctx.report.unmapped('출시일 형식 불명', String(m.updatedDate), String(m.id));

		// 정본에 season 이 없는 인격이 2종 있다. 보강 출처에서 받는다.
		const asset = assets[String(m.id)];
		const fallbackSeason = asset?.season;
		if (m.season === undefined || m.season === null) {
			if (fallbackSeason === undefined) {
				ctx.report.unmapped('시즌을 어느 출처에서도 못 찾음', String(m.id), m.title);
				continue;
			}
			ctx.report.note('시즌이 보강 출처에만 있음', String(m.id), m.title);
		}
		const season: number = m.season ?? fallbackSeason ?? 0;

		identity.push({
			id: m.id,
			sinnerId: m.sinnerId,
			rarity: m.star,
			season,
			releaseDate,
			hpBase: detail.hp?.defaultStat ?? 0,
			hpPerLevel: detail.hp?.incrementByLevel ?? 0,
			defCorrection: detail.defCorrection ?? 0,
			breakSection: detail.stagger ?? [],
		});

		// 인격명은 title 이다. name 은 수감자명이라 여기 쓰면 안 된다.
		identityText.push({ identityId: m.id, locale: 'ko', name: stripMarkup(m.titleKo ?? m.title) });
		identityText.push({ identityId: m.id, locale: 'en', name: stripMarkup(m.title) });

		for (const atkType of ATK_TYPES) {
			const value = detail.resists?.[atkType];
			if (value === undefined) {
				ctx.report.unmapped('인격 저항 결손', atkType, String(m.id));
				continue;
			}
			resists.push({ identityId: m.id, atkType, value });
		}

		for (const uptie of UPTIES) {
			const min = detail.minSpeed?.[uptie - 1];
			const max = detail.maxSpeed?.[uptie - 1];
			if (min === undefined || max === undefined) continue;
			speeds.push({ identityId: m.id, uptie, min, max });
		}

		// 관계는 어휘의 정본에서 가져온다(ADR-04 2.2).
		for (const raw of asset?.tags ?? []) {
			const affiliationId = stripMarkup(raw);
			if (!affiliationId) continue;
			if (!affiliationIds.has(affiliationId)) {
				ctx.report.unmapped('소속 태그가 목록에 없음', affiliationId, String(m.id));
				continue;
			}
			affiliations.push({ identityId: m.id, affiliationId });
		}
		for (const statusId of asset?.statuses ?? []) {
			if (!statusIds.has(statusId)) {
				ctx.report.unmapped('인격 상태가 상태 목록에 없음', statusId, String(m.id));
				continue;
			}
			statuses.push({ identityId: m.id, statusId });
		}
	}

	const sinnerRows = [...sinner.keys()].sort((a, b) => a - b).map((id) => ({ id }));
	const sinnerText: Array<{ sinnerId: number; locale: Locale; name: string }> = [];
	for (const [id, names] of [...sinner.entries()].sort((a, b) => a[0] - b[0])) {
		sinnerText.push({ sinnerId: id, locale: 'ko', name: names.nameKo });
		sinnerText.push({ sinnerId: id, locale: 'en', name: names.name });
	}

	ctx.report.rows('sinner', sinnerRows.length);
	ctx.report.rows('sinner_text', sinnerText.length);
	ctx.report.rows('identity', identity.length);
	ctx.report.rows('identity_text', identityText.length);
	ctx.report.rows('identity_resist', resists.length);
	ctx.report.rows('identity_speed', speeds.length);
	ctx.report.rows('identity_affiliation', affiliations.length);
	ctx.report.rows('identity_status', statuses.length);

	return {
		sinner: sinnerRows,
		sinnerText,
		identity,
		identityText,
		resists,
		speeds,
		affiliations,
		statuses,
	};
}
