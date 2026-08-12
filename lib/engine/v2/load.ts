/**
 * `canonical` 에서 평가에 필요한 것만 읽는다.
 *
 * **이 파일에만 DB 가 있다.** `profile`·`evaluate`·`chain` 은 순수 함수라 평범한
 * 배열만 받는다 — 테스트가 DB 없이 돌고, 나중에 다른 저장소로 옮길 때 이 파일
 * 하나만 갈아 끼우면 된다.
 *
 * 읽는 양은 편성과 무관하게 고정이다.
 *   v_identity_capability  ~2,700행    gift_ability 898 · gift_ability_cond 642
 *   trigger_ref 150 · effect_ref 55 · gift_trigger 1,081 · gift_effect 1,123
 * 한 번 읽어 캐시할 크기이며, 편성마다 다시 읽을 이유가 없다.
 *
 * **`gift_trigger_param` 은 더 안 읽는다**(2026-08-12). 판정이 절로 옮겨가며
 * 그 표를 보는 곳이 옛 판정(`evaluateGiftsLegacy`)뿐이 됐고, 옛 판정은
 * `scripts/verdict-diff.ts` 가 대조용으로만 부른다 — 그 스크립트가 직접 읽는다.
 * 남은 넷(`trigger_ref`·`gift_trigger`·`gift_effect`·`effect_ref`)은 연쇄
 * (`chain.ts`)가 아직 쓴다.
 */
import { PrismaClient } from '../../../src/v2/generated/client.js';
import type { Ability, AbilityCond } from './ability.js';
import type { EffectRef } from './chain.js';
import type { Recipe } from './fusion.js';
import type { SupplyTables } from './supply.js';
import type { Capability, TriggerRef } from './types.js';

/** 절 조건이 세는 축. `coin_token` 은 어휘가 훨씬 넓어 이 여덟만 걸러야 한다 */
const AXES = ['COMBUSTION', 'LACERATION', 'BURST', 'BREATH',
	'VIBRATION', 'SINKING', 'CHARGE', 'BULLET'];

export interface EngineData {
	capabilities: Capability[];
	refsByTrigger: Map<string, TriggerRef[]>;
	giftTriggers: Map<string, string[]>;
	giftEffects: Map<string, string[]>;
	effectRefs: Map<string, EffectRef[]>;
	giftRefs: Map<string, Array<{ refKind: string; refId: string }>>;
	recipes: Recipe[];
	/**
	 * 절 단위 능력 — `canonical.gift_ability`. **level 0 만 읽는다.**
	 *
	 * 강화 단계는 조건이 달라지지만(110개 중 87개) 추천은 「이 팩에서 이 기프트를
	 * 뽑을까」를 묻지 강화 단계를 묻지 않는다. 단계별 판정은 별도 물음이다.
	 */
	abilities: Map<string, Ability[]>;
	/** giftId → ordinal(문자열) → 그 능력의 조건들 */
	abilityConds: Map<string, Map<string, AbilityCond[]>>;
	/** 절 조건의 공급을 세는 표 */
	supply: SupplyTables;
}

function group<T, V>(rows: T[], key: (r: T) => string, val: (r: T) => V): Map<string, V[]> {
	const out = new Map<string, V[]>();
	for (const r of rows) {
		const k = key(r);
		const list = out.get(k);
		if (list === undefined) out.set(k, [val(r)]);
		else list.push(val(r));
	}
	return out;
}

