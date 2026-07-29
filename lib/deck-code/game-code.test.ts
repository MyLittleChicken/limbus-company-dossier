import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDeckCode, deckFromCode, deckToCode } from './codec';
import { readBlock } from './layout';
import { parseDeck } from '@/lib/storage/schema';

/**
 * 실물 인게임 덱 코드로 대조한다.
 *
 * 이 파일이 있기 전까지 덱 코드 테스트는 **우리 인코더와 우리 디코더를 맞춰 보는 것뿐**이었다
 * (`docs/07-recommendation-system.md` 7.4). 통과하는 테스트만 쓸 수 있었고, 실제로 `FIELD.order`
 * 를 출전으로 잘못 읽는 것을 잡지 못했다.
 *
 * 아래 코드는 게임에서 복사한 검계·거미집 편성이며, 12칸이 무엇인지 사람이 확인했다.
 * **지어낸 값이 아니라 외부 오라클이다** — 우리 구현이 바뀌어도 이 기대값은 바뀌지 않는다.
 */
const GAME_CODE =
	'H4sIAAAAAAAAEyWKQQqAIBBF71QRbVx8R8URIkU6gYsxOoAeP6W/eo/3zQJpm4Bv8rYK9sYYMx3S8YKZnH2Ao3HJDBsgM8eUvdNJE/73jtpZEAtNxQo+rzBAqQ/4IwPlYAAAAA==';

/** 수감자 1..12 순. 사람이 게임 화면과 대조했다. */
const EXPECTED_IDENTITIES = [
	10115, // 이상 · 거미집 검지 아비
	10208, // 파우스트 · 검계 살수
	10314, // 돈키호테 · 검지 대행자
	10415, // 료슈 · 거미집의 검
	10508, // 뫼르소 · 검계 우두머리
	10615, // 홍루 · S사 추노꾼
	10716, // 히스클리프 · 거미집 엄지 제자 — 순번 16
	10815, // 이스마엘 · LCD 현장추리팀
	10916, // 로쟈 · 거미집 엄지 아비 — 순번 16
	11015, // 싱클레어 · 거미집 소지 제자
	11115, // 오티스 · 거미집 중지 아비
	11213, // 그레고르 · 밤의 송곳 카피타노
];

test('실물 코드의 인격 12칸을 그대로 읽는다', async () => {
	const d = await deckFromCode(GAME_CODE, '실물');
	if (!d.ok) return assert.fail(d.reason);
	assert.deepEqual(d.value.slots.map((s) => s.identityId), EXPECTED_IDENTITIES);
});

test('순번 16 인격은 넓은 필드로만 읽힌다', async () => {
	// 가이드가 적은 4비트(비트 5-8)로 읽으면 히스클리프 칸이 0000 = "인격 없음" 이 된다.
	// 넓힌 7비트(비트 2-8)라야 0010000 = 16 이 나온다. 실물 코드가 그것을 증명한다.
	const bits = await decodeDeckCode(GAME_CODE);
	if (!bits.ok) return assert.fail(bits.reason);
	const block = bits.value.slice(6 * 46, 7 * 46);
	assert.equal(block.slice(1, 8), '0010000', '넓은 필드');
	assert.equal(block.slice(4, 8), '0000', '좁은 필드로는 0이다');
	assert.equal(readBlock(bits.value, 7).identityIndex, 16);
});

test('order 는 출전이 아니라 편성 순서다 — 1..12 의 순열', async () => {
	// 출전이라면 최대 7이어야 하는데 12칸 전부 값을 갖고 겹치지 않는다.
	// 덱 코드는 온필드 인원을 담지 않는다(docs/07 7.1).
	const bits = await decodeDeckCode(GAME_CODE);
	if (!bits.ok) return assert.fail(bits.reason);
	const orders = Array.from({ length: 12 }, (_, i) => readBlock(bits.value, i + 1).order);
	assert.deepEqual([...orders].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('가져온 덱은 출전을 비운다', async () => {
	// 코드에 없는 정보를 지어내지 않는다. 출전은 사용자가 화면에서 고른다.
	const d = await deckFromCode(GAME_CODE, '실물');
	if (!d.ok) return assert.fail(d.reason);
	assert.deepEqual(d.value.deployed, []);
});

test('가져온 덱은 편성 순서를 담는다', async () => {
	const d = await deckFromCode(GAME_CODE, '실물');
	if (!d.ok) return assert.fail(d.reason);
	// order 1번이 료슈(수감자 4), 2번이 뫼르소(5) … 실측한 순서 그대로다.
	assert.deepEqual(d.value.order, [4, 5, 6, 8, 2, 1, 11, 9, 7, 10, 3, 12]);
});

test('가져온 덱을 우리 스키마가 받아들인다', async () => {
	// 이것이 실패하면 화면이 저장한 뒤 다시 읽지 못해 편집이 잠긴다(docs/07 4.2).
	const d = await deckFromCode(GAME_CODE, '실물');
	if (!d.ok) return assert.fail(d.reason);
	const r = parseDeck(JSON.parse(JSON.stringify(d.value)));
	assert.equal(r.ok, true, r.ok ? '' : r.reason);
});

test('실물 코드를 다시 인코드하면 비트가 같다', async () => {
	// 컨테이너(gzip 산출물)는 다를 수 있어도 560비트는 같아야 한다.
	// 순번 16 인격 둘을 포함해 쓰기 경로가 게임과 맞는지 보는 유일한 자리다.
	const d = await deckFromCode(GAME_CODE, '실물');
	if (!d.ok) return assert.fail(d.reason);
	const out = await deckToCode(d.value);
	if (!out.ok) return assert.fail(out.reason);

	const origin = await decodeDeckCode(GAME_CODE);
	const ours = await decodeDeckCode(out.value);
	if (!origin.ok || !ours.ok) return assert.fail('디코드 실패');
	assert.equal(ours.value, origin.value);
});
