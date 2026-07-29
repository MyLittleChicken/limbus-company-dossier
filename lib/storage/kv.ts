/**
 * 저장소 접근과 실패 표현.
 *
 * localStorage 는 사파리 프라이빗 모드와 용량 초과에서 던진다. 던지는 것을 그대로
 * 흘리면 화면이 죽거나 조용히 삼키게 되는데, 둘 다 결손을 감추는 쪽이다
 * (02-data-model 6절). 실패를 값으로 만들어 호출부가 표기하도록 강제한다.
 *
 * `Kv` 로 좁혀 받는 이유는 브라우저 없이 테스트하기 위해서다.
 */

export interface Kv {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(reason: string): Result<T> => ({ ok: false, reason });

/** 테스트용. 실패 경로를 실제로 밟아 보기 위해 던지는 모드를 갖는다. */
export function memoryKv(options: { throwOnSet?: boolean } = {}): Kv {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			if (options.throwOnSet) throw new Error('quota exceeded');
			map.set(k, v);
		},
	};
}
