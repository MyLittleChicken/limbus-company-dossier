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

/**
 * 상태 키워드. 게임의 내부 식별자가 아니라 우리 축의 이름이다.
 *
 * 마지막 둘은 **상태 기믹**이며 앞의 것들과 성격이 다르다. 키워드는 기프트를 나누는
 * 분류이고 소속은 인격의 배경 태그인데, 탄환·보호는 인격이 공급하고 기프트가 조건으로
 * 참조하는 자원이다. 축이 셋이라는 것은 backlog/04 가 전수 확인했다 — 기프트 발동 토큰
 * 150종이 참조하는 기믹 중 분류 밖은 이 둘뿐이다.
 */
export type StatusKey =
	| 'burn'
	| 'bleed'
	| 'tremor'
	| 'rupture'
	| 'sinking'
	| 'poise'
	| 'charge'
	| 'bloodfeast'
	// ── 상태 기믹 (특수) ──
	| 'ammo'
	| 'protection';

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
	// 상태 기믹 — 인격은 이미 이 축을 공급한다(Task 2). 여기 이어야 조건이 그것을 참조한다
	// (backlog/04-status-mechanics.md 7절). 원본 토큰 표기(Ammo·Shield)와 우리 축 이름
	// (ammo·protection)이 다르다는 점만 다르고, 나머지 여덟과 같은 표다.
	Ammo: 'ammo',
	Shield: 'protection',
};

/**
 * 상태 id 는 1,472종이라 키워드 축으로 접는다. 이름이 아니라 id 로 판정한다(02-data-model 3.10).
 *
 * **어휘 사전에 둔다.** 적재 계층(`load.ts`)에 있으면 이 표의 단위 테스트가 `@/lib/db` 를 거쳐
 * `PrismaClient` 를 끌고 와, 데이터베이스와 무관한 문자열 판정에 생성된 클라이언트가 필요해진다.
 */
const STATUS_MATCH: Array<[StatusKey, RegExp]> = [
	// 상태 기믹(특수). 키워드가 아니라 자원이며 별개 축이다(backlog/04 3·4절).
	// **먼저 판정한다.** `BurstProtection`(파열 보호) 은 이름에 `Burst` 를 품어 뒤에 있는
	// rupture 패턴(`/burst|rupture/i`)에도 걸린다 — 실측상 보호 자원이므로 여기서 먼저 잡아
	// 그 축을 가로챈다(파생 범위는 backlog/04 3·4절 실측: 호표탄 계열은 탄환, 파열 보호는 보호).
	['ammo', /^(Accel)?Bullet(Godok|Lament|Propellant(Special)?)?$/i],
	['protection', /^(Burst)?Protection$/i],
	['burn', /combustion|(^|[^a-z])burn/i],
	['bleed', /laceration|bleed/i],
	['tremor', /vibration|tremor/i],
	['rupture', /burst|rupture/i],
	['sinking', /sinking/i],
	['poise', /breath|poise/i],
	['charge', /charge/i],
	['bloodfeast', /bloodfeast/i],
];

