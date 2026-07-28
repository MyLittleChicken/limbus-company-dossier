/**
 * 비트 문자열 조작.
 *
 * 덱 코드 가이드가 비트 위치를 **1-기준 포함 구간**으로 적으므로 그 표기를 그대로 쓴다.
 * 0-기준으로 바꾸면 문서와 코드를 대조할 때마다 ±1 을 암산해야 하고 그게 곧 버그가 된다.
 */

export function bytesToBits(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(2).padStart(8, '0');
	return out;
}

export function bitsToBytes(bits: string): Uint8Array {
	if (bits.length % 8 !== 0) throw new Error(`비트 길이가 8의 배수가 아니다: ${bits.length}`);
	const out = new Uint8Array(bits.length / 8);
	for (let i = 0; i < out.length; i += 1) {
		out[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
	}
	return out;
}

export function readField(bits: string, start1: number, end1: number): number {
	const slice = bits.slice(start1 - 1, end1);
	if (slice.length !== end1 - start1 + 1) throw new Error(`구간이 범위를 벗어난다: ${start1}-${end1}`);
	return Number.parseInt(slice, 2);
}

export function writeField(bits: string, start1: number, end1: number, value: number): string {
	const width = end1 - start1 + 1;
	if (value < 0 || value >= 2 ** width) {
		throw new Error(`값 ${value} 는 ${width}비트에 담기지 않는다`);
	}
	const encoded = value.toString(2).padStart(width, '0');
	return bits.slice(0, start1 - 1) + encoded + bits.slice(end1);
}
