/**
 * 어휘 사전 — 원본 토큰을 효과 단위와 조건 DSL 로 옮긴다.
 *
 * **이것이 저작층이다.** 토큰 자체는 원본에서 추출해 `gift_token` 에 그대로 담았고
 * (해석 없음), 그것을 우리 어휘로 옮기는 규칙만 여기 있다
 * (`03-data-provenance.md` 6절이 3단계의 몫으로 남긴 일).
 *
 * **조용한 누락을 금지한다**(ADR-02 원칙 1). 사전에 없는 토큰은 `UNCLASSIFIED` 로 통과시키지 않고
 * 목록으로 돌려주며, 커버리지 게이트가 그것을 실패로 판정한다.
 *
 * 실측 어휘는 효과 55종 · 발동 150종이다(2026-07-25 스냅샷).
 */

import { SITUATIONAL_RATE } from './tuning';

// ── 효과 ──────────────────────────────────────────────────────

/** 상태 키워드. 게임의 내부 식별자가 아니라 우리 축의 이름이다. */
export type StatusKey =
	| 'burn'
	| 'bleed'
	| 'tremor'
	| 'rupture'
	| 'sinking'
	| 'poise'
	| 'charge'
	| 'bloodfeast';

export interface EffectUnit {
	/** 가중치를 붙일 유형 */
	type: string;
	/** 상태를 다루는 효과면 그 상태 */
	status?: StatusKey;
	/** 적용 대상 범위 */
	target: string;
	/** 원본 토큰. 근거 표시에 쓴다 */
	token: string;
}

const STATUS_OF: Record<string, StatusKey> = {
	Burn: 'burn',
	Bleed: 'bleed',
	Tremor: 'tremor',
	Rupture: 'rupture',
	Sinking: 'sinking',
	Poise: 'poise',
	Charge: 'charge',
	Bloodfeast: 'bloodfeast',
};

/**
 * 효과 토큰 → 효과 단위.
 *
 * `Inflict {상태} Potency|Count` 와 `Gain {상태} Potency|Count` 는 규칙으로 잡고,
 * 나머지는 명시 표로 잡는다. 규칙과 표 어느 쪽에도 없으면 null 이다.
 */
export function mapEffect(token: string): EffectUnit | null {
	const inflict = /^Inflict (\w+) (Potency|Count)$/.exec(token);
	if (inflict) {
		const status = STATUS_OF[inflict[1] as string];
		if (status) {
			return {
				type: inflict[2] === 'Count' ? 'INFLICT_COUNT' : 'INFLICT_POTENCY',
				status,
				target: 'ALL_ENEMIES',
				token,
			};
		}
	}
	const gain = /^Gain (\w+) (Potency|Count)$/.exec(token);
	if (gain) {
		const status = STATUS_OF[gain[1] as string];
		if (status) {
			return { type: 'GAIN_STATUS', status, target: 'ALL_ALLIES', token };
		}
	}
	const trigger = /^Trigger Additional (\w+)$/.exec(token);
	if (trigger) {
		const status = STATUS_OF[trigger[1] as string];
		if (status) return { type: 'TRIGGER_EXTRA', status, target: 'ALL_ENEMIES', token };
	}
	const damage = /^Deal (\w+) Damage$/.exec(token);
	if (damage) return { type: 'DAMAGE_ADD', target: 'TARGET', token };

	const table = EFFECT_TABLE[token];
	return table ? { ...table, token } : null;
}