export function statusKeyOf(statusId: string): StatusKey | null {
	for (const [key, re] of STATUS_MATCH) if (re.test(statusId)) return key;
	return null;
}

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
	| {
			op: 'COUNT_AFFILIATION';
			affiliation: string;
			atLeast: number;
			/**
			 * 판정 범위. 원본 토큰에는 없고 설명문에만 있다.
			 *
			 * **선택 필드다.** 필수로 두면 `Condition` 이 좁아져 `evaluate` 의 인자 타입이
			 * 함께 좁아지고, 이 계획이 스스로 정한 "공개 시그니처를 바꾸지 않는다" 를 깬다.
			 * 없으면 설명문에도 표지가 없었다는 뜻이며 예전 근사(둘 중 큰 쪽)를 쓴다.
			 */
			scope?: 'deck' | 'deployed';
	  }
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
			// 원본 토큰에 인원수도 판정 범위도 없다. 설명문에만 있으며 여기서는 3인을 기본으로
			// 둔다(실측 조건 문구가 대부분 3인 이상이다). `scope` 는 선택 필드라 넣지 않는다 —
			// 없는 것이 곧 "표지가 없었다"는 뜻이다. 정밀화는 `refineAffiliation`.
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

	// `Allies have Ammo Skill` — `{X} Skill Used` 와 뜻은 같은데(탄환 스킬 공급) 표기가 다르다.
	// 다른 축(화상·충전 등)도 `Allies have {X} Skill` 형태 토큰을 쓰지만 그건 이번 배선 대상이
	// 아니다 — 여기서 일반화하면 탄환·보호 배선을 넘어 54건이 한꺼번에 움직인다.
	// 실측(`Allies have Ammo Skill` 1건)에 맞춘 것만 좁게 잡는다.
	if (token === 'Allies have Ammo Skill') {
		return { op: 'SKILL_SUPPLIES', status: 'ammo' };
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

	// `Allies/Enemies with {상태}` — 아래 catch-all 보다 먼저 와야 한다. 안 그러면 `Shield` 도
	// `STATUS_OF` 조회 없이 상황성으로 뭉개진다(예전에 실제로 그랬다). `enemyHas`/`allyHas` 와
	// 같은 모양이지만 원본이 "have" 대신 "with" 를 쓰는 토큰이라 갈래를 나눴다.
	const enemyWith = /^Enemies with (\w+)$/.exec(token);
	if (enemyWith && STATUS_OF[enemyWith[1] as string]) {
		return { op: 'HAS_STATUS', status: STATUS_OF[enemyWith[1] as string] as StatusKey, side: 'enemy' };
	}
	const allyWith = /^Allies with (\w+)$/.exec(token);
	if (allyWith && STATUS_OF[allyWith[1] as string]) {
		return { op: 'HAS_STATUS', status: STATUS_OF[allyWith[1] as string] as StatusKey, side: 'ally' };
	}

	// catch-all — 실측(2026-07-28, gift_token 전수)으로 `Allies/Enemies with ...` 형 발동
	// 토큰은 `Shield`(위에서 이제 가로챈다) 와 `HP/SP/Speed Condition`(아래 `with .+ Condition`
	// 갈래가 가져간다) 뿐이라, 지금은 이 catch-all 에 실제로 떨어지는 토큰이 없다. 그래도
	// 지운 게 아니라 순서만 바꿨다 — 미래에 다른 `with X` 토큰이 추가되면 여전히 걸린다.
	if (/^(Allies|Enemies) with .+$/.test(token) && !/ Condition$/.test(token)) {
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
 * 설명문으로 소속 조건을 정밀화한다.
 *
 * 원본 토큰(`{소속} Identities`)에는 인원수도 판정 범위도 없다. 둘 다 설명문에만 있다.
 * 실측 18건 중 15건이 범위 표지를 갖고, 인원수는 2·3·4인으로 갈린다 — 일괄 3인 가정은
 * 그중 4건에서 틀렸다.
 *
 * **설명문 전체에서 정규식을 돌리면 안 된다.** 기프트 설명문은 여러 효과 문단이 이어 붙은
 * 것이고, 그중 소속 조건과 무관한 문단에도 "N인 이상"·"대기 인원 포함/제외" 가 나온다
 * (예: `9216`·`9730`·`9740`·`9795` 는 "{상태} 스킬 보유 인격 N인 이상" 이라는 별개 게이트를
 * 말하고 있었고, `9253` 은 인격별 전용 배율 문장이 "대기 인원 포함" 을 썼다 — 전부 소속
 * 인원수와 무관하다). 전체 훑기는 이 무관한 문장을 소속 조건의 것으로 오인한다.
 *
 * 그래서 **소속의 한국어 이름이 실제로 나오는 줄로 범위를 좁힌다.** 실측(2026-07-28,
 * `gift_description` 전수)으로 확인한 절 구분자는 문단 사이 빈 줄이 아니라 **줄바꿈
 * 하나**다 — 인원수·판정 범위 표지는 소속 이름과 같은 줄에 함께 온다
 * (`피쿼드호 소속 인격이 3인 이상일 때 발동 (대기 인원 포함)`). 소속 이름이 나오는 줄 중
 * `N인 이상` 을 포함한 첫 줄을 취하고, 판정 범위 표지도 **그 줄에서만** 찾는다.
 *
 * 이름이 나오는 줄이 없거나, 나오는 줄 어디에도 인원수가 없으면 **기존 값을 그대로
 * 유지한다**(`scope` 없음, 원래 `atLeast`). 없는 근거를 지어내지 않는다 — 무관한
 * 줄의 표지를 빌려 오지 않는다.
 *
 * **인원수는 두 경우에 읽지 않는다.** 판정 범위는 두 경우에도 읽는다 — 합집합이든
 * 단계별이든 *어느 인원을 세는가* 는 하나다.
 *
 *   소속 토큰이 둘 이상인 기프트. 설명문이 "검계 **또는** 흑운회 소속이 4인 이상"처럼
 *   합집합을 말하는데(9712) 엔진은 발동 조건을 AND 로 묶는다. 4를 그대로 넣으면 "검계
 *   4명이면서 흑운회 4명"이 되어 일괄 3인보다 더 틀린다. 실측으로 소속 토큰이 둘인
 *   기프트는 9246·9712·9713·9782 넷이고, 그중 인원수를 말하는 것은 9712 뿐이다.
 *
 *   한 줄에 인원수가 여럿인 기프트. 단계별 강화라 임계값 하나로 담기지 않는다. 실측에는
 *   없다(9270 은 단계가 줄로 나뉘어 있어 줄 단위로 읽으면 걸리지 않는다) — 앞으로 생길
 *   경우를 막는 안전망이다.
 */
export function refineAffiliation(
	condition: Extract<Condition, { op: 'COUNT_AFFILIATION' }>,
	desc: string,
	koreanName: string | undefined,
	/** 이 기프트가 가진 소속 조건의 수. 둘 이상이면 설명문의 인원수가 합집합의 것이다. */
	affiliationTokens = 1,
): Extract<Condition, { op: 'COUNT_AFFILIATION' }> {
	if (!koreanName) return condition;

	// `N인 이상` 에만 건다 — "공격 가중치가 1인 스킬" 처럼 무관한 숫자도 데이터에 있다.
	const line = desc.split('\n').find((l) => l.includes(koreanName) && /[0-9]+인 이상/.test(l));
	if (!line) return condition;

	const counts = line.match(/[0-9]+인 이상/g) ?? [];
	// 인원수를 못 읽는 경우에도 판정 범위는 읽는다. `scope` 만 붙이고 `atLeast` 는 그대로 둔다.
	const atLeast =
		affiliationTokens > 1 || counts.length > 1
			? condition.atLeast
			: Number(/([0-9]+)인 이상/.exec(line)![1]);

	const scope: 'deck' | 'deployed' | undefined =
		/출격 인원을 기준|대기 인원 제외/.test(line) ? 'deployed'
		: /편성 인원을 기준|대기 인원 포함/.test(line) ? 'deck'
		: undefined;

	// `scope: undefined` 를 실어 보내면 표지 없음과 구별되지 않으므로 있을 때만 붙인다.
	return scope === undefined ? { ...condition, atLeast } : { ...condition, scope, atLeast };
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
	// Ammo 는 여기 없다 — `STATUS_OF` 조회가 먼저라 `Ammo Skill Used` 는 이제 이 표에 도달하지
	// 않는다(위 `{X} Skill Used` 분기). 남겨 두면 죽은 값이라 지웠다.
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
