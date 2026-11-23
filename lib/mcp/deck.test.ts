import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK_CODE_MAX, deckInputSchema, resolveDeck } from './deck';
import { deckFromCode, encodeDeckCode } from '@/lib/deck-code/codec';
import { emptyBits, writeBlock, identityId } from '@/lib/deck-code/layout';

// 사용자 실물 덱 코드(편성 #24). 2026-11-23 게임 편성창 캡처와 12칸을 대조했다(설계 §6.2).
const CODE_24 = 'H4sIAAAAAAAAE3P1dkyv8Ex3DAx09nDNLHdyLPd0BAJnL8d0EO2f7gyiHEsyAiPDPR2djR0zgxwjHT3LIcKFENWuwY4ZYENcg11dndKdnAI98/29gBK2tgAHpASdYAAAAA==';

test('편성 #24: 순서 1–7 이 출격, 8–12 가 대기 (게임 캡처와 일치)', async () => {
	const r = await resolveDeck({ deckCode: CODE_24 });
	assert.ok(r.ok);
	assert.deepEqual(r.value.field, [11116, 11017, 10316, 10216, 11216, 10611, 10711]);
	assert.deepEqual(r.value.waiting, [10514, 10408, 10116, 10910, 10808]);
	assert.deepEqual(r.value.squad.field, r.value.field.map(String));
	assert.equal(r.value.squad.roster.length, 12);
});

test('E.G.O 장착이 roster 에 실린다', async () => {
	const r = await resolveDeck({ deckCode: CODE_24 });
	const otis = r.ok && r.value.squad.roster.find((s) => s.identityId === '11116');
	assert.deepEqual(otis && [...otis.egoIds].sort(), ['21104', '21106', '21108', '21109']);
});

test('5인 인격 목록: 전원 출격, 대기 없음', async () => {
	const r = await resolveDeck({ identityIds: [10101, 10201, 10301, 10401, 10501] });
	assert.ok(r.ok); assert.equal(r.value.field.length, 5); assert.deepEqual(r.value.waiting, []);
});

test('deployedIds 가 순서 규칙보다 우선한다', async () => {
	const ids = [10101, 10201, 10301, 10401, 10501, 10601, 10701, 10801];
	const r = await resolveDeck({ identityIds: ids, deployedIds: [10801] });
	assert.ok(r.ok); assert.deepEqual(r.value.field, [10801]); assert.equal(r.value.waiting.length, 7);
});

test('deployedIds 가 편성 밖이면 실패', async () => {
	const r = await resolveDeck({ identityIds: [10101], deployedIds: [10201] });
	assert.equal(r.ok, false);
});

test('한 수감자에 인격 둘이면 실패 (편성은 수감자당 하나)', async () => {
	const r = await resolveDeck({ identityIds: [10101, 10102] });
	assert.equal(r.ok, false);
});

// ── 계획 밖 보강: 검증 규칙 경계 ──

test('deckCode 와 identityIds 를 함께 주거나 둘 다 빼면 실패', async () => {
	assert.equal((await resolveDeck({ deckCode: CODE_24, identityIds: [10101] } as never)).ok, false);
	assert.equal((await resolveDeck({} as never)).ok, false);
});

test('편성이 12 를 넘으면 실패', async () => {
	const ids = Array.from({ length: 13 }, (_, i) => 10101 + i * 100);
	assert.equal((await resolveDeck({ identityIds: ids })).ok, false);
});

test('deployedIds 가 7 을 넘으면 실패', async () => {
	const ids = Array.from({ length: 12 }, (_, i) => 10101 + i * 100);
	assert.equal((await resolveDeck({ identityIds: ids, deployedIds: ids.slice(0, 8) })).ok, false);
});

test('편성에 없는 수감자의 E.G.O 는 실패, 있는 수감자는 roster 에 붙는다', async () => {
	assert.equal((await resolveDeck({ identityIds: [10101], egoIds: [20201] })).ok, false);
	const r = await resolveDeck({ identityIds: [10101, 10201], egoIds: [20203, 20101] });
	assert.ok(r.ok);
	assert.deepEqual(r.value.squad.roster, [
		{ identityId: '10101', egoIds: ['20101'] },
		{ identityId: '10201', egoIds: ['20203'] },
	]);
	assert.deepEqual(r.value.egoIds, [20101, 20203]);
});

