import { isIP } from 'node:net';

/**
 * `/mcp` 호출 제한 — 토큰 버킷 두 겹. 수치는 빌더 결정(설계 §5 · §9).
 *
 * - 키당: 순간 20 회, 분당 60 회로 채워진다(1 초에 하나).
 * - 전역: 키와 무관하게 순간 200 회, 분당 600 회. 먼저 본다 — 키를 꾸며 키당 제한을 비켜 가도
 *   프로세스 전체는 이 선을 못 넘는다. 전역에서 막힌 요청은 키 버킷을 만들지 않는다.
 * - 프로세스 메모리 안에만 있다. 인스턴스가 여럿이면 인스턴스마다 따로 센다 — 배포처가 정해지면 다시 본다.
 * - 키 버킷 수는 maxKeys 로 묶는다. 넘치면 버리는 차례(Map 삽입 순서 = 최근 사용 순):
 *   1. 가득 찬 버킷 — 없는 것과 같다(새로 만들어도 가득 찬 채로 시작한다).
 *   2. 토큰이 하나 이상 남은 버킷 중 가장 오래 안 쓴 것.
 *   3. 그래도 넘치면 가장 오래 안 쓴 것.
 *   비어 있는 버킷(소진된 키)은 1·2 에서 건드리지 않는다. 키를 바꿔 가며 몰아쳐도 소진된 키가 충전
 *   시각 전에 리셋되지 않는다 — 상한 전체가 비어 있는 버킷으로 찬 극단에서만 3 으로 밀린다.
 */

export type BucketSpec = { burst: number; perMinute: number };

export const KEY_LIMIT: BucketSpec = { burst: 20, perMinute: 60 };
export const GLOBAL_LIMIT: BucketSpec = { burst: 200, perMinute: 600 };
export const MAX_KEYS = 10_000;

/** 키당 순간 상한. */
export const BURST = KEY_LIMIT.burst;

type Bucket = { tokens: number; at: number };

function level(b: Bucket, spec: BucketSpec, now: number): number {
	return Math.min(spec.burst, b.tokens + Math.max(0, now - b.at) * (spec.perMinute / 60_000));
}

function settle(b: Bucket, spec: BucketSpec, now: number): void {
	b.tokens = level(b, spec, now);
	b.at = Math.max(b.at, now);
}

/** 토큰 하나가 생길 때까지 남은 초(올림). 지금 쓸 수 있으면 0. */
function waitSeconds(tokens: number, spec: BucketSpec): number {
	if (tokens >= 1) return 0;
	return Math.ceil((1 - tokens) / (spec.perMinute / 60_000) / 1000);
}

export type LimiterOptions = { key: BucketSpec; global: BucketSpec | null; maxKeys: number };

