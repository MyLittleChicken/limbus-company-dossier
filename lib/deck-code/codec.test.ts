import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBits, writeBlock, TOTAL_BITS } from './layout';
import { decodeDeckCode, encodeDeckCode, deckFromCode, deckToCode, unverifiedIndexes } from './codec';
import { emptyDeck } from '@/lib/storage/schema';

function sampleBits(): string {
	let bits = emptyBits();
	bits = writeBlock(bits, 1, { identityIndex: 1, order: 1, egoIndex: { ZAYIN: 1 } });
	bits = writeBlock(bits, 5, { identityIndex: 8, order: 2, egoIndex: { TETH: 3 } });
	return bits;
}

test('인코드한 것을 디코드하면 같은 비트', async () => {
	const bits = sampleBits();
	const code = await encodeDeckCode(bits);
	assert.equal(code.ok, true);
	if (!code.ok) return;
	const back = await decodeDeckCode(code.value);
	assert.equal(back.ok, true);
	if (back.ok) assert.equal(back.value, bits);
});

test('디코드 결과는 560비트', async () => {
	const code = await encodeDeckCode(sampleBits());
	assert.equal(code.ok, true);
	if (!code.ok) return;
	const back = await decodeDeckCode(code.value);
	if (back.ok) assert.equal(back.value.length, TOTAL_BITS);
});

test('덱 왕복이 일치한다', async () => {
	const d = emptyDeck('원본', 'id-1');
	d.slots[0]!.identityId = 10101;
	d.slots[0]!.egos.ZAYIN = 20101;
	d.slots[4]!.identityId = 10508;
	d.slots[4]!.egos.TETH = 20503;
	d.deployed = [1, 5];

	const code = await deckToCode(d);
	assert.equal(code.ok, true);
	if (!code.ok) return;

	const back = await deckFromCode(code.value, '복원');
	assert.equal(back.ok, true);
	if (!back.ok) return;
	assert.equal(back.value.slots[0]?.identityId, 10101);
	assert.equal(back.value.slots[0]?.egos.ZAYIN, 20101);
	assert.equal(back.value.slots[4]?.identityId, 10508);
	assert.equal(back.value.slots[4]?.egos.TETH, 20503);
	assert.deepEqual(back.value.deployed, [1, 5]);
});

test('빈 칸은 null 로 돌아온다', async () => {
	const d = emptyDeck('빈 덱', 'id-2');
	const code = await deckToCode(d);
	if (!code.ok) return assert.fail(code.reason);
	const back = await deckFromCode(code.value, 'x');
	if (!back.ok) return assert.fail(back.reason);
	assert.equal(back.value.slots.every((s) => s.identityId === null), true);
	assert.deepEqual(back.value.deployed, []);
});

test('16번째 인격도 왕복한다', async () => {
	const d = emptyDeck('16번', 'id-3');
	d.slots[11]!.identityId = 11216;
	const code = await deckToCode(d);
	if (!code.ok) return assert.fail(code.reason);
	const back = await deckFromCode(code.value, 'x');
	if (!back.ok) return assert.fail(back.reason);
	assert.equal(back.value.slots[11]?.identityId, 11216);
});

test('16 이상 인격을 미검증으로 보고한다', () => {
	const d = emptyDeck('16번', 'id-4');
	d.slots[11]!.identityId = 11216;
	d.slots[0]!.identityId = 10101;
	assert.deepEqual(unverifiedIndexes(d), [11216]);
});

test('쓰레기 코드를 실패로 알린다', async () => {
	assert.equal((await decodeDeckCode('!!!not base64!!!')).ok, false);
	assert.equal((await decodeDeckCode('aGVsbG8=')).ok, false); // base64 는 되지만 gzip 이 아니다
});