test('id 형식이 아니면 실패 (인격 1SSII · E.G.O 2SSII)', async () => {
	assert.equal((await resolveDeck({ identityIds: [20101] })).ok, false);
	assert.equal((await resolveDeck({ identityIds: [11301] })).ok, false);
	assert.equal((await resolveDeck({ identityIds: [10101], egoIds: [10101] })).ok, false);
});

test('덱 코드와 deployedIds 를 함께 주면 출격이 그것으로 바뀐다', async () => {
	const r = await resolveDeck({ deckCode: CODE_24, deployedIds: [10808, 11116] });
	assert.ok(r.ok);
	assert.deepEqual(r.value.field, [11116, 10808], '출격은 편성 순서대로');
	assert.equal(r.value.waiting.length, 10);
});

test('잘못된 덱 코드는 코덱 문구로 실패', async () => {
	const r = await resolveDeck({ deckCode: 'not-a-code' });
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /덱 코드를 풀지 못했다/);
});

test('수감자당 E.G.O 는 5개까지 (등급당 하나)', async () => {
	const five = [20101, 20102, 20103, 20104, 20105];
	assert.ok((await resolveDeck({ identityIds: [10101], egoIds: five })).ok);
	const r = await resolveDeck({ identityIds: [10101], egoIds: [...five, 20106] });
	assert.equal(r.ok, false);
});

test('순서 칸은 있는데 인격이 빈 덱: deckFromCode.deployed 와 resolveDeck.field 가 같다', async () => {
	// 수감자 1 은 순서 1 이지만 인격이 비었다. 2..9 는 순서 2..9 에 인격이 있다.
	let bits = emptyBits();
	bits = writeBlock(bits, 1, { identityIndex: 0, order: 1, egoIndex: {} });
	for (let s = 2; s <= 9; s++) bits = writeBlock(bits, s, { identityIndex: 1, order: s, egoIndex: {} });
	const code = await encodeDeckCode(bits);
	if (!code.ok) return assert.fail(code.reason);

	const deck = await deckFromCode(code.value, 'x');
	if (!deck.ok) return assert.fail(deck.reason);
	assert.deepEqual(deck.value.order, [1, 2, 3, 4, 5, 6, 7, 8, 9], '순서는 코드 그대로');
	assert.deepEqual(deck.value.deployed, [2, 3, 4, 5, 6, 7, 8], '빈 칸은 출격 7 을 차지하지 않는다');

	const r = await resolveDeck({ deckCode: code.value });
	if (!r.ok) return assert.fail(r.reason);
	assert.deepEqual(r.value.field, deck.value.deployed.map((s) => identityId(s, 1)));
	assert.deepEqual(r.value.waiting, [identityId(9, 1)]);
});

test('덱 코드 길이 상한: 스키마와 resolveDeck 둘 다 512자를 넘으면 막는다', async () => {
	assert.ok(CODE_24.length < DECK_CODE_MAX, '실물 코드는 상한 안');
	const long = 'H4sI' + 'A'.repeat(DECK_CODE_MAX);
	assert.equal(deckInputSchema.safeParse({ deckCode: long }).success, false);
	assert.equal(deckInputSchema.safeParse({ deckCode: CODE_24 }).success, true);
	const r = await resolveDeck({ deckCode: long });
	assert.equal(r.ok, false);
	assert.match(!r.ok ? r.reason : '', /너무 길다/);
});

test('숫자 문자열 id 도 받아 number 로 편다', async () => {
	const r = await resolveDeck({ identityIds: ['10101', 10201], egoIds: ['20101'], deployedIds: ['10201'] });
	assert.ok(r.ok);
	assert.deepEqual(r.value.order, [10101, 10201]);
	assert.deepEqual(r.value.field, [10201]);
	assert.deepEqual(r.value.egoIds, [20101]);
	assert.equal(deckInputSchema.safeParse({ identityIds: ['10a01'] }).success, false);
});
