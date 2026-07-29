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

// through() 회귀 테스트 — DecompressionStream 이 에러 상태가 되면 writer.write()/close()
// 프로미스도 함께 reject 하는데, 지켜보지 않으면 Node 가 unhandledRejection 으로 프로세스를
// 죽인다(브라우저는 콘솔 경고로 끝나 안 드러남). 이 두 테스트가 통과하고도 프로세스 exit
// code 가 0 이어야 회귀가 없다는 뜻이다 — 테스트 실행기가 exit code 로 그 사실을 알려준다.
test('gzip 이 아닌 바이트를 풀면 reject 한다', async () => {
	await assert.rejects(gunzip(new Uint8Array([1, 2, 3, 4, 5])));
});

test('매직은 맞지만 손상된 gzip 페이로드를 풀면 reject 한다', async () => {
	const corrupt = new Uint8Array([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 0, 0xff, 0xde, 0xad, 0xbe, 0xef]);
	await assert.rejects(gunzip(corrupt));
});