export function createLimiter({ key: keySpec, global: globalSpec, maxKeys }: LimiterOptions) {
	const buckets = new Map<string, Bucket>();
	// 전역 버킷은 첫 요청 시각에 가득 찬 채로 시작한다.
	let globalBucket: Bucket | null = null;

	function evict(keep: string, now: number): void {
		if (buckets.size <= maxKeys) return;
		// 1. 가득 찬 버킷을 모두 걷는다(한 번 훑을 때 여럿을 치워 되풀이를 줄인다).
		for (const [k, b] of buckets) {
			if (k !== keep && level(b, keySpec, now) >= keySpec.burst) buckets.delete(k);
		}
		// 2. 토큰이 남은 것 중 가장 오래된 것부터.
		for (const [k, b] of buckets) {
			if (buckets.size <= maxKeys) return;
			if (k !== keep && level(b, keySpec, now) >= 1) buckets.delete(k);
		}
		// 3. 그래도 넘치면 가장 오래된 것부터.
		for (const k of buckets.keys()) {
			if (buckets.size <= maxKeys) return;
			if (k !== keep) buckets.delete(k);
		}
	}

	function take(key: string, now: number): boolean {
		if (globalSpec) {
			globalBucket ??= { tokens: globalSpec.burst, at: now };
			settle(globalBucket, globalSpec, now);
			if (globalBucket.tokens < 1) return false;
		}
		let bucket = buckets.get(key);
		if (bucket) {
			buckets.delete(key);
			settle(bucket, keySpec, now);
		} else {
			bucket = { tokens: keySpec.burst, at: now };
		}
		buckets.set(key, bucket);
		evict(key, now);
		if (bucket.tokens < 1) return false;
		bucket.tokens -= 1;
		if (globalBucket) globalBucket.tokens -= 1;
		return true;
	}

	/** 키당 · 전역 중 더 긴 기다림. 버킷을 소비하지 않는다. */
	function retryAfter(key: string, now: number): number {
		const b = buckets.get(key);
		const own = b ? waitSeconds(level(b, keySpec, now), keySpec) : 0;
		const all = globalBucket && globalSpec ? waitSeconds(level(globalBucket, globalSpec, now), globalSpec) : 0;
		return Math.max(own, all);
	}

	return {
		take,
		retryAfter,
		/** 시험용 — 키 버킷의 지금 토큰 수. 버킷이 없으면 undefined. */
		peek(key: string, now: number): number | undefined {
			const b = buckets.get(key);
			return b ? level(b, keySpec, now) : undefined;
		},
		size: () => buckets.size,
		reset() {
			buckets.clear();
			globalBucket = null;
		},
	};
}

const limiter = createLimiter({ key: KEY_LIMIT, global: GLOBAL_LIMIT, maxKeys: MAX_KEYS });

/** 토큰 하나를 쓴다(전역 → 키 차례). 남은 것이 없으면 false — 호출하는 쪽이 429 로 답한다. */
export function takeToken(key: string, now = Date.now()): boolean {
	return limiter.take(key, now);
}

/** 다음 요청이 받아질 때까지 남은 초(올림). 지금 쓸 수 있으면 0. `Retry-After` 에 쓴다. */
export function retryAfterSeconds(key: string, now = Date.now()): number {
	return limiter.retryAfter(key, now);
}

/** 시험용. */
export function resetBuckets(): void {
	limiter.reset();
}

/** 시험용 — 지금 들고 있는 키 버킷 수. */
export function bucketCount(): number {
	return limiter.size();
}

/** 호출 제한 키를 정하는 설정. 환경변수에서 읽는다(`clientIpConfig`). */
export type ClientIpConfig = {
	/** `MCP_TRUST_PROXY=1` — 앞단 프록시가 클라이언트 IP 머리를 덮어쓴다고 믿는다. */
	trustProxy: boolean;
	/** `MCP_TRUSTED_HOPS`(기본 1) — `x-forwarded-for` 의 오른쪽에서 몇 번째 값을 쓸지. 믿는 프록시 수다. */
	trustedHops: number;
	/** `MCP_CLIENT_IP_HEADER` — 예: `cf-connecting-ip` · `x-real-ip`. 주면 `x-forwarded-for` 대신 이것을 쓴다. */
	ipHeader: string | null;
};

export function clientIpConfig(env: Record<string, string | undefined> = process.env): ClientIpConfig {
	const hops = Number(env.MCP_TRUSTED_HOPS);
	const header = env.MCP_CLIENT_IP_HEADER?.trim().toLowerCase();
	return {
		trustProxy: env.MCP_TRUST_PROXY === '1',
		trustedHops: Number.isInteger(hops) && hops >= 1 ? hops : 1,
		ipHeader: header && /^[a-z0-9-]{1,64}$/.test(header) ? header : null,
	};
}

/** 머리 값 하나의 상한. 정상 IP 표기는 이보다 훨씬 짧다(IPv6 최대 45자 + 대괄호·포트). */
const MAX_IP_TEXT = 64;

