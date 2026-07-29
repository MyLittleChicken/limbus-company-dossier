import type { Locale } from '@prisma/client';
import { db } from '@/lib/db';
import { localeFilter, nameOf, textOf } from '@/lib/queries/shared';
import type { Availability, PackCandidate } from './pack';
import type { Gift, Identity } from './state';
import { mapEffect, mapTrigger, refineAffiliation, statusKeyOf, type Condition, type StatusKey } from './vocab';

/**
 * 데이터베이스 → 엔진 입력.
 *
 * 엔진은 파일이 아니라 적재된 데이터를 읽는다. 원본을 다시 파싱하면 파이프라인이 보증한
 * 정합성 밖에서 값이 생기고, 그 값은 검증에 걸리지 않는다.
 */

export async function loadIdentities(locale: Locale, ids?: number[]): Promise<Identity[]> {
	const rows = await db.identity.findMany({
		...(ids ? { where: { id: { in: ids } } } : {}),
		include: {
			texts: localeFilter(locale),
			statuses: true,
			affiliations: true,
			skills: { where: { defType: 'attack' } },
		},
	});

	return rows.map((i) => {
		const statuses = new Set<StatusKey>();
		for (const s of i.statuses) {
			const key = statusKeyOf(s.statusId);
			if (key) statuses.add(key);
		}
		return {
			id: i.id,
			name: nameOf(i.texts, locale)?.name ?? String(i.id),
			statuses: [...statuses],
			sins: [...new Set(i.skills.map((s) => s.affinity).filter((s): s is NonNullable<typeof s> => s !== null))],
			atkTypes: [...new Set(i.skills.map((s) => s.atkType).filter((t): t is NonNullable<typeof t> => t !== null))],
			affiliations: i.affiliations.map((a) => a.affiliationId),
		};
	});
}

/**
 * 소속 어휘. id → 한국어 이름.
 *
 * 두 자리에서 쓴다 — (1) `mapTrigger` 가 조건 토큰의 소속 id 가 실제로 존재하는지 판정할 때는
 * 키 집합만 있으면 되고, (2) `refineAffiliation` 이 설명문에서 그 소속을 언급하는 줄을 찾을
 * 때는 한국어 이름이 있어야 한다. 같은 질의에서 이름까지 함께 가져온다 — 정밀화 때문에 새
 * 질의를 만들지 않는다.
 */
export async function loadAffiliations(): Promise<Map<string, string>> {
	const rows = await db.affiliation.findMany({
		select: { id: true, texts: { where: { locale: 'ko' }, select: { name: true } } },
	});
	return new Map(rows.map((r) => [r.id, r.texts[0]?.name ?? r.id]));
}

