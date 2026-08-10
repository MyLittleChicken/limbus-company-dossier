/**
 * `canonical` 에서 평가에 필요한 것만 읽는다.
 *
 * **이 파일에만 DB 가 있다.** `profile`·`evaluate`·`chain` 은 순수 함수라 평범한
 * 배열만 받는다 — 테스트가 DB 없이 돌고, 나중에 다른 저장소로 옮길 때 이 파일
 * 하나만 갈아 끼우면 된다.
 *
 * 읽는 양은 편성과 무관하게 고정이다.
 *   v_identity_capability  ~2,700행    trigger_ref 150 · effect_ref 55
 *   gift_trigger 1,081 · gift_effect 1,123 · gift_trigger_param 188
 * 한 번 읽어 캐시할 크기이며, 편성마다 다시 읽을 이유가 없다.
 */
import { PrismaClient } from '../../../src/v2/generated/client.js';
import type { EffectRef } from './chain.js';
import type { Recipe } from './fusion.js';
import type { Capability, TriggerParam, TriggerRef } from './types.js';

export interface EngineData {
	capabilities: Capability[];
	refsByTrigger: Map<string, TriggerRef[]>;
	giftTriggers: Map<string, string[]>;
	giftEffects: Map<string, string[]>;
	effectRefs: Map<string, EffectRef[]>;
	giftRefs: Map<string, Array<{ refKind: string; refId: string }>>;
	params: TriggerParam[];
	recipes: Recipe[];
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
	const [caps, refs, giftTrigger, giftEffect, effectRef, params, fusionSlot, fusionOption] =
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
			prisma.giftTriggerParam.findMany({
				select: { giftId: true, triggerId: true, kind: true, tier: true, value: true, slots: true },
			}),
			prisma.fusionSlot.findMany({
				select: { giftId: true, recipeIdx: true, slotIdx: true, materialId: true },
				orderBy: [{ giftId: 'asc' }, { recipeIdx: 'asc' }, { slotIdx: 'asc' }],
			}),
			prisma.fusionSlotOption.findMany({
				select: { giftId: true, recipeIdx: true, slotIdx: true, materialId: true },
				orderBy: [{ giftId: 'asc' }, { recipeIdx: 'asc' }, { slotIdx: 'asc' }],
			}),
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

	return {
		capabilities: caps,
		refsByTrigger,
		giftTriggers,
		giftEffects: group(giftEffect, (r) => r.giftId, (r) => r.effectId),
		effectRefs: group(effectRef, (r) => r.effectId, (r) => r),
		giftRefs,
		params,
		recipes,
	};
}