export async function loadEngineData(prisma: PrismaClient): Promise<EngineData> {
	const [caps, refs, giftTrigger, giftEffect, effectRef, fusionSlot, fusionOption,
		abilityRows, condRows, supplyRows] =
		await Promise.all([
			prisma.$queryRaw<Capability[]>`
				SELECT identity_id AS "identityId", ref_kind AS "refKind",
				       ref_id AS "refId", gate_kind AS "gateKind",
				       gate_ref AS "gateRef", gate_min AS "gateMin",
				       affects AS "affects"
				FROM canonical.v_identity_capability
			`,
			prisma.triggerRef.findMany({
				select: { triggerId: true, refKind: true, refId: true, evaluability: true },
			}),
			prisma.giftTrigger.findMany({ select: { giftId: true, triggerId: true } }),
			prisma.giftEffect.findMany({ select: { giftId: true, effectId: true } }),
			prisma.effectRef.findMany({
				select: { effectId: true, refKind: true, refId: true, mode: true },
			}),
			prisma.fusionSlot.findMany({
				select: { giftId: true, recipeIdx: true, slotIdx: true, materialId: true },
				orderBy: [{ giftId: 'asc' }, { recipeIdx: 'asc' }, { slotIdx: 'asc' }],
			}),
			prisma.fusionSlotOption.findMany({
				select: { giftId: true, recipeIdx: true, slotIdx: true, materialId: true },
				orderBy: [{ giftId: 'asc' }, { recipeIdx: 'asc' }, { slotIdx: 'asc' }],
			}),
			prisma.$queryRaw<Ability[]>`
				SELECT gift_id AS "giftId", level, ordinal, unconditional, refines
				FROM canonical.gift_ability WHERE level = 0
				ORDER BY gift_id, ordinal
			`,
			prisma.$queryRaw<AbilityCond[]>`
				SELECT gift_id AS "giftId", level, ordinal, "group", idx,
				       ref_kind AS "refKind", ref_id AS "refId", op, threshold,
				       scope, supply, slot, runtime, resonance_mode AS "resonanceMode"
				FROM canonical.gift_ability_cond WHERE level = 0
				ORDER BY gift_id, ordinal, "group", idx
			`,
			/**
			 * 공급 표를 한 질의로 모은다 — 갈래를 `k` 로 구분해 왕복을 줄인다.
			 *
			 * `axisSkill` 이 `coin_token` 을 여덟 축으로 거르는 이유는 그 표의
			 * 어휘가 훨씬 넓기 때문이다(500종 넘는 토큰). 거르지 않으면 축이
			 * 아닌 것이 축 자리에 들어온다.
			 */
			prisma.$queryRaw<Array<{ k: string; v: string; identityId: string }>>`
				SELECT 'axisTag' AS k, axis_id AS v, identity_id AS "identityId"
				  FROM canonical.identity_axis
				  WHERE gate_kind = 'always' AND affects IN ('tag','both')
				UNION ALL
				SELECT DISTINCT 'axisSkill', upper(c.token), i.identity_id
				  FROM canonical.identity_skill i
				  JOIN canonical.coin_token c ON c.skill_id = i.skill_id
				  WHERE upper(c.token) = ANY(${AXES})
				UNION ALL
				SELECT 'association', association_id, identity_id
				  FROM canonical.identity_association
				UNION ALL
				SELECT 'unitKeyword', keyword, identity_id FROM canonical.identity_unit_keyword
				UNION ALL
				SELECT DISTINCT 'sin', lower(s.sin::text), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill s ON s.id = i.skill_id
				  WHERE s.sin IS NOT NULL
				UNION ALL
				SELECT DISTINCT 'attackType', lower(s.attack_type::text), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill s ON s.id = i.skill_id
				  WHERE s.attack_type IS NOT NULL
				UNION ALL
				SELECT DISTINCT 'skillKind', lower(s.kind::text), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill s ON s.id = i.skill_id
				  WHERE s.kind IS NOT NULL
				UNION ALL
				SELECT DISTINCT 'minusCoin', 'minus', i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill_stage s ON s.skill_id = i.skill_id
				  WHERE s.coin_value < 0
			`,
		]);

	const refsByTrigger = group(refs, (r) => r.triggerId, (r) => r);
	const giftTriggers = group(giftTrigger, (r) => r.giftId, (r) => r.triggerId);

	// 연쇄가 「이 기프트가 무엇을 보는가」를 묻는다. 트리거를 한 번 더 펴 둔다
	const giftRefs = new Map<string, Array<{ refKind: string; refId: string }>>();
	for (const [giftId, triggerIds] of giftTriggers) {
		const flat = triggerIds.flatMap((t) =>
			(refsByTrigger.get(t) ?? []).map((r) => ({ refKind: r.refKind, refId: r.refId })),
		);
		giftRefs.set(giftId, flat);
	}

	/**
	 * 레시피를 칸 단위로 접는다.
	 *
	 * `material_id` 가 있으면 그 칸의 재료는 하나다. null 이면 선택지형이고
	 * `fusion_slot_option` 이 후보를 담는다(실측 1건).
	 */
	const optionsBySlot = new Map<string, string[]>();
	for (const o of fusionOption) {
		const k = `${o.giftId}|${o.recipeIdx}|${o.slotIdx}`;
		optionsBySlot.set(k, [...(optionsBySlot.get(k) ?? []), o.materialId]);
	}
	const slotsByRecipe = new Map<string, string[][]>();
	for (const s of fusionSlot) {
		const k = `${s.giftId}|${s.recipeIdx}`;
		const opts = s.materialId !== null
			? [s.materialId]
			: optionsBySlot.get(`${s.giftId}|${s.recipeIdx}|${s.slotIdx}`) ?? [];
		slotsByRecipe.set(k, [...(slotsByRecipe.get(k) ?? []), opts]);
	}
	const recipes: Recipe[] = [...slotsByRecipe].map(([k, slots]) => ({
		giftId: k.split('|')[0] as string,
		slots,
	}));

	const abilities = group(abilityRows, (r) => r.giftId, (r) => r);
	const abilityConds = new Map<string, Map<string, AbilityCond[]>>();
	for (const c of condRows) {
		let inner = abilityConds.get(c.giftId);
		if (inner === undefined) {
			inner = new Map<string, AbilityCond[]>();
			abilityConds.set(c.giftId, inner);
		}
		const k = String(c.ordinal);
		inner.set(k, [...(inner.get(k) ?? []), c]);
	}

	/** 갈래별로 갈라 담는다. `minusCoin` 만 Set 이라 따로 꺼낸다 */
	const bucket = (kind: string): Map<string, Set<string>> => {
		const m = new Map<string, Set<string>>();
		for (const r of supplyRows) {
			if (r.k !== kind) continue;
			let s = m.get(r.v);
			if (s === undefined) {
				s = new Set<string>();
				m.set(r.v, s);
			}
			s.add(r.identityId);
		}
		return m;
	};
	const supply: SupplyTables = {
		axisTag: bucket('axisTag'),
		axisSkill: bucket('axisSkill'),
		association: bucket('association'),
		unitKeyword: bucket('unitKeyword'),
		sin: bucket('sin'),
		attackType: bucket('attackType'),
		skillKind: bucket('skillKind'),
		minusCoin: bucket('minusCoin').get('minus') ?? new Set<string>(),
	};

	return {
		capabilities: caps,
		refsByTrigger,
		giftTriggers,
		giftEffects: group(giftEffect, (r) => r.giftId, (r) => r.effectId),
		effectRefs: group(effectRef, (r) => r.effectId, (r) => r),
		giftRefs,
		recipes,
		abilities,
		abilityConds,
		supply,
	};
}
