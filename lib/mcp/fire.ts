import type { Ability } from '@/lib/engine/v2/ability.js';
import type { GiftVerdict, Reason } from '@/lib/engine/v2/types';

/**
 * 기프트 켜짐 — 능력(절) 단위로 본 뒤 기프트로 접는다(설계 §6.2, 리뷰 R1#2 · R2#3).
 *
 * 엔진의 절 규칙(`lib/engine/v2/ability.ts`)을 그대로 따른다.
 *
 *   기프트 켜질 수 있다 = refines=null(독립) 능력 중 하나라도         ordinal 간 OR
 *     능력 = unconditional 이거나 모든 group 이 충족                  group 간 AND
 *       group = 조건 중 하나라도 충족                                 group 내 OR
 *
 * 엔진의 `fireable` 은 「못 켠다는 근거가 없다」(unknown 도 true)라 boolean 하나로 내리면
 * 「모른다」가 「켜진다」로 읽힌다. 그래서 상태를 나눈다.
 *
 * 능력 하나
 *   on        무조건이거나, 모든 group 에 확정 충족 조건이 있다
 *   off       어떤 group 의 조건이 전부 확정 미충족
 *   possible  그 밖 — group 이 unknown(전투 중 · 문턱 없음 · 셀 수 없음)에만 기대거나,
 *             무조건이 아닌데 조건이 0개(결손)
 *
 * 기프트
 *   off       엔진 fireable=false 그대로
 *   on        on 인 독립 능력이 있고, 다른 능력(독립 · 강화 절)에 off 가 없다
 *   partial   on 인 독립 능력이 있으나 다른 능력(독립 · 강화 절)이 확정 미충족
 *             (예: 9001 — 기본 효과 on, 분노 공명 효과 off)
 *   possible  on 인 독립 능력이 없다 — 켜지는 길이 unknown · 결손에만 기댄다
 *   판정 행 없음 → possible + no-judgement-data (저작 보류이지 무조건이 아니다)
 *
 * 판정은 편성(진입 시점) 조건만이다 — 전투 중 발동 조건은 범위 밖.
 *
 * **하향(리뷰 2라운드 R1).** 엔진이 「확정 미충족」이라 했지만 엔진 공급이 그 축을 못 볼 수
 * 있는 경우가 있다. 그런 조건 하나로 죽은 그룹은 off 가 아니라 possible 로 낮추고 까닭을 단다.
 *
 *   skill-supply-incomplete  스킬 공급(coin_token)이 스킬 효과 · 특수 변형 토큰을 놓친다 —
 *                            그 축을 인격 취급(tag)으로 가진 인격이 모집단에 있으면 스킬로도 줄 수 있다
 *   ego-not-judged           판정은 장착 E.G.O 를 안 본다 — 모집단의 E.G.O 게이트가 그 축을 연다
 *   skill-supply-overcount   거꾸로, 확정 충족이 축 제한(axis_restrict) 대상 인격 덕분에만 문턱을 넘는다 →
 *                            on 을 possible 로 낮춘다
 *
 * 무엇이 의심스러운지는 호출자가 `doubt` 로 알려 준다(이 파일은 DB · 덱을 모른다).
 * 기프트 전체가 그 근거 때문에만 off 였다면 같이 낮춘다 — **엔진 fireable=false 를 덮는 유일한
 * 예외다.** 엔진을 고치지 않고 MCP 응답에서만 과소 판정을 피한다.
 */
export type FireState = 'on' | 'partial' | 'possible' | 'off';
export type AbilityState = 'on' | 'possible' | 'off';
export type Downgrade = 'skill-supply-incomplete' | 'ego-not-judged' | 'skill-supply-overcount';
/**
 * 엔진의 확정 판정 하나를 공급 오차로 의심하나. 아니면 null.
 * 확정 미충족(unsatisfied)에는 놓친 공급(incomplete · ego), 확정 충족(satisfied)에는 과대 공급(overcount).
 */
export type Doubt = (r: Reason) => Downgrade | null;

export interface AbilityFire {
	ordinal: number;
	/** 강화판이면 원 능력의 ordinal. 독립이면 null */
	refines: number | null;
	unconditional: boolean;
	state: AbilityState;
	/** 무조건이 아닌데 조건이 0개 — 조건을 못 뽑은 결손이라 막지 않는다 */
	missingConditions?: true;
	/** off · on 을 possible 로 낮춘 까닭 */
	reason?: Downgrade;
	/** 이 능력의 조건 판정. triggerId 가 `능력/그룹/번호` */
	reasons: Reason[];
}