const EFFECT_TABLE: Record<string, Omit<EffectUnit, 'token'>> = {
	'Deal More Damage': { type: 'DAMAGE_ADD', target: 'TARGET' },
	'Deal Fixed Damage': { type: 'DAMAGE_FIXED', target: 'TARGET' },
	'Take Less Damage': { type: 'DAMAGE_TAKEN_DOWN', target: 'ALL_ALLIES' },
	'Gain Skill Power': { type: 'SKILL_POWER', target: 'ALL_ALLIES' },
	'Reduce Skill Power': { type: 'SKILL_POWER', target: 'ALL_ENEMIES' },
	'Gain Coin Power': { type: 'COIN_POWER', target: 'ALL_ALLIES' },
	'Gain Offense Level Up': { type: 'OFFENSE_LEVEL', target: 'ALL_ALLIES' },
	'Inflict Offense Level Down': { type: 'OFFENSE_LEVEL', target: 'ALL_ENEMIES' },
	'Gain Defense Level Up': { type: 'DEFENSE_LEVEL', target: 'ALL_ALLIES' },
	'Inflict Defense Level Down': { type: 'DEFENSE_LEVEL', target: 'ALL_ENEMIES' },
	'Gain Speed / Haste': { type: 'SPEED', target: 'ALL_ALLIES' },
	'Reduce Speed / Bind': { type: 'SPEED', target: 'ALL_ENEMIES' },
	'Heal HP': { type: 'HEAL_HP', target: 'ALL_ALLIES' },
	'Heal SP': { type: 'HEAL_SP', target: 'ALL_ALLIES' },
	'Gain Shield': { type: 'SHIELD', target: 'ALL_ALLIES' },
	'Gain Buff': { type: 'BUFF_GENERIC', target: 'ALL_ALLIES' },
	'Inflict Debuff': { type: 'DEBUFF_GENERIC', target: 'ALL_ENEMIES' },
	'Increase Enemy Resist': { type: 'DEBUFF_GENERIC', target: 'ALL_ENEMIES' },
	'Gain E.G.O Resource': { type: 'RESOURCE', target: 'ALL_ALLIES' },
	'Gain Cost': { type: 'ECONOMY', target: 'ALL_ALLIES' },
	'Shop Discount': { type: 'ECONOMY', target: 'ALL_ALLIES' },
	'Chance for Refund': { type: 'ECONOMY', target: 'ALL_ALLIES' },
	'Deal SP Damage': { type: 'DAMAGE_ADD', target: 'ALL_ENEMIES' },
	'Generate Bloodfeast': { type: 'GAIN_STATUS', status: 'bloodfeast', target: 'ALL_ALLIES' },
	'Consume Bloodfeast': { type: 'CONSUME_STATUS', status: 'bloodfeast', target: 'ALL_ALLIES' },
	'Consume Charge': { type: 'CONSUME_STATUS', status: 'charge', target: 'ALL_ALLIES' },
	'Trigger Tremor Burst': { type: 'TRIGGER_EXTRA', status: 'tremor', target: 'ALL_ENEMIES' },
	'Trigger Amplitude Conversion/Entanglement': {
		type: 'TRIGGER_EXTRA',
		status: 'tremor',
		target: 'ALL_ENEMIES',
	},
	// 원본이 "그 외"로 뭉뚱그린 토큰. 분류 불가가 아니라 원본이 분류하지 않은 것이다.
	'Other Uncommon Effects': { type: 'UNCLASSIFIED', target: 'SELF' },
};

// ── 발동 조건 ─────────────────────────────────────────────────

export type Condition =
	| { op: 'ALWAYS' }
	| { op: 'AND'; conditions: Condition[] }
	| { op: 'COUNT_AFFILIATION'; affiliation: string; atLeast: number }
	| { op: 'RESONANCE'; sin: string; absolute: boolean }
	| { op: 'ANY_RESONANCE'; absolute: boolean }
	| { op: 'SKILL_SUPPLIES'; status: StatusKey }
	| { op: 'ATTACK_TYPE_USED'; atkType: string }
	| { op: 'SIN_SKILL'; sin: string }
	| { op: 'HAS_STATUS'; status: StatusKey; side: 'ally' | 'enemy' }
	| { op: 'SITUATIONAL'; rate: number; token: string };

const SIN_OF: Record<string, string> = {
	Wrath: 'wrath',
	Lust: 'lust',
	Sloth: 'sloth',
	Gluttony: 'gluttony',
	Gloom: 'gloom',
	Pride: 'pride',
	Envy: 'envy',
};

const ATK_OF: Record<string, string> = { Slash: 'slash', Pierce: 'pierce', Blunt: 'blunt' };

/**
 * 소속 이름 별칭.
 *
 * **발동 토큰이 소속 목록과 다른 표기를 쓴다.** `Assoc.` 은 `Association` 의 줄임이고
 * `Yurodivy` 는 `Yurodiviye` 의 다른 표기다. `Lobotomy Corp.` 은 우리 목록에서 본사와 지부로
 * 갈려 있어 어느 한쪽으로 정할 수 없다 — 본사를 쓴다(인원이 9명으로 더 많다).
 *
 * 이 표는 실측으로 만들었다. 미분류 10종을 하나씩 확인해 이어 붙인 것이며 추정이 아니다.
 */