export async function loadGifts(
	locale: Locale,
	affiliations: ReadonlyMap<string, string>,
	ids?: number[],
): Promise<{ gifts: Gift[]; unmapped: { effects: Set<string>; triggers: Set<string> } }> {
	const rows = await db.gift.findMany({
		...(ids ? { where: { id: { in: ids } } } : {}),
		include: {
			texts: { where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 } },
			tokens: { orderBy: [{ kind: 'asc' }, { index: 'asc' }] },
		},
	});

	const unmapped = { effects: new Set<string>(), triggers: new Set<string>() };
	const gifts: Gift[] = [];
	// `mapTrigger` 는 소속 id 집합만 본다 — 매 기프트마다 새로 만들지 않고 한 번만 뽑는다.
	const affiliationIds = new Set(affiliations.keys());

	for (const g of rows) {
		const effectTokens = g.tokens.filter((t) => t.kind === 'effect');
		const triggerTokens = g.tokens.filter((t) => t.kind === 'trigger');
		// 소속 조건의 인원수·판정 범위는 원본 토큰이 아니라 설명문에만 있다(vocab.refineAffiliation).
		// 이미 로드한 텍스트를 그대로 쓴다 — 새 질의를 만들지 않는다.
		const desc = textOf(g.texts, locale)?.desc ?? '';

		const units = effectTokens
			.map((t) => {
				const u = mapEffect(t.token);
				if (!u) unmapped.effects.add(t.token);
				return u;
			})
			.filter((u): u is NonNullable<typeof u> => u !== null);

		const mapped = triggerTokens.map((t) => {
			const c = mapTrigger(t.token, affiliationIds);
			if (!c) unmapped.triggers.add(t.token);
			return c;
		});
		// 소속 조건이 둘 이상이면 설명문의 인원수가 합집합("검계 또는 흑운회가 4인")의 것이다.
		// 엔진은 발동을 AND 로 묶으므로 그 수를 그대로 쓰면 근사보다 더 틀린다 — 세어서 넘긴다.
		const affiliationTokens = mapped.filter((c) => c?.op === 'COUNT_AFFILIATION').length;

		const conditions = mapped
			.map((c) =>
				c && c.op === 'COUNT_AFFILIATION'
					? refineAffiliation(c, desc, affiliations.get(c.affiliation), affiliationTokens)
					: c,
			)
			.filter((c): c is Condition => c !== null);

		// 원본은 효과와 발동을 짝지어 주지 않는다. 배열 두 개가 따로 있을 뿐이다.
		// 따라서 **모든 발동 조건을 AND 로 묶어 모든 효과에 건다.** 실제보다 보수적인 근사이며,
		// 정밀한 짝짓기는 설명문 구조 분석이 필요하다(후속 슬라이스).
		const condition: Condition =
			conditions.length === 0
				? { op: 'ALWAYS' }
				: conditions.length === 1
					? (conditions[0] as Condition)
					: { op: 'AND', conditions };

		gifts.push({
			id: g.id,
			name: nameOf(g.texts, locale)?.name ?? String(g.id),
			tier: g.tier,
			keyword: g.keywordId,
			effects: units.map((unit) => ({ unit, condition })),
		});
	}

	return { gifts, unmapped };
}

/** 층 구간에 등장하는 팩을 후보로 만든다. */
export async function loadPackCandidates(
	locale: Locale,
	giftById: ReadonlyMap<number, Gift>,
	packIds?: string[],
): Promise<PackCandidate[]> {
	const rows = await db.pack.findMany({
		...(packIds ? { where: { id: { in: packIds } } } : {}),
		include: {
			texts: localeFilter(locale),
			gifts: { select: { giftId: true } },
			exclusiveGifts: { select: { giftId: true } },
		},
	});

	return rows.map((p) => ({
		id: p.id,
		name: nameOf(p.texts, locale)?.name ?? p.id,
		availability: availabilityOf(p.category, p.extreme),
		gifts: p.gifts
			.map((x) => giftById.get(x.giftId))
			.filter((g): g is Gift => g !== undefined),
		exclusiveIds: new Set(p.exclusiveGifts.map((x) => x.giftId)),
	}));
}

/**
 * 팩의 등장성 판정.
 *
 * **뽕.황(3001)은 `category='extreme'` 인데 `extreme=false` 인 유일한 팩이다**(실측 1/117).
 * 극히 낮은 확률로만 등장하므로 후보에서 항상 뺀다 — 두면 187종을 담은 덕에 언제나 1위가 된다.
 * 발푸르기스의 밤 4종은 기간 한정이라 이벤트 중에만 후보다.
 */
export function availabilityOf(category: string, extreme: boolean): Availability {
	if (category === 'extreme' && !extreme) return 'hidden';
	if (category === 'walpurgis') return 'limited';
	return 'standard';
}

/** 난이도·층으로 후보 팩 id 를 고른다. */
export async function packIdsForFloor(difficulty: 'normal' | 'hard', floor: number) {
	const rows = await db.floorPack.findMany({ where: { difficulty } });
	const inRange = rows.filter((r) => {
		const parts = r.floorRange.split('-').map(Number);
		const lo = parts[0] ?? 0;
		const hi = parts[1] ?? lo;
		return floor >= lo && floor <= hi;
	});
	return [...new Set(inRange.map((r) => r.packId))];
}
