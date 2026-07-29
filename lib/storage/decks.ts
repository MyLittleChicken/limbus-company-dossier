import { ok, err, type Kv, type Result } from './kv';
import { DECK_MAX, SCHEMA_VERSION, parseDeck, type StoredDeck } from './schema';

export const KEY_SCHEMA = 'limbus:schema';
export const KEY_DECKS = 'limbus:decks';

/**
 * 덱 목록 영속화.
 *
 * 읽기가 실패해도 **저장분을 지우지 않는다.** 버전이 다르거나 JSON 이 깨진 경우
 * 호출부가 사용자에게 알리고 판단을 넘긴다.
 */
export function readDecks(kv: Kv): Result<StoredDeck[]> {
	let rawSchema: string | null;
	let rawDecks: string | null;
	try {
		rawSchema = kv.getItem(KEY_SCHEMA);
		rawDecks = kv.getItem(KEY_DECKS);
	} catch (cause) {
		return err(`저장소를 읽지 못했다: ${(cause as Error).message}`);
	}

	if (rawDecks === null) return ok([]);
	if (rawSchema !== String(SCHEMA_VERSION)) {
		return err(`저장분의 스키마 버전(${rawSchema ?? '없음'})이 현재(${SCHEMA_VERSION})와 다르다`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawDecks);
	} catch {
		return err('저장분이 올바른 JSON 이 아니다');
	}
	if (!Array.isArray(parsed)) return err('저장분이 배열이 아니다');

	const out: StoredDeck[] = [];
	for (const item of parsed) {
		const d = parseDeck(item);
		if (!d.ok) return err(`덱을 읽지 못했다: ${d.reason}`);
		out.push(d.value);
	}
	return ok(out);
}

/**
 * 덱 목록 쓰기.
 *
 * **읽기와 같은 계약을 건다.** 예전에는 `readDecks` 만 `parseDeck` 을 돌리고 쓰기는 그냥
 * 넣었다. 그 비대칭 때문에 상한을 넘는 덱이 저장소에 들어갔고, 다음 방문에서 `readDecks`
 * 가 실패해 **그 저장소의 다른 멀쩡한 덱까지 통째로 못 읽게** 됐다(실물 덱 코드 가져오기로
 * 재현). 못 읽을 것은 애초에 쓰지 않는다.
 */
export function writeDecks(kv: Kv, decks: readonly StoredDeck[]): Result<void> {
	if (decks.length > DECK_MAX) return err(`덱은 ${DECK_MAX}개까지다`);
	for (const d of decks) {
		const checked = parseDeck(JSON.parse(JSON.stringify(d)));
		if (!checked.ok) return err(`쓸 수 없는 덱이다: ${checked.reason}`);
	}
	try {
		kv.setItem(KEY_SCHEMA, String(SCHEMA_VERSION));
		kv.setItem(KEY_DECKS, JSON.stringify(decks));
	} catch (cause) {
		return err(`저장하지 못했다: ${(cause as Error).message}`);
	}
	return ok(undefined);
}
