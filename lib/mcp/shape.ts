/**
 * 화면용 질의 결과 → 에이전트용 모양(설계 §6.3).
 *
 * 이미지 · 아이콘 · 스프라이트 · 아트 · 화면 링크를 뺀다. 링크는 도구가 `siteUrl` 로 다시 붙인다.
 */
const MEDIA_KEYS: ReadonlySet<string> = new Set([
	'image', 'images', 'icon', 'icons', 'iconKey', 'sprite', 'art', 'href',
	'frame', 'rarityIcon', 'rankIcon', 'bossIcon',
]);

/**
 * 키 이름을 놓쳐도 값이 애셋 경로면 뺀다 — 질의 함수가 새 애셋 키를 더해도 응답에 새지 않게.
 * `/media/…` 경로이거나 이미지 확장자로 끝나는(쿼리 문자열 허용) 문자열이다.
 */
const ASSET_VALUE = /^\/media\/|\.(?:png|webp|jpe?g|gif|svg|avif)(?:\?.*)?$/i;

/**
 * `MEDIA_KEYS` 의 키와 애셋 경로 값(`ASSET_VALUE`)을 재귀적으로 뺀다. 원본은 건드리지 않는다.
 *
 * plain object(프로토타입이 `Object.prototype` 또는 `null`)와 배열만 들어간다. 그 밖의 값
 * (Date · Map · Decimal · Buffer 등)은 손대지 않고 그대로 통과시킨다 — JSON 으로 옮길 수
 * 있는지는 `ok()` 가 따로 본다.
 */
export function stripMedia<T>(value: T): T {
	return strip(value) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function strip(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.filter((v) => !(typeof v === 'string' && ASSET_VALUE.test(v))).map(strip);
	}
	if (!isPlainObject(value)) return value;
	const out: Record<string, unknown> = {};
	for (const [key, v] of Object.entries(value)) {
		if (MEDIA_KEYS.has(key)) continue;
		if (typeof v === 'string' && ASSET_VALUE.test(v)) continue;
		out[key] = strip(v);
	}
	return out;
}