const AFFILIATION_ALIAS: Record<string, string> = {
	'Cinq Assoc.': 'Cinq Association',
	'Dieci Assoc.': 'Dieci Association',
	'Liu Assoc.': 'Liu Association',
	'Seven Assoc.': 'Seven Association',
	'Shi Assoc.': 'Shi Association',
	'Zwei Assoc.': 'Zwei Association',
	'Öufi Assoc.': 'Öufi Association',
	"Devyat' Assoc.": "Devyat' Association",
	Yurodivy: 'Yurodiviye',
	'Lobotomy Corp.': 'Lobotomy Corp. Headquarters',
};

function resolveAffiliation(raw: string, known: ReadonlySet<string>): string | null {
	if (known.has(raw)) return raw;
	const alias = AFFILIATION_ALIAS[raw];
	return alias && known.has(alias) ? alias : null;
}

/**
 * 발동 토큰 → 조건.
 *
 * 죄악은 여기서만 쓴다. **`{죄악} Resonance`** 는 인격 스킬의 죄악 분포로 판정하는 실제 게임
 * 메커니즘이며, 기프트의 색 속성(`attributeType`)과는 무관하다
 * (`backlog/03-gift-affinity.md`).
 */
export function mapTrigger(token: string, affiliations: ReadonlySet<string>): Condition | null {
	if (token === 'Always') return { op: 'ALWAYS' };

	// `{소속} Identities` — 실제 소속 목록에 있는 것만 조건으로 인정한다.
	const ident = /^(.+) Identities$/.exec(token);
	if (ident) {
		const named = resolveAffiliation(ident[1] as string, affiliations);
		if (named) {
			// 원본 토큰에 인원수가 없다. 설명문에만 있으며 여기서는 3인을 기본으로 둔다
			// (실측 조건 문구가 대부분 3인 이상이다). 정밀화는 후속이다.
			return { op: 'COUNT_AFFILIATION', affiliation: named, atLeast: 3 };
		}
	}

	const anyReso = /^Any (Absolute )?Resonance$/.exec(token);
	if (anyReso) {
		// 죄악을 가리지 않는 공명. 어느 죄악이든 되므로 가장 두꺼운 축으로 판정한다.
		return { op: 'ANY_RESONANCE', absolute: anyReso[1] !== undefined };
	}

	if (false) {
		// unreachable
	}

	const reso = /^(\w+) (Absolute )?Resonance$/.exec(token);
	if (reso && SIN_OF[reso[1] as string]) {
		return {
			op: 'RESONANCE',
			sin: SIN_OF[reso[1] as string] as string,
			absolute: reso[2] !== undefined,
		};
	}

	// `{X} Skill Used` — X 가 상태·공격 타입·죄악 중 무엇인지로 갈린다.
	// **죄악이 여기서 두 번째로 쓰인다.** 인격 스킬의 죄악 분포로 판정하며 기프트의 색과 무관하다.
	const skill = /^(.+?) (E\.G\.O )?Skill Used$/.exec(token);
	if (skill) {
		const what = skill[1] as string;
		const isEgo = skill[2] !== undefined;
		const status = STATUS_OF[what];
		// E.G.O 스킬은 매 턴 쓰지 않는다. 같은 조건이라도 발동 빈도가 낮다.
		if (status) {
			return isEgo
				? { op: 'AND', conditions: [{ op: 'SKILL_SUPPLIES', status }, { op: 'SITUATIONAL', rate: 0.3, token }] }
				: { op: 'SKILL_SUPPLIES', status };
		}
		const atk = ATK_OF[what];
		if (atk) return { op: 'ATTACK_TYPE_USED', atkType: atk };
		const sin = SIN_OF[what];
		if (sin) {
			return isEgo
				? { op: 'AND', conditions: [{ op: 'SIN_SKILL', sin }, { op: 'SITUATIONAL', rate: 0.3, token }] }
				: { op: 'SIN_SKILL', sin };
		}
		// 방어 스킬·코인 구성·공격 가중 등 덱 구성으로 판정할 수 없는 것은 상황성으로 둔다.
		const rate = SKILL_SHAPE_RATE[what];
		if (rate !== undefined) return { op: 'SITUATIONAL', rate: isEgo ? rate * 0.5 : rate, token };
		if (what === 'E.G.O' || isEgo) return { op: 'SITUATIONAL', rate: 0.3, token };
	}

	const enemyHas = /^Enemies have (\w+)$/.exec(token);
	if (enemyHas && STATUS_OF[enemyHas[1] as string]) {
		return { op: 'HAS_STATUS', status: STATUS_OF[enemyHas[1] as string] as StatusKey, side: 'enemy' };
	}
	const allyHas = /^Allies have (\w+)$/.exec(token);
	if (allyHas && STATUS_OF[allyHas[1] as string]) {
		return { op: 'HAS_STATUS', status: STATUS_OF[allyHas[1] as string] as StatusKey, side: 'ally' };
	}
	const hitWith = /^Hit Enemy with (\w+)$/.exec(token);
	if (hitWith && STATUS_OF[hitWith[1] as string]) {
		return {
			op: 'AND',
			conditions: [
				{ op: 'HAS_STATUS', status: STATUS_OF[hitWith[1] as string] as StatusKey, side: 'enemy' },
				{ op: 'SITUATIONAL', rate: 0.7, token },
			],
		};
	}

	if (/^(Allies|Enemies) with (Shield|.+)$/.test(token) && !/ Condition$/.test(token)) {
		return { op: 'SITUATIONAL', rate: 0.45, token };
	}

	const rate = SITUATIONAL_TABLE[token];
	if (rate !== undefined) return { op: 'SITUATIONAL', rate, token };

	// `Allies with HP Condition` 처럼 원본이 조건을 뭉뚱그린 것도 상황성으로 둔다.
	if (/^(Allies|Enemies) with .+ Condition$/.test(token)) {
		return { op: 'SITUATIONAL', rate: 0.5, token };
	}
	if (/^Allies have .+$/.test(token) || /^Enemies have .+$/.test(token)) {
		return { op: 'SITUATIONAL', rate: 0.5, token };
	}

	return null;
}

