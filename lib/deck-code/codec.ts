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
	// `FIELD.order` 는 **편성 순서**다. 실물 코드에서 1..12 의 순열로 나온다 — 12칸 전부
	// 값을 갖고 겹치지 않으므로 출전(최대 7)일 수 없다. 덱 코드는 온필드 인원을 담지
	// 않는다(docs/07 7.1). `deployed` 는 비운 채로 두고 사용자가 화면에서 고른다 —
	// 없는 근거로 출전을 지어내면 상한 7을 넘겨 저장분을 못 읽게 만든다.
	deck.order = ordered.map((o) => o.sinnerId);
	return ok(deck);
}

export function deckToCode(deck: StoredDeck): Promise<Result<string>> {
	let bits = emptyBits();
	// 편성 순서를 사용자가 정하는 화면이 아직 없다. 손으로 만든 덱은 `order` 가 비어 있으므로
	// **인격이 든 칸을 수감자 번호 순으로 매긴다** — 지어내는 것이지만 0(미편성)으로 두면
	// 게임이 빈 편성으로 읽는다. 가져온 덱은 코드가 준 순서를 그대로 쓴다(docs/07 7.1).
	const order = deck.order.length > 0
		? deck.order
		: deck.slots.filter((s) => s.identityId !== null).map((s) => s.sinnerId);

	for (const slot of deck.slots) {
		const at = order.indexOf(slot.sinnerId);
		const egoIndex: Partial<Record<(typeof EGO_RANKS)[number], number>> = {};
		for (const rank of EGO_RANKS) {
			const id = slot.egos[rank];
			if (id !== undefined) egoIndex[rank] = indexOf(id);
		}
		bits = writeBlock(bits, slot.sinnerId, {
			identityIndex: slot.identityId === null ? 0 : indexOf(slot.identityId),
			order: at === -1 ? 0 : at + 1,
			egoIndex,
		});
	}
	return encodeDeckCode(bits);
}

/**
 * 순번 16 이상 인격의 경고는 **없앴다.**
 *
 * 가이드가 4비트로 적은 인격 필드를 우리가 넓게 읽는 것이 추정이었고, 그래서 순번 16 이상이
 * 든 덱의 내보내기에 미검증 표기를 붙였다(`docs/07` 7.3). **실물 인게임 코드로 확인했다** —
 * `lib/deck-code/game-code.test.ts` 의 검계·거미집 편성이 순번 16 인격 둘(10716 · 10916)을
 * 담고 있고, 좁은 4비트로 읽으면 그 칸이 0("인격 없음")이 되는 반면 넓은 필드로 읽으면
 * 실제 편성과 맞는다. 다시 인코드한 560비트도 원본과 완전히 같다.
 *
 * 읽기와 쓰기 모두 비트 수준에서 대조됐으므로 순번 16 에만 붙일 근거가 사라졌다. 남은
 * 미검증은 **우리가 만든 컨테이너(gzip 산출물)를 게임이 받아들이는가**이고, 그것은 순번과
 * 무관하게 모든 코드에 걸리므로 화면이 내보내기 전체에 한 번 적는다.
 */
