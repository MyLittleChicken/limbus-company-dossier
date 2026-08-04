/**
 * 설계 16절 6단계 · 결정 6 — 기프트가 기프트를 켠다.
 *
 * 나침반이 적에게 침잠을 쌓으면 「적이 침잠 보유」가 트리거인 다른 기프트가 켜진다.
 * `effect_ref` → 참조 → `trigger_ref` → 기프트가 그 사슬이다.
 *
 * **깊이 2 는 성능이 아니라 설명 가능성 때문이다(결정 6).** 3홉 이상은 사용자가
 * 검증할 수 없는 근거가 된다. 「나침반 → 침잠 → 서릿발 발자국 → 합위력 감소」가
 * 2홉이고 이것이 사람이 납득하는 사슬의 길이다.
 *
 * **`visited` 로 사이클을 막는다.** 자기 루프 21 · 상호 쌍 37 이 실재한다.
 *
 * ── 밀도에 대한 경고 ────────────────────────────────────────────
 * 이 그래프는 희소하지 않다. 실측 간선 123,158 · 밀도 63% · 차수 중앙값 305 다.
 * 어휘가 축 8종으로 굵어서다. 그래서 **연쇄를 「무엇이 켜질 수 있나」로 쓰면
 * 거의 전부가 나와 쓸모가 없다.** 여기서는 반대로 쓴다 —
 * 「내가 든 기프트가 **아직 안 켜진** 기프트를 켜 주는가」만 본다. 이미 편성으로
 * 충족된 참조는 사슬에서 뺀다.
 */
import type { GiftVerdict } from './types.js';

/** `canonical.effect_ref` 한 행 */
export interface EffectRef {
	effectId: string;
	refKind: string;
	refId: string;
	/** inflict | gain | consume | trigger */
	mode: string;
}

export interface ChainInput {
	/** 지금 보유한 기프트 */
	heldGiftIds: string[];
	/** giftId → effectId[] */
	giftEffects: Map<string, string[]>;
	effectRefs: Map<string, EffectRef[]>;
	/** giftId → 그 기프트가 보는 (refKind, refId) 들 */
	giftRefs: Map<string, Array<{ refKind: string; refId: string }>>;
	/** 편성 판정 결과. **미충족 참조만 사슬의 대상이다** */
	verdicts: GiftVerdict[];
}

export interface ChainLink {
	giftId: string;
	depth: number;
	/** 어느 보유 기프트가 무엇을 걸어 켜지는가 */
	via: Array<{ fromGiftId: string; refKind: string; refId: string }>;
}

/** 그 기프트가 거는 것들 — `(refKind, refId)` 집합 */
function inflictedBy(giftId: string, input: ChainInput): Set<string> {
	const out = new Set<string>();
	for (const effectId of input.giftEffects.get(giftId) ?? []) {
		for (const er of input.effectRefs.get(effectId) ?? []) {
			// `consume` 은 없애는 것이라 다음 트리거를 켜지 않는다
			if (er.mode === 'consume') continue;
			if (er.refId === '') continue;
			out.add(`${er.refKind}|${er.refId}`);
		}
	}
	return out;
}

export function chain(input: ChainInput, maxDepth = 2): ChainLink[] {
	// 편성으로 이미 충족된 참조는 사슬로 얻을 것이 없다
	const alreadySatisfied = new Set<string>();
	for (const v of input.verdicts) {
		for (const r of v.reasons) {
			if (r.verdict === 'satisfied') alreadySatisfied.add(`${r.refKind}|${r.refId}`);
		}
	}

	const visited = new Set(input.heldGiftIds);
	const links = new Map<string, ChainLink>();
	let frontier = [...input.heldGiftIds];

	for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
		const next: string[] = [];
		for (const from of frontier) {
			const inflicts = inflictedBy(from, input);
			if (inflicts.size === 0) continue;

			for (const [giftId, refs] of input.giftRefs) {
				if (visited.has(giftId)) continue;
				const hits = refs.filter(
					(r) => inflicts.has(`${r.refKind}|${r.refId}`)
						&& !alreadySatisfied.has(`${r.refKind}|${r.refId}`),
				);
				if (hits.length === 0) continue;

				// **중복 합산 금지.** 같은 기프트를 여러 경로로 만나도 한 번만 센다.
				// 처음 닿은 깊이를 유지하고 경로만 덧붙인다
				const link = links.get(giftId);
				const via = hits.map((h) => ({ fromGiftId: from, refKind: h.refKind, refId: h.refId }));
				if (link === undefined) {
					links.set(giftId, { giftId, depth, via });
					next.push(giftId);
				} else {
					link.via.push(...via);
				}
			}
		}
		for (const id of next) visited.add(id);
		frontier = next;
	}

	return [...links.values()].sort((a, b) => a.depth - b.depth || a.giftId.localeCompare(b.giftId));
}
