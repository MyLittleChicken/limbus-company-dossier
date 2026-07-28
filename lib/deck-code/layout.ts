import { readField, writeField } from './bits';
import { EGO_RANKS, type EgoRank } from '@/lib/storage/schema';

/**
 * 덱 코드의 560비트 배치.
 *
 * 560 = 46 × 12 + 8. 수감자마다 46비트이고 끝의 8비트는 더미다.
 *
 * **가이드는 인격을 4비트(5–8)로 적었지만 그것으로는 모자란다.** 우리 스냅샷에서
 * 그레고르·로쟈·이상·파우스트·히스클리프가 인격 16종이라 15를 넘는다. 가이드도 그 경우
 * 앞의 빈 비트로 넘어갈 것이라고 추정만 해뒀다.
 *
 * 그래서 앞의 빈 자리를 포함한 **넓은 필드**로 읽고 쓴다. 값 1–15 는 좁게 볼 때와 결과가
 * 같으므로 기존 코드를 해석하는 데 문제가 없고, 16 이상도 담긴다. 폭의 합이 정확히 46이
 * 되는 것이 이 배치의 근거다(테스트가 그 항등식을 잡는다).
 *
 * **쓰기가 인게임에서 동작하는지는 확인하지 못했다**(07-recommendation-system 7.3).
 * 실물 덱 코드가 확보되면 검증한다.
 */
export const BLOCK_BITS = 46;
export const TOTAL_BITS = 560;

/** 1-기준 포함 구간. 비트 1은 미사용이다. */
export const FIELD = {
	identity: [2, 8],
	order: [9, 12],
	ZAYIN: [13, 19],
	TETH: [20, 26],
	HE: [27, 33],
	WAW: [34, 40],
	ALEPH: [41, 46],
} as const satisfies Record<string, readonly [number, number]>;

export interface Block {
	identityIndex: number;
	/** 편성 순서. 0 이면 미편성 */
	order: number;
	egoIndex: Partial<Record<EgoRank, number>>;
}

export const emptyBits = (): string => '0'.repeat(TOTAL_BITS);

const base = (sinnerId: number): number => (sinnerId - 1) * BLOCK_BITS;

/** id 는 `1|수감자(2)|순번(2)` 이다. 전수 검증으로 위반 0을 확인했다(07 7.2). */
export const sinnerOf = (id: number): number => Math.floor(id / 100) % 100;
export const indexOf = (id: number): number => id % 100;
export const identityId = (sinner: number, index: number): number => 10000 + sinner * 100 + index;
export const egoId = (sinner: number, index: number): number => 20000 + sinner * 100 + index;

export function readBlock(bits: string, sinnerId: number): Block {
	const b = base(sinnerId);
	const at = ([s, e]: readonly [number, number]) => readField(bits, b + s, b + e);
	const egoIndex: Partial<Record<EgoRank, number>> = {};
	for (const rank of EGO_RANKS) egoIndex[rank] = at(FIELD[rank]);
	return { identityIndex: at(FIELD.identity), order: at(FIELD.order), egoIndex };
}

export function writeBlock(bits: string, sinnerId: number, block: Block): string {
	const b = base(sinnerId);
	let out = bits;
	const put = ([s, e]: readonly [number, number], v: number) => {
		out = writeField(out, b + s, b + e, v);
	};
	put(FIELD.identity, block.identityIndex);
	put(FIELD.order, block.order);
	for (const rank of EGO_RANKS) put(FIELD[rank], block.egoIndex[rank] ?? 0);
	return out;
}
