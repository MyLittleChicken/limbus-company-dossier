import { ok, err, type Result } from '@/lib/storage/kv';
import { EGO_RANKS, emptyDeck, type StoredDeck } from '@/lib/storage/schema';
import { bitsToBytes, bytesToBits } from './bits';
import { toBase64, fromBase64, gzip, gunzip } from './bytes';
import {
	TOTAL_BITS, emptyBits, readBlock, writeBlock,
	identityId, egoId, indexOf,
} from './layout';

/**
 * 인게임 덱 코드 변환.
 *
 * 파이프라인은 가이드 그대로다.
 *   디코드  base64 → gzip 해제 → base64 → 비트
 *   인코드  비트 → 바이트 → base64 → gzip → base64
 *
 * base64 가 두 번 나오는 것이 이상해 보이지만 가이드가 그렇게 적었고, 왕복 테스트가
 * 그 순서를 고정한다. 순서를 바꾸면 왕복은 여전히 맞지만 인게임 코드를 못 읽는다.
 */

/** 가이드가 알려준 인게임 헤더. 내용물이 같으면 헤더가 달라도 동작한다고 한다. */
export const HEADER = 'H4sIAAAAAAAACh';

const utf8 = new TextEncoder();
const decodeUtf8 = new TextDecoder();

/**
 * 어느 단계에서 실패했는지 밝힌다(07-recommendation-system 8절).
 *
 * `atob` 이 던지는 `Invalid character` 를 그대로 실으면 사용자에게는 base64 얘기인지
 * 알 길이 없다 — 단계 이름을 우리가 붙인다.
 */
export async function decodeDeckCode(code: string): Promise<Result<string>> {
	let compressed: Uint8Array;
	try {
		compressed = fromBase64(code.trim());
	} catch {
		return err('덱 코드를 풀지 못했다: base64 가 아니다');
	}

	// gzip 매직(1f 8b)이 아니면 gunzip 을 아예 호출하지 않는다.
	// bytes.ts 의 through() 는 writer.write/close 를 await 하지 않고 흘려보내는데,
	// DecompressionStream 이 잘못된 입력에서 에러를 내면 그 미관측 프라미스가
	// 나중에 거부되며 처리되지 않은 거부(unhandledRejection)로 관측된다 — 여기서
	// 미리 걸러서 gunzip 내부의 그 경합을 아예 만들지 않는다.
	if (compressed.length < 2 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
		return err('덱 코드를 풀지 못했다: gzip 매직이 아니다');
	}

	let bits: string;
	try {
		const inflated = await gunzip(compressed);
		bits = bytesToBits(fromBase64(decodeUtf8.decode(inflated)));
	} catch (cause) {
		// gunzip 실패와 「푼 내용이 base64 가 아님」이 같은 문구를 쓴다. 후자는 유효한 gzip 안에
		// 비-base64 가 들어 있어야 도달하므로 실제 덱 코드로는 나오지 않는다 — 갈릴 일이 생기면
		// 그때 쪼갠다.
		return err(`덱 코드를 풀지 못했다: ${(cause as Error).message || 'gzip 으로 풀리지 않는다'}`);
	}
	if (bits.length !== TOTAL_BITS) {
		return err(`비트 길이가 ${TOTAL_BITS} 이 아니다: ${bits.length}`);
	}
	return ok(bits);
}

export async function encodeDeckCode(bits: string): Promise<Result<string>> {
	if (bits.length !== TOTAL_BITS) return err(`비트 길이가 ${TOTAL_BITS} 이 아니다: ${bits.length}`);
	try {
		const inner = toBase64(bitsToBytes(bits));
		return ok(toBase64(await gzip(utf8.encode(inner))));
	} catch (cause) {
		return err(`덱 코드를 만들지 못했다: ${(cause as Error).message}`);
	}
}

export async function deckFromCode(code: string, name: string): Promise<Result<StoredDeck>> {
	const decoded = await decodeDeckCode(code);
	if (!decoded.ok) return decoded;

	const deck = emptyDeck(name);
	const ordered: Array<{ order: number; sinnerId: number }> = [];

	for (const slot of deck.slots) {
		const block = readBlock(decoded.value, slot.sinnerId);
		if (block.identityIndex > 0) slot.identityId = identityId(slot.sinnerId, block.identityIndex);
		for (const rank of EGO_RANKS) {
			const idx = block.egoIndex[rank] ?? 0;
			if (idx > 0) slot.egos[rank] = egoId(slot.sinnerId, idx);
		}
		if (block.order > 0) ordered.push({ order: block.order, sinnerId: slot.sinnerId });
	}

	ordered.sort((a, b) => a.order - b.order);
	deck.deployed = ordered.map((o) => o.sinnerId);
	return ok(deck);
}

export function deckToCode(deck: StoredDeck): Promise<Result<string>> {
	let bits = emptyBits();
	for (const slot of deck.slots) {
		const order = deck.deployed.indexOf(slot.sinnerId);
		const egoIndex: Partial<Record<(typeof EGO_RANKS)[number], number>> = {};
		for (const rank of EGO_RANKS) {
			const id = slot.egos[rank];
			if (id !== undefined) egoIndex[rank] = indexOf(id);
		}
		bits = writeBlock(bits, slot.sinnerId, {
			identityIndex: slot.identityId === null ? 0 : indexOf(slot.identityId),
			order: order === -1 ? 0 : order + 1,
			egoIndex,
		});
	}
	return encodeDeckCode(bits);
}

/**
 * 인게임 검증이 안 된 인격들.
 *
 * 순번 16 이상은 가이드가 추정만 해둔 구간이라 내보낸 코드가 게임에서 동작하는지 모른다.
 * 화면이 이 목록으로 경고를 띄운다.
 */
export function unverifiedIndexes(deck: StoredDeck): number[] {
	return deck.slots
		.map((s) => s.identityId)
		.filter((id): id is number => id !== null && indexOf(id) > 15);
}
