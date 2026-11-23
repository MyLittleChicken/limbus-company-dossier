import { canonical } from '@/lib/db-canonical';
import { loadEngineData, type EngineData } from '@/lib/engine/v2/load';
import type { Capability } from '@/lib/engine/v2/types';
import { cacheReference } from '@/lib/query-cache';
import { currentSnapshotId } from './envelope';

/** 스냅샷 id 하나당 한 번 읽는다. 같은 스냅샷이면 다시 읽을 이유가 없어 TTL 은 길다. */
const engineDataFor = cacheReference(
	(_snapshotId: string | null) => loadEngineData(canonical),
	24 * 60 * 60_000,
);

/**
 * 엔진 입력 묶음. 편성과 무관하게 고정이라 스냅샷마다 한 번만 읽는다.
 * 키는 봉투와 같은 `currentSnapshotId()`(1 분 캐시) — 스냅샷이 바뀌면 다음 호출부터 다시 읽고,
 * 응답의 snapshotId 와 판정 데이터가 어긋나지 않는다.
 * 조회 도구(인격 축)와 엔진 도구(판정)가 같은 것을 쓴다.
 */
export async function engineData(): Promise<EngineData> {
	return engineDataFor(await currentSnapshotId());
}

export interface IdentityAxes {
	tag: string[];
	skill: string[];
}

/**
 * 인격별 축을 두 층으로 — `tag`(인격 취급) · `skill`(스킬 취급). 둘을 섞지 않는다(설계 §6.2).
 *
 * 무조건(`gateKind === 'always'`) 행만 센다 — E.G.O 장착 · 기프트 보유 같은 게이트 축은
 * 편성에 따라 달라지므로 인격 자체의 축이 아니다. `affects` 가 `tag`·`both` 면 tag,
 * `skill`·`both` 면 skill 에 든다. 값은 `refKind:refId`(실데이터의 키워드 축은
 * `axis:VIBRATION` 꼴), 정렬 · 중복 없음.
 *
 * `always` 행이 하나도 없는 인격은 Map 에 **없다** — `get()` 이 `undefined` 를 준다.
 * 빈 배열로 받으려면 `axesOf(map, id)` 를 쓴다.
 */
export function identityAxes(capabilities: Capability[]): Map<string, IdentityAxes> {
	const sets = new Map<string, { tag: Set<string>; skill: Set<string> }>();
	for (const cap of capabilities) {
		if (cap.gateKind !== 'always') continue;
		let entry = sets.get(cap.identityId);
		if (!entry) {
			entry = { tag: new Set(), skill: new Set() };
			sets.set(cap.identityId, entry);
		}
		const value = `${cap.refKind}:${cap.refId}`;
		if (cap.affects === 'tag' || cap.affects === 'both') entry.tag.add(value);
		if (cap.affects === 'skill' || cap.affects === 'both') entry.skill.add(value);
	}
	const out = new Map<string, IdentityAxes>();
	for (const [id, { tag, skill }] of sets) out.set(id, { tag: [...tag].sort(), skill: [...skill].sort() });
	return out;
}

/** `identityAxes` 결과에서 한 인격의 축. 없으면 두 층 모두 빈 배열(새 배열). */
export function axesOf(map: Map<string, IdentityAxes>, identityId: string): IdentityAxes {
	const found = map.get(identityId);
	return found ? { tag: [...found.tag], skill: [...found.skill] } : { tag: [], skill: [] };
}