/**
 * 스킬의 '형태' 조건. 코인 구성·공격 가중·방어 종류는 인격 데이터로 셀 수는 있으나
 * 스킬 단위 수치가 없어(02-data-model 8절) 지금은 빈도로 근사한다.
 */
const SKILL_SHAPE_RATE: Record<string, number> = {
	'Plus Coin': 0.6,
	'Minus Coin': 0.35,
	'Single-Coin': 0.4,
	'1 Atk Weight': 0.5,
	'2+ Atk Weight': 0.4,
	Ammo: 0.2,
	Guard: 0.35,
	Evade: 0.3,
	Counter: 0.3,
};

/** 전투 중에만 성립하는 트리거. 덱 구성으로 판정할 수 없어 빈도로 근사한다. */
const SITUATIONAL_TABLE: Record<string, number> = {
	'Deployment Position': 0.85,
	'Other Uncommon Triggers': SITUATIONAL_RATE,
	'Clash Win': 0.55,
	'Clash Lose': 0.3,
	'Enemy Defeated': 0.5,
	'Ally Defeated': 0.2,
	'Hit Enemy': 0.85,
	'Ally Hit': 0.6,
	'Ally Not Hit': 0.4,
	'Critical Hit': 0.35,
	'Staggered Target': 0.4,
	'Staggered Ally': 0.2,
	'Target is Slower': 0.5,
	'Target is Faster': 0.5,
	'Speed Difference': 0.5,
	'Backup Allies': 0.6,
	'Backup Enemies': 0.4,
	Discard: 0.3,
	'Consumed Charge': 0.4,
	'Consumed Tremor': 0.4,
	'Consumed Bloodfeast': 0.3,
	'Gain Charge': 0.4,
	'Trigger Tremor Burst': 0.45,
	'Trigger Amplitude Conversion/Entanglement': 0.35,
	'Apply Burn or Unique Burn': 0.7,
};

// ── 커버리지 게이트 ───────────────────────────────────────────

export interface Coverage {
	effects: { total: number; mapped: number; unmapped: string[] };
	triggers: { total: number; mapped: number; unmapped: string[] };
}

/**
 * 사전이 어휘를 전부 덮는지 판정한다.
 *
 * **미분류가 하나라도 있으면 실패다.** 조용히 기본값으로 넘기면 점수가 그럴듯하게 나오면서
 * 근거가 틀린다 — 그것이 이 프로젝트가 1단계부터 피해 온 실패 방식이다.
 */
export function checkCoverage(
	effectTokens: readonly string[],
	triggerTokens: readonly string[],
	affiliations: ReadonlySet<string>,
): Coverage {
	const eUn = [...new Set(effectTokens)].filter((t) => mapEffect(t) === null).sort();
	const tUn = [...new Set(triggerTokens)].filter((t) => mapTrigger(t, affiliations) === null).sort();
	const eAll = new Set(effectTokens).size;
	const tAll = new Set(triggerTokens).size;
	return {
		effects: { total: eAll, mapped: eAll - eUn.length, unmapped: eUn },
		triggers: { total: tAll, mapped: tAll - tUn.length, unmapped: tUn },
	};
}
