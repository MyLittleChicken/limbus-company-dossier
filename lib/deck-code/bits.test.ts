import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesToBits, bitsToBytes, readField, writeField } from './bits';

test('바이트를 8비트씩 편다', () => {
	assert.equal(bytesToBits(new Uint8Array([0b10000001, 0])), '1000000100000000');
});

test('비트를 바이트로 되돌린다', () => {
	assert.deepEqual([...bitsToBytes('1000000100000000')], [129, 0]);
});

test('왕복이 일치한다', () => {
	const src = new Uint8Array([0, 1, 127, 128, 255, 42]);
	assert.deepEqual([...bitsToBytes(bytesToBits(src))], [...src]);
});

test('1-기준 포함 구간을 읽는다', () => {
	//        위치 1234
	const bits = '0101';
	assert.equal(readField(bits, 1, 4), 0b0101);
	assert.equal(readField(bits, 2, 2), 1);
	assert.equal(readField(bits, 3, 4), 0b01);
});

test('구간에 값을 쓴다', () => {
	assert.equal(writeField('0000', 3, 4, 0b11), '0011');
	assert.equal(writeField('1111', 1, 2, 0), '0011');
});

test('쓰고 읽으면 같은 값', () => {
	const bits = writeField('0'.repeat(46), 2, 8, 16);
	assert.equal(readField(bits, 2, 8), 16);
});

test('구간을 넘는 값은 거부한다', () => {
	assert.throws(() => writeField('0000', 1, 2, 4));
});
