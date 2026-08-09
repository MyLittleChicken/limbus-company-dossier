import type { Locale } from '@/lib/locale';
import type { $Enums } from '@/src/v2/generated/client';
import { canonical } from '@/lib/db-canonical';
import { giftIcon, identityImage, packIcon } from '@/lib/assets';
import { loadEngineData } from '@/lib/engine/v2/load';
import { Profile } from '@/lib/engine/v2/profile';
import { evaluateGifts } from '@/lib/engine/v2/evaluate';
import { chain } from '@/lib/engine/v2/chain';
import type { GiftVerdict, Squad } from '@/lib/engine/v2/types';
import { localeRows, nameOf } from './locale';
import { axisSupplyOf, scorePack, type ScoreGift } from '@/lib/engine/v2/score';

/**
 * 화면이 쓰는 추천 질의.
 *
 * **현행 `lib/queries/recommend.ts` 를 대체한다.** 층만 바뀌는 것이 아니라 엔진이
 * 바뀐다 — 레거시는 「기프트가 얼마나 세지나」를 수치로 쟀고 v2 는 「켜지나」를
 * 근거와 함께 답한다(설계 2절).
 *
 * **순위를 안 매긴다.** 점수 모형이 없는데 순서를 붙이면 그 순서가 거짓말이 된다 —
 * 팩 후보를 그대로 두고 기프트를 등급별로 센다. 점수는 PR-B 다.
 */

/** 화진 덱 — 새벽 사무소 3 + 엄지 4. 온필드 정원 7과 정확히 맞는다. */
export const HWAJIN_DECK = [10216, 11009, 11216, 10512, 10716, 10916, 11013];

/**
 * 층 구간이 이 층을 담는가.
 *
 * 원본 표기가 `"1"` 과 `"6-10"` 처럼 섞여 있다. 문자열로 비교하면 3층이 `6-10` 에
 * 안 걸린다 — 양끝을 펴서 본다.
 */
export function rangeCovers(range: string, floor: number): boolean {
	const parts = range.split('-').map(Number);
	const lo = parts[0];
	if (lo === undefined || !Number.isFinite(lo)) return false;
	const hi = parts.length > 1 && Number.isFinite(parts[1] as number)
		? (parts[1] as number)
		: lo;
	return floor >= lo && floor <= hi;
}

export interface GiftLine {
	id: number;
	name: string | null;
	icon: string | null;
	/** 기프트 분류. 덱 적합도의 재료다 — 축이 아닌 값(None · Slash …)도 그대로 낸다 */
	keywordId: string | null;
	grade: 'A' | 'B' | 'C';
	/** 판정 가능한 참조 중 충족한 수 */
	satisfied: number;
	decidable: number;
	total: number;
	/** `satisfied` 와 다르면 나머지는 「가능」이다 */
	certain: number;
	reasons: GiftVerdict['reasons'];
	/** 보유 기프트가 이걸 켤 수 있나. 몇 홉인지 */
	chainDepth: number | null;
}

export interface PackLine {
	id: string;
	name: string | null;
	icon: string | null;
	/** `fit × live`. 순위의 근거다 */
	score: number;
	/** 후보 기프트의 평균 덱 적합도 */
	fit: number;
	/** 후보 기프트의 효과 중 살아 있는 비율 */
	live: number;
	/** 등급별 기프트 수 */
	tally: { A: number; B: number; C: number };
	gifts: GiftLine[];
}

export interface Recommendation {
	deck: Array<{ id: number; name: string | null; image: string | null; axes: string[] }>;
	floor: number;
	difficulty: $Enums.Difficulty;
	/** 후보 팩 수 */
	candidateCount: number;
	packs: PackLine[];
	owned: Array<{ id: number; name: string | null }>;
	/** 편성이 공급하는 축과 인원. 화면의 막대 */
	supply: Array<{ refKind: string; refId: string; count: number }>;
	/** 순위를 매길 수 있나. 축을 안 공급하는 덱은 false 다 */
	rankable: boolean;
}