export interface Fire {
	state: FireState;
	/** 판정 행이 아예 없는 기프트(켜짐으로 두지 않는다) · 또는 하향으로 상태가 바뀐 까닭 */
	reason?: 'no-judgement-data' | Downgrade;
	abilities: AbilityFire[];
}

export interface SupplyDoubtInput {
	verdict: Reason['verdict'];
	/** 엔진이 센 수 · 문턱(has 면 1) */
	have: number;
	need: number | null;
	/** 조건의 op · supply(tag · skill · any) */
	op: string;
	supply: string;
	/** 조건 모집단(scope 의 인격 id) */
	pool: ReadonlySet<string>;
	/** 엔진 공급 표 — 그 축의 인격 취급(identity_axis always) · 스킬 취급(coin_token) */
	tag: ReadonlySet<string> | undefined;
	skill: ReadonlySet<string> | undefined;
	/** 장착 E.G.O 게이트가 그 층에 그 축을 여는 인격 */
	egoTag: ReadonlySet<string>;
	egoSkill: ReadonlySet<string>;
	/**
	 * 이 축에서 빼야 할 인격 — axis_restrict(skill · both)가 허용 목록이라 「다른 축으로만 취급」되는 인격.
	 * 엔진 스킬 공급은 제한을 안 걸어 이들을 이 축에도 센다(과대)
	 */
	restricted: ReadonlySet<string> | undefined;
}

/**
 * axis 조건 하나를 공급 오차로 의심하나(리뷰 3라운드 · R1). **op 가 has · gte 일 때만** — eq 는 안 건드린다.
 * 문턱에 실제로 닿거나(미충족) 실제로 밑돌 때(충족)만 의심한다.
 *
 * 확정 미충족 — 놓친 몫 extra 를 더해 닿을 때만: `extra > 0 && have + extra ≥ (need ?? 1)`
 *   supply=skill  extra = |모집단 ∩ ((인격 취급 ∪ E.G.O 가 스킬 층에 연 인격) − 이미 스킬로 센 인격)| 하나로 센다.
 *                 인격 취급 몫만으로 닿으면 skill-supply-incomplete, E.G.O 몫이 있어야 닿으면 ego-not-judged
 *                 예: 9165 진동 have 2 · need 5 · extra 0 → 의심 없음(off 그대로)
 *   supply=tag    extra = |모집단 ∩ (E.G.O 가 tag 층에 연 인격 − 인격 취급)| → ego-not-judged
 *   supply=any    두 층 중 큰 쪽(엔진의 max 와 같다) → ego-not-judged
 * 확정 충족
 *   skill-supply-overcount   스킬 공급에서 `restricted`(다른 축으로만 취급되는 인격)를 빼면 문턱 밑
 */
export function supplyDoubt(x: SupplyDoubtInput): Downgrade | null {
	if (x.op !== 'has' && x.op !== 'gte') return null;
	if (x.verdict === 'unknown') return null;
	const need = x.need ?? 1;
	const count = (inc: ReadonlySet<string> | undefined, exc?: ReadonlySet<string>) =>
		inc ? [...x.pool].filter((id) => inc.has(id) && !exc?.has(id)).length : 0;
	const tagN = count(x.tag);
	const skillN = count(x.skill);

	if (x.verdict === 'satisfied') {
		if (x.supply !== 'skill' && x.supply !== 'any') return null;
		const kept = count(x.skill, x.restricted);
		if (kept === skillN) return null;
		const fixed = x.supply === 'any' ? Math.max(tagN, kept) : kept;
		return fixed < need ? 'skill-supply-overcount' : null;
	}

	const reaches = (extra: number) => extra > 0 && x.have + extra >= need;
	if (x.supply === 'skill') {
		const union = new Set([...(x.tag ?? []), ...x.egoSkill]);
		if (!reaches(count(union, x.skill))) return null;
		// 인격 취급 몫만으로 닿으면 공급 누락, E.G.O 몫이 결정적이면 E.G.O 미판정
		return reaches(count(x.tag, x.skill)) ? 'skill-supply-incomplete' : 'ego-not-judged';
	}
	const egoTagX = count(x.egoTag, x.tag);
	const egoSkillX = count(x.egoSkill, x.skill);
	const egoExtra = x.supply === 'any' ? Math.max(tagN + egoTagX, skillN + egoSkillX) - x.have : egoTagX;
	return reaches(egoExtra) ? 'ego-not-judged' : null;
}

/** `triggerId` = `ordinal/group/idx` (ability.ts 의 judgeGift). 모양이 다르면 null */
function parseTrigger(id: string): { ordinal: number; group: number } | null {
	const m = /^(\d+)\/(\d+)\/\d+$/.exec(id);
	return m ? { ordinal: Number(m[1]), group: Number(m[2]) } : null;
}

