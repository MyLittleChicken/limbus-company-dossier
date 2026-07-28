import { ceiling, marginalValue, neededStatuses } from './score';
import { contextOf, type Gift, type RunState } from './state';
import { FLOOR_PHASE, FUTURE_RELEVANCE_FLOOR, PACK_W, phaseOf } from './tuning';

/**
 * 팩 점수와 순위.
 *
 * ```
 * PackScore = 즉시 강화 + 합성 진행 + 범용 + 한정 기회 + 미래 확장 − 중복
 * ```
 *
 * **전투 상성 항을 두지 않는다.** 보스 내성 데이터를 적재하지 않았으므로 넣으면 지어낸 값이 된다
 * (마스터북 §18의 `CombatMatchupValue` · `CombatRiskPenalty` 는 데이터가 생길 때 더한다).
 *
 * **점수 하나로 답하지 않는다**(§20). 항목별 분해와 근거를 함께 돌려주고,
 * 화면은 그것을 옮겨 적기만 한다.
 */

/**
 * 팩의 등장성.
 *
 * **모든 팩이 후보가 아니다.** 접근할 수 없는 팩을 후보에 두면 점수가 아무리 정확해도
 * 쓸모없는 추천이 된다. 이전 프로토타입도 같은 문제를 겪고 등급을 도입했다.
 *
 *   - `standard` 기본 후보.
 *   - `limited` 기간 한정(발푸르기스의 밤). 이벤트가 열려 있을 때만 후보다.
 *   - `hidden` 극히 낮은 확률로만 등장. **항상 제외한다.**
 */
export type Availability = 'standard' | 'limited' | 'hidden';

export interface PackCandidate {
	id: string;
	name: string;
	availability: Availability;
	/** 이 팩에서 얻을 수 있는 기프트 */
	gifts: Gift[];
	/** 이 팩에서만 나오는 기프트 id */
	exclusiveIds: ReadonlySet<number>;
}

export interface PackScore {
	packId: string;
	name: string;
	score: number;
	components: {
		immediate: number;
		fusionProgress: number;
		universal: number;
		exclusiveOpportunity: number;
		futureOption: number;
		redundancy: number;
	};
	reasons: string[];
	/** 이 팩에서 가장 값이 큰 기프트 */
	top: Array<{ giftId: number; name: string; delta: number; evidence: string[] }>;
}

/**
 * 미래 가치의 관련성.
 *
 * 덱이 굴리지 않는 축의 페이오프를 그대로 인정하면 화상 덱에 출혈 팩이 올라온다.
 * 기프트가 필요로 하는 상태를 덱이 공급하는 만큼만 인정하되, 바닥을 둬 0으로 만들지는 않는다.
 */
function futureRelevance(gift: Gift, supply: Record<string, number>): number {
	const needed = neededStatuses(gift);
	if (needed.size === 0) return 1;
	let met = 0;
	for (const s of needed) if ((supply[s] ?? 0) > 0) met += 1;
	return Math.max(FUTURE_RELEVANCE_FLOOR, met / needed.size);
}

export function scorePack(state: RunState, pack: PackCandidate): PackScore {
	const ctx = contextOf(state);
	const phase = FLOOR_PHASE[phaseOf(state.floor)];

	let immediate = 0;
	let universal = 0;
	let exclusiveOpportunity = 0;
	let futureOption = 0;
	let redundancy = 0;

	const scored: PackScore['top'] = [];

	for (const gift of pack.gifts) {
		// 이미 보유한 기프트는 이 팩의 가치가 아니다. 중복으로 세면 순위가 뒤집힌다.
		if (ctx.ownedIds.has(gift.id)) {
			redundancy += 0.1;
			continue;
		}

		const m = marginalValue(state, gift);
		immediate += m.delta;
		scored.push({ giftId: gift.id, name: gift.name, delta: m.delta, evidence: m.evidence });

		// 조건이 없는 효과만으로 나오는 값 = 편성과 무관한 범용 가치
		const always = gift.effects.filter((e) => e.condition.op === 'ALWAYS').length;
		if (always > 0) universal += (always / gift.effects.length) * m.own;

		// 지금은 못 켜지만 나중에 켜질 수 있는 몫
		const gap = Math.max(0, ceiling(gift) - m.own);
		futureOption += gap * futureRelevance(gift, ctx.statusSupply);

		if (pack.exclusiveIds.has(gift.id)) exclusiveOpportunity += m.delta;
	}

	scored.sort((a, b) => b.delta - a.delta);

	// 합성 진행 — 이 팩의 기프트가 보유 재료와 맞물리는지는 후속 슬라이스다.
	const fusionProgress = 0;

	const components = {
		immediate: immediate * phase.immediate,
		fusionProgress: fusionProgress * phase.fusionProgress,
		universal: universal * phase.universal,
		exclusiveOpportunity,
		futureOption: futureOption * phase.futureOption,
		redundancy,
	};

	const score =
		components.immediate * PACK_W.immediate +
		components.fusionProgress * PACK_W.fusionProgress +
		components.universal * PACK_W.universal +
		components.exclusiveOpportunity * PACK_W.exclusiveOpportunity +
		components.futureOption * PACK_W.futureOption -
		components.redundancy * PACK_W.redundancyPenalty;

	const reasons: string[] = [];
	const best = scored.slice(0, 3).filter((g) => g.delta > 0);
	for (const g of best) {
		const why = g.evidence.length > 0 ? ` — ${g.evidence.join(' · ')}` : '';
		reasons.push(`${g.name} +${g.delta.toFixed(2)}${why}`);
	}
	if (redundancy > 0) reasons.push(`이미 보유한 기프트 ${Math.round(redundancy / 0.1)}종`);

	return { packId: pack.id, name: pack.name, score, components, reasons, top: scored.slice(0, 5) };
}

/** 후보 팩을 점수 순으로. 마스터북은 최대 3개를 제시한다(§1). */
export interface RankResult {
	ranked: PackScore[];
	/** 후보에서 뺀 팩과 그 이유. **조용히 버리지 않는다**(ADR-02 원칙 1). */
	dropped: Array<{ packId: string; name: string; reason: Availability }>;
}

export function rankPacks(
	state: RunState,
	candidates: readonly PackCandidate[],
	options: { limit?: number; eventActive?: boolean } = {},
): RankResult {
	const limit = options.limit ?? 3;
	const dropped: RankResult['dropped'] = [];
	const eligible: PackCandidate[] = [];

	for (const p of candidates) {
		if (p.availability === 'hidden') {
			dropped.push({ packId: p.id, name: p.name, reason: 'hidden' });
			continue;
		}
		if (p.availability === 'limited' && options.eventActive !== true) {
			dropped.push({ packId: p.id, name: p.name, reason: 'limited' });
			continue;
		}
		eligible.push(p);
	}

	const ranked = eligible
		.map((p) => scorePack(state, p))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);

	return { ranked, dropped };
}
