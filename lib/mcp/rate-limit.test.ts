import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	BURST,
	GLOBAL_LIMIT,
	KEY_LIMIT,
	MAX_KEYS,
	bucketCount,
	clientIpConfig,
	clientKey,
	createSemaphore,
	normalizeIp,
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

const OFF = clientIpConfig({});
const ON = clientIpConfig({ MCP_TRUST_PROXY: '1' });
const xff = (v: string) => new Headers({ 'x-forwarded-for': v });

test('clientIpConfig — 기본값과 잘못된 값', () => {
	assert.deepEqual(OFF, { trustProxy: false, trustedHops: 1, ipHeader: null });
	assert.equal(clientIpConfig({ MCP_TRUSTED_HOPS: '2' }).trustedHops, 2);
	assert.equal(clientIpConfig({ MCP_TRUSTED_HOPS: '0' }).trustedHops, 1);
	assert.equal(clientIpConfig({ MCP_TRUSTED_HOPS: 'x' }).trustedHops, 1);
	assert.equal(clientIpConfig({ MCP_CLIENT_IP_HEADER: ' CF-Connecting-IP ' }).ipHeader, 'cf-connecting-ip');
	assert.equal(clientIpConfig({ MCP_CLIENT_IP_HEADER: 'bad header' }).ipHeader, null);
});

test('clientKey — MCP_TRUST_PROXY 가 아니면 모두 direct', () => {
	assert.equal(clientKey(xff('1.2.3.4'), OFF), 'direct');
	assert.equal(clientKey(new Headers(), OFF), 'direct');
});

test('clientKey — 믿으면 x-forwarded-for 오른쪽에서 N 번째(왼쪽은 위조 가능)', () => {
	assert.equal(clientKey(xff('6.6.6.6, 1.2.3.4'), ON), 'ip:1.2.3.4');
	assert.equal(clientKey(xff('6.6.6.6, 1.2.3.4, 10.0.0.1'), { ...ON, trustedHops: 2 }), 'ip:1.2.3.4');
	assert.equal(clientKey(xff('1.2.3.4'), { ...ON, trustedHops: 2 }), 'unknown');
	assert.equal(clientKey(xff('1.2.3.4,'), ON), 'unknown');
	assert.equal(clientKey(xff('not-an-ip'), ON), 'unknown');
	assert.equal(clientKey(new Headers(), ON), 'unknown');
	assert.equal(clientKey(xff('1.2.3.4,' + 'a'.repeat(5_000)), ON), 'unknown');
});

test('clientKey — MCP_CLIENT_IP_HEADER 를 주면 그 머리가 우선', () => {
	const cfg = { ...ON, ipHeader: 'cf-connecting-ip' };
	const h = new Headers({ 'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '1.2.3.4' });
	assert.equal(clientKey(h, cfg), 'ip:1.2.3.4');
	assert.equal(clientKey(xff('6.6.6.6'), cfg), 'unknown');
});

test('normalizeIp — 검증 · 포트 떼기 · IPv6 한 표기 · IPv4-mapped', () => {
	assert.equal(normalizeIp(' 1.2.3.4 '), '1.2.3.4');
	assert.equal(normalizeIp('1.2.3.4:5678'), '1.2.3.4');
	assert.equal(normalizeIp('2001:DB8:0:0::1'), '2001:db8::1');
	assert.equal(normalizeIp('0:0:0:0:0:0:0:1'), '::1');
	assert.equal(normalizeIp('[2001:db8::1]:443'), '2001:db8::1');
	assert.equal(normalizeIp('::ffff:1.2.3.4'), '1.2.3.4');
	assert.equal(normalizeIp('::FFFF:7f00:1'), '127.0.0.1');
	assert.equal(normalizeIp('999.1.1.1'), null);
	assert.equal(normalizeIp('fe80::1%eth0'), null);
	assert.equal(normalizeIp(''), null);
	assert.equal(normalizeIp('1'.repeat(100)), null);
});

test('createSemaphore — 상한만큼 동시에, 넘치면 대기열, 대기열도 차면 null', async () => {
	const sem = createSemaphore(2, 1);
	const r1 = await sem.acquire()!;
	const r2 = await sem.acquire()!;
	const waiting = sem.acquire();
	assert.ok(waiting);
	assert.equal(sem.acquire(), null);
	assert.deepEqual(sem.stats(), { active: 2, queued: 1 });
	let got = false;
	void waiting!.then(() => (got = true));
	r1();
	r1(); // 두 번 불러도 한 번만 푼다
	await new Promise(r => setImmediate(r));
	assert.ok(got);
	assert.deepEqual(sem.stats(), { active: 2, queued: 0 });
	r2();
	(await waiting!)();
	assert.deepEqual(sem.stats(), { active: 0, queued: 0 });
});
