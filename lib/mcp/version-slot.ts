/**
 * 데이터 판(dataVersion) 키 단일 슬롯 캐시.
 *
 * 판이 같으면 같은 값을 주고, 바뀌면 이전 것을 버리고 다시 읽는다. 읽다 실패하면 슬롯을 비운다.
 * `cacheReference` 와 달리 지난 판의 값을 프로세스에 남기지 않는다.
 */
export function versionSlot<T>(load: (version: string) => Promise<T>): (version: string) => Promise<T> {
	let slot: { version: string; value: Promise<T> } | null = null;
	return (version) => {
		if (slot?.version === version) return slot.value;
		const mine = { version, value: load(version) };
		slot = mine;
		mine.value.catch(() => {
			if (slot === mine) slot = null;
		});
		return mine.value;
	};
}
