import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase64, fromBase64, gzip, gunzip } from './bytes';

test('base64 바이너리 왕복', () => {
	const src = new Uint8Array([0, 1, 127, 128, 255, 0x1f, 0x8b]);
	assert.deepEqual([...fromBase64(toBase64(src))], [...src]);
});

test('base64 가 표준 결과와 같다', () => {
	const src = new Uint8Array([0x1f, 0x8b, 0x08, 0, 255, 42]);
	assert.equal(toBase64(src), Buffer.from(src).toString('base64'));
});

test('70바이트(560비트) 왕복', () => {
	const src = new Uint8Array(70).map((_, i) => (i * 37) % 256);
	assert.deepEqual([...fromBase64(toBase64(src))], [...src]);
});

test('gzip 왕복', async () => {
	const src = new TextEncoder().encode('hello deck code');
	assert.deepEqual([...(await gunzip(await gzip(src)))], [...src]);
});

test('gzip 매직 넘버를 갖는다', async () => {
	const out = await gzip(new TextEncoder().encode('x'));
	assert.deepEqual([...out.slice(0, 3)], [0x1f, 0x8b, 0x08]);
});

test('표준 gzip 산출물을 푼다', async () => {
	const { gzipSync } = await import('node:zlib');
	const z = new Uint8Array(gzipSync(Buffer.from('상호운용')));
	assert.equal(new TextDecoder().decode(await gunzip(z)), '상호운용');
});
