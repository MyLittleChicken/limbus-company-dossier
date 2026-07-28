import type { Locale } from '@prisma/client';
import {
	loadAffiliations,
	loadGifts,
	loadIdentities,
	loadPackCandidates,
	packIdsForFloor,
} from '@/lib/engine/load';
import { rankPacks, type RankResult } from '@/lib/engine/pack';
import { deckFeature, type RunState } from '@/lib/engine/state';
import type { Difficulty } from '@prisma/client';

/**
 * 화면이 쓰는 추천 질의.
 *
 * 3단계 엔진을 2단계 웹 위에 얹어 **한 덱에 대해 실제로 도는지** 보이는 자리다.
 * 런 상태를 사용자가 입력하는 흐름은 4단계이며 여기에는 없다 — 덱은 고정이고
 * 층과 보유 기프트만 질의 문자열로 받는다.
 */

/** 화진 덱 — 새벽 사무소 3 + 엄지 4. 온필드 정원 7과 정확히 맞는다. */
export const HWAJIN_DECK = [10216, 11009, 11216, 10512, 10716, 10916, 11013];

export interface Recommendation {
	deck: Array<{ id: number; name: string; statuses: string[]; affiliations: string[] }>;
	feature: ReturnType<typeof deckFeature>;
	floor: number;
	difficulty: Difficulty;
	candidateCount: number;
	result: RankResult;
	owned: Array<{ id: number; name: string }>;
}

export async function recommendForDeck(
	locale: Locale,
	options: {
		identityIds?: number[];
		floor?: number;
		difficulty?: Difficulty;
		ownedIds?: number[];
	} = {},
): Promise<Recommendation> {
	const identityIds = options.identityIds ?? HWAJIN_DECK;
	const floor = options.floor ?? 3;
	const difficulty = options.difficulty ?? 'hard';

	const affiliations = await loadAffiliations();
	const [deck, { gifts }] = await Promise.all([
		loadIdentities(locale, identityIds),
		loadGifts(locale, affiliations),
	]);

	const giftById = new Map(gifts.map((g) => [g.id, g]));
	const owned = (options.ownedIds ?? [])
		.map((id) => giftById.get(id))
		.filter((g): g is NonNullable<typeof g> => g !== undefined);

	const state: RunState = { deck, deployed: deck, owned, floor };
	const packIds = await packIdsForFloor(difficulty, floor);
	const candidates = await loadPackCandidates(locale, giftById, packIds);

	return {
		deck: deck.map((i) => ({
			id: i.id,
			name: i.name,
			statuses: i.statuses,
			affiliations: i.affiliations,
		})),
		feature: deckFeature(state),
		floor,
		difficulty,
		candidateCount: candidates.length,
		result: rankPacks(state, candidates, { limit: 5 }),
		owned: owned.map((g) => ({ id: g.id, name: g.name })),
	};
}