/**
 * IP 표기 하나를 검증·정규화한다. 아니면 null.
 * - `[v6]:port` · `v4:port` 꼴의 포트를 뗀다.
 * - IPv6 는 WHATWG URL 직렬화로 한 표기에 맞춘다(소문자 · 0 압축). `::1` 과 `0:0:0:0:0:0:0:1` 이 같다.
 * - IPv4-mapped(`::ffff:1.2.3.4` · `::ffff:102:304`)는 IPv4 로 바꾼다.
 * - 한계: IPv6 는 주소 하나가 키 하나다(/64 로 묶지 않는다). 한 사람이 주소를 바꿔 가며 키당 제한을
 *   비켜 갈 수 있다 — 전역 상한이 그 바닥을 받친다. zone id(`%eth0`)는 거부된다.
 */
export function normalizeIp(raw: string): string | null {
	let text = raw.trim();
	if (!text || text.length > MAX_IP_TEXT) return null;
	const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(text);
	if (bracketed) text = bracketed[1]!;
	else {
		const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(text);
		if (v4port) text = v4port[1]!;
	}
	const kind = isIP(text);
	if (kind === 4) return text;
	if (kind !== 6) return null;
	let v6: string;
	try {
		v6 = new URL(`http://[${text}]`).hostname.slice(1, -1);
	} catch {
		return null;
	}
	const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
	if (mapped) {
		const hi = parseInt(mapped[1]!, 16);
		const lo = parseInt(mapped[2]!, 16);
		return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
	}
	return v6;
}

/**
 * 호출 제한 키.
 *
 * - `trustProxy` 가 아니면 모두 'direct' 하나로 센다. 배포처가 정해지지 않았고(§3) 로컬은 사용자
 *   한 명이다. 믿을 앞단 없이 클라이언트 IP 머리를 쓰면 호출자가 키를 마음대로 바꾼다.
 * - `trustProxy` 면 `ipHeader` 가 있으면 그 값, 없으면 `x-forwarded-for` 의 오른쪽에서 `trustedHops` 번째 값.
 *   (왼쪽 값은 호출자가 써 넣은 것일 수 있다. 오른쪽 끝이 믿는 프록시가 덧붙인 것이다.)
 * - 값이 없거나 IP 가 아니면 'unknown' 하나를 함께 쓴다.
 */
export function clientKey(headers: Headers, config: ClientIpConfig): string {
	if (!config.trustProxy) return 'direct';
	let raw: string | undefined;
	if (config.ipHeader) {
		raw = headers.get(config.ipHeader) ?? undefined;
	} else {
		const xff = headers.get('x-forwarded-for');
		if (xff && xff.length <= MAX_IP_TEXT * 32) {
			const parts = xff.split(',');
			raw = parts[parts.length - config.trustedHops];
		}
	}
	const ip = raw === undefined ? null : normalizeIp(raw);
	return ip ? `ip:${ip}` : 'unknown';
}

/**
 * 동시 실행 상한 — MCP 처리(도구 = DB 질의 · 엔진)가 사이트 전체를 붙잡지 못하게.
 * 자리가 없으면 대기열에 선다. 대기열도 차면 null — 호출하는 쪽이 503 으로 답한다.
 */
export function createSemaphore(limit: number, maxQueue: number) {
	let active = 0;
	const queue: Array<() => void> = [];
	const release = () => {
		const next = queue.shift();
		if (next) next();
		else active -= 1;
	};
	return {
		/** 자리를 얻으면 풀어 주는 함수를 준다. 대기열이 차 있으면 null. */
		acquire(): Promise<() => void> | null {
			if (active < limit) {
				active += 1;
				return Promise.resolve(once(release));
			}
			if (queue.length >= maxQueue) return null;
			return new Promise(resolve => queue.push(() => resolve(once(release))));
		},
		stats: () => ({ active, queued: queue.length }),
	};
}

function once(fn: () => void): () => void {
	let done = false;
	return () => {
		if (done) return;
		done = true;
		fn();
	};
}

export const MAX_CONCURRENT = 4;
export const MAX_QUEUE = 16;

/** `/mcp` 가 같이 쓰는 동시 실행 상한. */
export const mcpSemaphore = createSemaphore(MAX_CONCURRENT, MAX_QUEUE);
