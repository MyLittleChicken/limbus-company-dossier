/**
 * base64 와 gzip — 브라우저와 Node 양쪽에서 같은 구현으로 돈다.
 *
 * `node:zlib` 과 `Buffer` 를 쓰지 않는다. 이 코드가 클라이언트 컴포넌트에서 불리므로
 * Node 전용 모듈을 쓰면 번들러 폴리필에 의존하게 되고, 그 동작은 우리가 보증할 수 없다.
 * `CompressionStream` 과 `btoa`/`atob` 는 Node 22+ 와 현행 브라우저에 전역으로 있다.
 *
 * 실측 — `CompressionStream` 출력이 gzip 매직(1f 8b 08)을 갖고 `node:zlib` 산출물과
 * 상호운용되며, `btoa` 결과가 `Buffer.toString('base64')` 와 바이트 단위로 같다.
 */

/** 스프레드로 넘기면 인자 수 상한에 걸린다. 560비트는 70바이트라 여유가 있지만 청크로 나눈다. */
export function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
	return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/**
 * `lib.dom.d.ts` 는 `CompressionStream`/`DecompressionStream` 의 writable 을
 * `WritableStream<BufferSource>` 로 선언한다(스펙상 임의의 바이트뷰를 받으므로).
 * 제네릭 `TransformStream<Uint8Array, Uint8Array>` 로 받으면 그 타입과 안 맞아
 * 타입 검사가 깨진다. 실제로 필요한 두 타입의 합집합으로 좁혀서 받는다.
 *
 * `writer.write(bytes)` 의 캐스트는 별개 문제다 — TS 5.7 부터 `Uint8Array` 가
 * `ArrayBufferLike`(=  `ArrayBuffer | SharedArrayBuffer`) 에 대해 제네릭이라,
 * `BufferSource`(= `ArrayBuffer` 로 고정)가 요구하는 타입과 형식적으로 어긋난다.
 * 실행 시점에는 항상 평범한 `ArrayBuffer` 백킹이라 안전하다.
 */
/**
 * 스트림이 에러 상태가 되면 `write()`/`close()` 가 돌려주는 프로미스도 함께 reject
 * 한다(`TransformStream` 은 writable/readable 이 에러 상태를 공유한다). 이 프로미스를
 * `void` 로 버리면(원래 코드) 아무도 지켜보지 않은 채 reject 돼서 Node 가
 * unhandledRejection 으로 프로세스를 죽인다 — 브라우저 탭은 콘솔 경고로 끝나지만, 이
 * 코드가 Node 테스트(`npx tsx --test`)와 향후 CI 에서도 도는 이상 무시할 수 없다.
 *
 * 진짜 실패 원인은 readable 쪽 `arrayBuffer()` 도 항상 함께 reject 해 주므로,
 * write/close 의 reject 는 여기서 흡수(catch)해 "누군가 지켜봤다"는 사실만 만들고,
 * 호출자에게는 `arrayBuffer()` 의 reject 하나로만 전달한다. 정상 입력이면 셋 다
 * resolve 라 동작은 그대로다.
 */
async function through(stream: CompressionStream | DecompressionStream, bytes: Uint8Array) {
	const writer = stream.writable.getWriter();
	const writeDone = writer.write(bytes as BufferSource).catch(() => {});
	const closeDone = writer.close().catch(() => {});
	const [buffer] = await Promise.all([
		new Response(stream.readable).arrayBuffer(),
		writeDone,
		closeDone,
	]);
	return new Uint8Array(buffer);
}

export const gzip = (bytes: Uint8Array): Promise<Uint8Array> =>
	through(new CompressionStream('gzip'), bytes);

export const gunzip = (bytes: Uint8Array): Promise<Uint8Array> =>
	through(new DecompressionStream('gzip'), bytes);
