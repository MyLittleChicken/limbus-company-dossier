/**
 * 절 규칙 판정 — 사양 §3 「판정 규칙 — 코드에 산다」.
 *
 * ```
 * 기프트가 켜질 수 있다
 *   = refines=null 인 능력 중 하나라도 켜질 수 있다        ordinal 간 OR
 *       능력이 켜질 수 있다
 *         = unconditional 이거나 모든 group 이 충족 가능     group 간 AND
 *             group 이 충족 가능
 *               = 조건 중 하나라도 충족 가능                 group 내 OR
 * ```
 *
 * **「모른다」를 「아니다」로 쓰지 않는다.** runtime · 문턱 없음 · 조건 0개 ·
 * 능력 0개는 전부 배제하지 않는다. 옛 엔진이 반대로 해서 「발동 불가」 173건 중
 * 158건(91%)이 틀렸다.
 *
 * **DB 를 모른다.** 표를 주입받는 순수 함수다.
 */
import { countSupply, type SupplyTables } from './supply.js';
import type { Reason, Squad } from './types.js';

/** `canonical.gift_ability` 한 행 */
export interface Ability {
	giftId: string;
	level: number;
	ordinal: number;
	unconditional: boolean;
	/** 다른 능력의 강화판이면 그 ordinal. 독립이면 null */
	refines: number | null;
}

/** `canonical.gift_ability_cond` 한 행 */
export interface AbilityCond {
	giftId: string;
	level: number;
	ordinal: number;
	group: number;
	idx: number;
	refKind: string;
	refId: string;
	op: string;
	threshold: number | null;
	scope: string;
	supply: string;
	slot: number | null;
	runtime: boolean;
	resonanceMode: string | null;
}

export interface JudgeInput {
	tables: SupplyTables;
	squad: Squad;
	/** 한 기프트의 능력 전부 (한 강화 단계) */
	abilities: Ability[];
	/** ordinal(문자열) → 그 능력의 조건들 */
	condsByAbility: Map<string, AbilityCond[]>;
}

export interface CondVerdict {
	verdict: 'satisfied' | 'unsatisfied' | 'unknown';
	have: number;
	need: number | null;
}

/**
 * 조건 하나를 본다.
 *
 * `unknown` 은 **배제하지 않는다**는 뜻이다 — 전투 중에만 아는 것(`runtime`),
 * 문턱을 못 찾은 것(`op≠has` 인데 `threshold=null`), 셀 방법이 없는 것(`-1`).
 */
export function judgeCond(t: SupplyTables, squad: Squad, c: AbilityCond): CondVerdict {
	if (c.runtime) return { verdict: 'unknown', have: 0, need: c.threshold };
	const have = countSupply(t, squad, c);
	if (have < 0) return { verdict: 'unknown', have: 0, need: c.threshold };
	if (c.op === 'has') {
		return { verdict: have >= 1 ? 'satisfied' : 'unsatisfied', have, need: 1 };
	}
	if (c.threshold === null) return { verdict: 'unknown', have, need: null };
	if (c.op === 'eq') {
		return { verdict: have === c.threshold ? 'satisfied' : 'unsatisfied', have, need: c.threshold };
	}
	return { verdict: have >= c.threshold ? 'satisfied' : 'unsatisfied', have, need: c.threshold };
}

/** 이 능력이 이 편성에서 설 수 있나 */
function abilityFires(
	t: SupplyTables, squad: Squad, cs: AbilityCond[], unconditional: boolean,
): boolean {
	if (unconditional) return true;
	// 조건이 하나도 없다 = 「조건이 있는 줄은 아는데 못 뽑았다」. 결손이므로 안 막는다
	if (cs.length === 0) return true;
	const groups = new Map<number, AbilityCond[]>();
	for (const c of cs) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
	// group 끼리 AND · group 안은 OR
	return [...groups.values()].every((g) =>
		g.some((c) => judgeCond(t, squad, c).verdict !== 'unsatisfied'));
}

export function judgeGift(input: JudgeInput): { fireable: boolean; reasons: Reason[] } {
	const { tables, squad, abilities, condsByAbility } = input;

	const reasons: Reason[] = [];
	for (const a of abilities) {
		for (const c of condsByAbility.get(String(a.ordinal)) ?? []) {
			const j = judgeCond(tables, squad, c);
			reasons.push({
				// 절 모형에는 트리거가 없다. 어느 절의 몇 번째 조건인지를 담는다 —
				// 화면이 「왜 그런가」를 보이려면 자리를 알아야 한다
				triggerId: `${a.ordinal}/${c.group}/${c.idx}`,
				refKind: c.refKind, refId: c.refId,
				verdict: j.verdict,
				/**
				 * **충족은 언제나 확정이다.** 옛 모형의 `roster_gated` 는 트리거
				 * 이름 접미사로 지어낸 것이라 「가능」을 남발했다. 절 조건은
				 * 문장에서 뽑은 것이라 그런 어림이 없다 — 전투 중에만 아는 것은
				 * `runtime` 으로 따로 적히고 `unknown` 이 된다.
				 */
				certainty: 'certain',
				have: j.have, need: j.need,
				denominator: j.need === null ? null : c.scope,
				// 강화판의 조건은 켜짐을 못 막는다 — 원 능력에 딸린 것이다
				blocking: a.refines === null,
			});
		}
	}

	// 능력이 하나도 없으면 판정 보류다 — 아직 절을 안 뽑은 기프트를 죽이면 안 된다
	const independent = abilities.filter((a) => a.refines === null);
	if (independent.length === 0) return { fireable: true, reasons };

	const fireable = independent.some((a) =>
		abilityFires(tables, squad, condsByAbility.get(String(a.ordinal)) ?? [], a.unconditional));
	return { fireable, reasons };
}