export function abilityState(
	a: Ability, reasons: readonly Reason[], doubt: Doubt = () => null,
): { state: AbilityState; missingConditions?: true; reason?: Downgrade } {
	if (a.unconditional) return { state: 'on' };
	if (reasons.length === 0) return { state: 'possible', missingConditions: true };
	const groups = new Map<number, Reason[]>();
	for (const r of reasons) {
		const g = parseTrigger(r.triggerId)?.group ?? -1;
		groups.set(g, [...(groups.get(g) ?? []), r]);
	}
	const gs = [...groups.values()];
	const dead = gs.filter((g) => g.every((r) => r.verdict === 'unsatisfied'));
	if (dead.length > 0) {
		// 의심 가는 조건이 없는 죽은 그룹이 하나라도 있으면 off 그대로
		const why = dead.map((g) => g.map(doubt).find((d) => d !== null) ?? null);
		if (why.some((d) => d === null)) return { state: 'off' };
		return { state: 'possible', reason: why[0]! };
	}
	const sure = (r: Reason) => r.verdict === 'satisfied' && r.certainty === 'certain';
	if (gs.every((g) => g.some((r) => sure(r) && doubt(r) === null))) return { state: 'on' };
	// 확정 충족이 과대 공급 의심뿐인 그룹이 있어 on 을 못 준다
	if (gs.every((g) => g.some(sure))) {
		const why = gs.flatMap((g) => (g.some((r) => sure(r) && doubt(r) === null) ? [] : g.filter(sure).map(doubt)))
			.find((d) => d !== null);
		return why ? { state: 'possible', reason: why } : { state: 'possible' };
	}
	return { state: 'possible' };
}

/**
 * @param v          엔진 판정(`evaluateGifts`). 없으면 판정 행 없음
 * @param abilities  그 기프트의 능력(`EngineData.abilities.get(giftId)`, 강화 0단계)
 */
export function fireState(v: GiftVerdict | undefined, abilities: readonly Ability[] = [], doubt?: Doubt): Fire {
	if (v === undefined) return { state: 'possible', reason: 'no-judgement-data', abilities: [] };

	const byOrdinal = new Map<number, Reason[]>();
	for (const r of v.reasons) {
		const o = parseTrigger(r.triggerId)?.ordinal;
		if (o === undefined) continue;
		byOrdinal.set(o, [...(byOrdinal.get(o) ?? []), r]);
	}
	const sorted = [...abilities].sort((a, b) => a.ordinal - b.ordinal);
	const fires: AbilityFire[] = sorted.map((a) => {
		const reasons = byOrdinal.get(a.ordinal) ?? [];
		return { ordinal: a.ordinal, refines: a.refines, unconditional: a.unconditional, ...abilityState(a, reasons, doubt), reasons };
	});
	const state = fold(v, fires);
	if (doubt === undefined) return { state, abilities: fires };

	// 하향이 기프트 상태를 바꿨으면 그 까닭을 기프트에도 단다 — 상태를 실제로 바꾼 능력의 것,
	// 독립 능력을 먼저(첫 능력이 아니라)
	const plainAbilities = sorted.map((a) => ({ refines: a.refines, ...abilityState(a, byOrdinal.get(a.ordinal) ?? []) }));
	const plain = fold(v, plainAbilities);
	if (state === plain) return { state, abilities: fires };
	const changed = fires.filter((f, i) => f.reason !== undefined && f.state !== plainAbilities[i]!.state);
	const why = (changed.find((f) => f.refines === null) ?? changed[0])?.reason;
	return why ? { state, reason: why, abilities: fires } : { state, abilities: fires };
}

function fold(v: GiftVerdict, fires: ReadonlyArray<{ refines: number | null; state: AbilityState; reason?: Downgrade }>): FireState {
	const independent = fires.filter((f) => f.refines === null);
	// 엔진 fireable=false 를 덮는 유일한 예외 — 독립 능력의 off 가 전부 하향으로 풀렸을 때
	const lifted = independent.length > 0 && independent.every((f) => f.state !== 'off')
		&& independent.some((f) => f.reason !== undefined);
	if (!v.fireable && !lifted) return 'off';
	if (!independent.some((f) => f.state === 'on')) return 'possible';
	return fires.some((f) => f.state === 'off') ? 'partial' : 'on';
}

/** 정렬용 순위. 작을수록 앞 */
export const FIRE_RANK: Record<FireState, number> = { on: 0, partial: 1, possible: 2, off: 3 };
