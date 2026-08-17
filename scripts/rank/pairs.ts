/**
 * 바구니를 순서 제약으로 편다.
 *
 * 4단 바구니는 완전 순서가 아니다 — 칸이 다를 때만 「가 나보다 위」가 생긴다.
 * 칸 안을 순서로 읽으면 사람이 안 매긴 순서를 골든으로 굳히게 된다.
 */
import type { RankRow } from './types.js';

export interface Pair {
	deck: string;
	/** 위여야 하는 기프트 */
	hi: string;
	/** 아래여야 하는 기프트 */
	lo: string;
}

/**
 * **덱 안에서만** 짝을 만든다. 덱이 다르면 적합도가 달라 견줄 수 없다.
 *
 * `fireable` 이 거짓인 기프트는 뺀다 — `scorePack` 이 후보에서 아예 빼므로
 * 모형이 값을 안 매긴다. 세면 「죽는 기프트를 0점으로 두면 정확도가 오른다」는
 * 가짜 이득이 생긴다.
 */
export function pairsOf(
	rows: RankRow[],
	fireable: (deck: string, giftId: string) => boolean,
): Pair[] {
	const live = rows.filter((r) => fireable(r.deck, r.giftId));
	const byDeck = new Map<string, RankRow[]>();
	for (const r of live) byDeck.set(r.deck, [...(byDeck.get(r.deck) ?? []), r]);

	const out: Pair[] = [];
	for (const [deck, rs] of [...byDeck].sort((a, b) => a[0].localeCompare(b[0]))) {
		const sorted = [...rs].sort((a, b) => a.giftId.localeCompare(b.giftId));
		for (const x of sorted) {
			for (const y of sorted) {
				if (x.bucket > y.bucket) out.push({ deck, hi: x.giftId, lo: y.giftId });
			}
		}
	}
	return out;
}