export async function recommendForDeck(
	locale: Locale,
	options: {
		identityIds?: number[];
		/** 출전 인격 id. 비우면 편성 전체를 출전으로 본다 */
		deployedIds?: number[];
		floor?: number;
		difficulty?: $Enums.Difficulty;
		ownedIds?: number[];
	} = {},
): Promise<Recommendation> {
	const identityIds = options.identityIds ?? HWAJIN_DECK;
	const floor = options.floor ?? 3;
	const difficulty = options.difficulty ?? 'hard';
	const ownedIds = options.ownedIds ?? [];

	const data = await loadEngineData(canonical);

	// 편성 12 와 출전 7 은 다르다 — 분모가 갈린다(v2/types.ts Squad 주석)
	const roster = identityIds.map((id) => ({ identityId: String(id), egoIds: [] }));
	/**
	 * **빈 배열을 「비었다」로 읽는다.** `??` 로 쓰면 안 된다 — 화면은 주소에
	 * `deployed` 가 없을 때 `[]` 를 넘기는데 `[] ?? x` 는 `[]` 다. 그러면 출전
	 * 분모가 0 이 되어 `Profile` 이 세는 인원이 전부 0 이 되고, 조건 판정의
	 * 기본 분모가 출전이라 공급이 통째로 사라진다. 앱을 띄워 보고 잡았다.
	 */
	const deployed = options.deployedIds ?? [];
	const field = (deployed.length > 0 ? deployed : identityIds).map(String);
	const squad: Squad = { roster, field };

	const profile = new Profile(squad, data.capabilities);
	const verdicts = evaluateGifts({
		squad,
		profile,
		giftTriggers: data.giftTriggers,
		refsByTrigger: data.refsByTrigger,
		params: data.params,
	});
	const byGift = new Map(verdicts.map((v) => [v.giftId, v]));

	const links = chain({
		heldGiftIds: ownedIds.map(String),
		giftEffects: data.giftEffects,
		effectRefs: data.effectRefs,
		giftRefs: data.giftRefs,
		verdicts,
	});
	const depthByGift = new Map(links.map((l) => [l.giftId, l.depth]));

	// 층 후보 팩. floor_pack 을 난이도로만 좁히고 구간은 코드로 편다
	const floorRows = await canonical.floorPack.findMany({
		where: { difficulty },
		select: { floorRange: true, packId: true },
	});
	const packIds = [
		...new Set(floorRows.filter((r) => rangeCovers(r.floorRange, floor)).map((r) => r.packId)),
	];

	const packRows = await canonical.pack.findMany({
		where: { id: { in: packIds } },
		orderBy: { id: 'asc' },
		include: {
			texts: localeRows(locale),
			gifts: {
				include: {
					gift: {
						include: { stages: { where: { level: 0 }, include: { texts: localeRows(locale) } } },
					},
				},
			},
		},
	});

	// 축 공급을 먼저 접는다 — 팩마다 다시 세지 않는다
	const supplyRows = [...new Set(data.capabilities.map((c) => `${c.refKind}|${c.refId}`))]
		.map((k) => {
			const [refKind = '', refId = ''] = k.split('|');
			return { refKind, refId, count: profile.count(refKind, refId) };
		})
		.filter((s) => s.count > 0)
		.sort((a, b) => b.count - a.count || a.refId.localeCompare(b.refId));
	const axisSupply = axisSupplyOf(supplyRows);
	const ownedSet = new Set(ownedIds.map(String));

	const packs: PackLine[] = packRows.map((p) => {
		const gifts: GiftLine[] = p.gifts.map((row) => {
			const v = byGift.get(row.giftId);
			return {
				id: Number(row.giftId),
				name: nameOf(row.gift.stages[0]?.texts ?? [], locale)?.name ?? null,
				icon: giftIcon(row.gift.sprite),
				keywordId: row.gift.keywordId,
				// 판정이 없는 기프트는 트리거가 아예 없는 것이다 — C 로 둔다
				grade: v?.grade ?? 'C',
				satisfied: v?.satisfied ?? 0,
				decidable: v?.decidable ?? 0,
				total: v?.total ?? 0,
				certain: v?.certain ?? 0,
				reasons: v?.reasons ?? [],
				chainDepth: depthByGift.get(row.giftId) ?? null,
			};
		});
		// 등급 · 충족 수 순. **점수가 아니라 정렬 기준이다** — 순위를 뜻하지 않는다
		gifts.sort((a, b) => a.grade.localeCompare(b.grade) || b.satisfied - a.satisfied || a.id - b.id);

		// 점수는 엔진이 센다. 화면도 질의도 다시 세지 않는다.
		// **`gifts` 를 재료로 쓴다** — `p.gifts` 를 두 번 순회하며 `byGift` 를 다시
		// 조회하면 같은 셈이 두 벌이 되고, 한쪽만 고쳐질 때 조용히 갈린다
		const scoreInput: ScoreGift[] = gifts.map((g) => ({
			keywordId: g.keywordId,
			total: g.total,
			satisfied: g.satisfied,
			reasons: g.reasons,
			chainDepth: g.chainDepth,
			owned: ownedSet.has(String(g.id)),
		}));
		const s = scorePack(scoreInput, axisSupply);

		return {
			id: p.id,
			name: nameOf(p.texts, locale)?.name ?? null,
			icon: packIcon(p.sprite),
			score: s.score,
			fit: s.fit,
			live: s.live,
			tally: {
				A: gifts.filter((g) => g.grade === 'A').length,
				B: gifts.filter((g) => g.grade === 'B').length,
				C: gifts.filter((g) => g.grade === 'C').length,
			},
			gifts,
		};
	});

	// **점수 순이다.** 순위를 못 매기는 덱이면 팩 id 순으로 둔다 — 0 점을
	// 늘어놓은 순서가 의미 있는 것처럼 보이면 안 된다
	packs.sort((a, b) =>
		axisSupply.max > 0 ? b.score - a.score || a.id.localeCompare(b.id) : a.id.localeCompare(b.id),
	);

	// 덱 표시
	const identities = await canonical.identity.findMany({
		where: { id: { in: identityIds.map(String) } },
		include: {
			texts: localeRows(locale),
			// `ego_granted` 는 뺀다 — 수감자의 E.G.O 가 주는 축이라 인격이 공급한다고
			// 말하면 거짓이다. `canonical/squad.ts` 와 같은 판정이다.
			axes: { where: { source: { not: 'ego_granted' } }, select: { axisId: true } },
		},
	});
	const identityName = (rows: Array<{ locale: string; name: string; title: string | null }>) => {
		const pick = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en');
		return pick ? (pick.title ?? pick.name).replace(/\s+/g, ' ').trim() : null;
	};

	const ownedGifts = await canonical.gift.findMany({
		where: { id: { in: ownedIds.map(String) } },
		include: { stages: { where: { level: 0 }, include: { texts: localeRows(locale) } } },
	});

	return {
		deck: identities.map((i) => ({
			id: Number(i.id),
			name: identityName(i.texts),
			image: identityImage(Number(i.id), 'profile'),
			axes: [...new Set(i.axes.map((a) => a.axisId))].sort(),
		})),
		floor,
		difficulty,
		candidateCount: packs.length,
		packs,
		owned: ownedGifts.map((g) => ({
			id: Number(g.id),
			name: nameOf(g.stages[0]?.texts ?? [], locale)?.name ?? null,
		})),
		supply: supplyRows,
		rankable: axisSupply.max > 0,
	};
}
