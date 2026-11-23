import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	BURST,
	GLOBAL_LIMIT,
	KEY_LIMIT,
	MAX_KEYS,
	bucketCount,
	clientKey,
	createLimiter,
	resetBuckets,
	retryAfterSeconds,
	takeToken,
} from './rate-limit';

beforeEach(() => resetBuckets());

test('순간 20 회 뒤 21 번째는 거절, 1 분 뒤 회복', () => {
	const t0 = 0;
	for (let i = 0; i < 20; i++) assert.ok(takeToken('a', t0));
	assert.equal(takeToken('a', t0), false);
	assert.ok(takeToken('a', t0 + 60_000));
});

test('분당 60 회로 채워진다 — 1 초에 토큰 하나', () => {
	for (let i = 0; i < BURST; i++) takeToken('a', 0);
	assert.equal(takeToken('a', 999), false);
	assert.ok(takeToken('a', 1_000));
	assert.equal(takeToken('a', 1_000), false);
});

test('키끼리 섞이지 않는다', () => {
	for (let i = 0; i < BURST; i++) takeToken('a', 0);
	assert.equal(takeToken('a', 0), false);
	assert.ok(takeToken('b', 0));
});

test('retryAfterSeconds — 소진 뒤 다음 토큰까지 남은 초(올림), 여유가 있으면 0', () => {
	assert.equal(retryAfterSeconds('a', 0), 0);
	for (let i = 0; i < BURST; i++) takeToken('a', 0);
	assert.equal(retryAfterSeconds('a', 0), 1);
	assert.equal(retryAfterSeconds('a', 400), 1);
	assert.equal(retryAfterSeconds('a', 1_000), 0);
});

test('전역 상한 — 키를 바꿔도 순간 200 회를 넘지 못하고, 막힌 요청은 키 버킷을 만들지 않는다', () => {
	for (let i = 0; i < GLOBAL_LIMIT.burst; i++) assert.ok(takeToken(`k${i}`, 0));
	assert.equal(takeToken('fresh', 0), false);
	assert.equal(bucketCount(), GLOBAL_LIMIT.burst);
	assert.equal(retryAfterSeconds('fresh', 0), 1);
	// 분당 600 → 100ms 에 하나
	assert.equal(takeToken('fresh', 99), false);
	assert.ok(takeToken('fresh', 100));
	assert.equal(takeToken('fresh2', 100), false);
});

test('전역 상한 — 키당 거절은 전역 토큰을 쓰지 않는다', () => {
	const l = createLimiter({ key: KEY_LIMIT, global: { burst: 25, perMinute: 60 }, maxKeys: 100 });
	for (let i = 0; i < 20; i++) assert.ok(l.take('a', 0));
	for (let i = 0; i < 50; i++) assert.equal(l.take('a', 0), false);
	for (let i = 0; i < 5; i++) assert.ok(l.take('b', 0));
	assert.equal(l.take('c', 0), false);
});

test('서로 다른 키가 몰려도 버킷 수는 상한을 넘지 않는다', () => {
	const l = createLimiter({ key: KEY_LIMIT, global: null, maxKeys: 100 });
	for (let i = 0; i < 1_000; i++) l.take(`k${i}`, i);
	assert.ok(l.size() <= 100);
});

test('축출 — 가득 찬 버킷이 오래된 부분 버킷보다 먼저 나간다', () => {
	const l = createLimiter({ key: KEY_LIMIT, global: null, maxKeys: 2 });
	for (let i = 0; i < 15; i++) l.take('partial', 0); // 5 남음, 가득 차려면 15 초
	l.take('full', 1_000); // 19 남음, 2_000 에 다시 가득
	l.take('new', 3_000); // 상한 초과
	assert.equal(l.size(), 2);
	assert.equal(l.peek('full', 3_000), undefined);
	assert.ok(Math.abs(l.peek('partial', 3_000)! - 8) < 1e-9);
});

test('축출 — 비어 있는 버킷은 남은 토큰이 있는 버킷보다 늦게 나간다', () => {
	const l = createLimiter({ key: KEY_LIMIT, global: null, maxKeys: 2 });
	for (let i = 0; i < 20; i++) l.take('empty', 0);
	l.take('q', 10);
	l.take('n', 20);
	assert.notEqual(l.peek('empty', 20), undefined);
	assert.equal(l.peek('q', 20), undefined);
});

test('축출 — 비어 있는 버킷뿐이면 그때는 가장 오래된 것이 나간다(상한 우선)', () => {
	const l = createLimiter({ key: KEY_LIMIT, global: null, maxKeys: 1 });
	for (let i = 0; i < 20; i++) l.take('empty', 0);
	l.take('n', 10);
	assert.equal(l.size(), 1);
	assert.equal(l.peek('empty', 10), undefined);
});

test('1 만 키 순환으로 몰아쳐도 소진된 피해자 버킷은 충전 시각 전에 리셋되지 않는다', () => {
	const l = createLimiter({ key: KEY_LIMIT, global: null, maxKeys: MAX_KEYS });
	for (let i = 0; i < BURST; i++) assert.ok(l.take('victim', 0));
	assert.equal(l.take('victim', 0), false);
	// 두 바퀴 — 2 만 번, 모두 충전 시각(1_000ms) 전
	for (let round = 0; round < 2; round++) {
		for (let i = 0; i < MAX_KEYS; i++) l.take(`a${round}-${i}`, 1 + (round * MAX_KEYS + i) * 0.04);
	}
	assert.ok(l.size() <= MAX_KEYS);
	assert.notEqual(l.peek('victim', 900), undefined);
	assert.equal(l.take('victim', 900), false);
	assert.ok(l.take('victim', 1_000));
});

test('clientKey — MCP_TRUST_PROXY 가 아니면 모두 direct', () => {
	assert.equal(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4' }), false), 'direct');
	assert.equal(clientKey(new Headers(), false), 'direct');
});

test('clientKey — 믿으면 첫 값 trim · 소문자, 비거나 선두 콤마면 unknown', () => {
	assert.equal(clientKey(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8' }), true), 'ip:1.2.3.4');
	assert.equal(clientKey(new Headers({ 'x-forwarded-for': '2001:DB8::1' }), true), 'ip:2001:db8::1');
	assert.equal(clientKey(new Headers({ 'x-forwarded-for': ', 1.2.3.4' }), true), 'unknown');
	assert.equal(clientKey(new Headers({ 'x-forwarded-for': '   ' }), true), 'unknown');
	assert.equal(clientKey(new Headers(), true), 'unknown');
});
