import type { Condition, EffectUnit, StatusKey } from './vocab';

/**
 * 런 상태와 덱 특성.
 *
 * **편성(DECK)과 출전(DEPLOYED)을 구분한다**(마스터북 §9). 거울 던전은 12명을 소집하고
 * 그중 7명이 온필드다. `소속 3인 이상` 류 조건은 실제로 출전 기준이며
 * (기프트 9283 `출격 인원을 기준으로 함`), 편성 기준인 것도 있다(9282 `편성 인원`).
 * 하나로 합치면 오추천이 난다.
 *
 * **덱을 단일 키워드로 요약하지 않는다**(§8). `이 덱은 화상 덱` 대신 상태별 공급량과
 * 죄악·소속 분포를 벡터로 둔다. 요약은 화면의 몫이다.
 */

export const ONFIELD_MAX = 7;
export const DECK_MAX = 12;

export interface Identity {
	id: number;
	name: string;
	/** 이 인격이 부여할 수 있는 상태 */
	statuses: StatusKey[];
	/** 공격 스킬의 죄악 분포 */
	sins: string[];
	/** 공격 스킬의 공격 타입 */
	atkTypes: string[];
	affiliations: string[];
}

export interface Gift {
	id: number;
	name: string;
	tier: string;
	keyword: string | null;
	effects: Array<{ unit: EffectUnit; condition: Condition }>;
}

export interface RunState {
	/** 소집 최대 12 */
	deck: Identity[];
	/** 온필드 최대 7. 비우면 덱 전체를 출전으로 본다 */
	deployed: Identity[];
	owned: Gift[];
	floor: number;
}

/** 상태별 공급 인원 수. 조건 평가와 발동 빈도의 입력이다. */
export function statusSupply(deployed: readonly Identity[]): Record<string, number> {
	const supply: Record<string, number> = {};
	for (const i of deployed) for (const s of i.statuses) supply[s] = (supply[s] ?? 0) + 1;
	return supply;
}

/** 죄악별 공격 스킬 보유 인원. 공명 판정의 입력이다. */
export function sinSupply(deployed: readonly Identity[]): Record<string, number> {
	const supply: Record<string, number> = {};
	for (const i of deployed) for (const s of i.sins) supply[s] = (supply[s] ?? 0) + 1;
	return supply;
}

export function affiliationCount(
	deck: readonly Identity[],
	deployed: readonly Identity[],
): { deck: Record<string, number>; deployed: Record<string, number> } {
	const tally = (list: readonly Identity[]) => {
		const m: Record<string, number> = {};
		for (const i of list) for (const a of i.affiliations) m[a] = (m[a] ?? 0) + 1;
		return m;
	};
	return { deck: tally(deck), deployed: tally(deployed) };
}

export interface DeckFeature {
	statusSupply: Record<string, number>;
	sinSupply: Record<string, number>;
	affiliation: { deck: Record<string, number>; deployed: Record<string, number> };
	atkTypes: Record<string, number>;
	/** 공급이 가장 많은 상태. 화면 요약용이며 계산 입력이 아니다 */
	dominant: StatusKey | null;
}

export function deckFeature(state: RunState): DeckFeature {
	const deployed = state.deployed.length > 0 ? state.deployed : state.deck;
	const supply = statusSupply(deployed);
	const atk: Record<string, number> = {};
	for (const i of deployed) for (const t of i.atkTypes) atk[t] = (atk[t] ?? 0) + 1;
	const dominant = (Object.entries(supply).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as
		| StatusKey
		| null;
	return {
		statusSupply: supply,
		sinSupply: sinSupply(deployed),
		affiliation: affiliationCount(state.deck, deployed),
		atkTypes: atk,
		dominant,
	};
}

/** 조건 평가에 넘길 문맥. 상태에서 파생하며 따로 저장하지 않는다. */
export interface EvalContext extends DeckFeature {
	deckSize: number;
	deployedSize: number;
	ownedIds: ReadonlySet<number>;
}

export function contextOf(state: RunState): EvalContext {
	const deployed = state.deployed.length > 0 ? state.deployed : state.deck;
	return {
		...deckFeature(state),
		deckSize: state.deck.length,
		deployedSize: deployed.length,
		ownedIds: new Set(state.owned.map((g) => g.id)),
	};
}

/** 기프트를 더한 상태. 원본을 바꾸지 않는다. */
export function withGift(state: RunState, gift: Gift): RunState {
	return { ...state, owned: [...state.owned, gift] };
}
