import { canonical } from '@/lib/db-canonical';
import { loadEngineData, type EngineData } from '@/lib/engine/v2/load';
import type { Capability } from '@/lib/engine/v2/types';
import { dataVersion } from './version';

/** 단일 슬롯 — 지금 판 하나만 든다. 판이 바뀌면 이전 것은 버린다(쌓이지 않는다). */
let slot: { version: string; loadedAt: number; value: Promise<EngineData> } | null = null;

/**
 * 상한 TTL 백스톱. dataVersion 이 그대로여도 이만큼 지나면 다시 읽는다 — 판 표지가 변화를
 * 못 볼 때(Postgres 통계 off · 읽기 전용 standby 의 통계 · 권한 없음 `w?`) 낡은 판이 영영
 * 남지 않게. 15 분 = 갱신 주기(수 시간 이상)보다 짧고, 다시 읽는 값(~수십 ms)은 작다.
 */
export const ENGINE_DATA_MAX_AGE_MS = 15 * 60_000;

/**
 * 엔진 입력 묶음. 편성과 무관하게 고정이라 데이터 판(`dataVersion`)마다 한 번만 읽는다.
 *
 * 키는 봉투와 같은 `dataVersion` — 라이브 갱신(snapshot 행은 그대로)도 다음 호출부터 반영되고,
 * 응답의 dataVersion 과 판정 데이터가 어긋나지 않는다. 도구는 `engineData(ctx.dataVersion)` 으로
 * 호출 머리에 읽은 판을 넘긴다. 빠지면 지금 판을 읽는다. 읽다 실패하면 슬롯을 비운다.
 * 판이 같아도 `ENGINE_DATA_MAX_AGE_MS` 가 지나면 다시 읽는다. `now` 는 시험이 시계를 주입하는 자리.
 * 조회 도구(인격 축)와 엔진 도구(판정)가 같은 것을 쓴다.
 */
export async function engineData(version?: string, now: () => number = Date.now): Promise<EngineData> {
	const key = version ?? (await dataVersion());
	const at = now();
	if (slot?.version === key && at - slot.loadedAt < ENGINE_DATA_MAX_AGE_MS) return slot.value;
	const mine = { version: key, loadedAt: at, value: loadEngineData(canonical) };
	slot = mine;
	mine.value.catch(() => {
		if (slot === mine) slot = null;
	});
	return mine.value;
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
