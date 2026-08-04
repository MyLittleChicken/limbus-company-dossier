import { canonical } from '@/lib/db-canonical';

/**
 * 인격 획득 경로.
 *
 * **캐노니컬이 이 값을 담지 않았다.** 원본(`limbus-assets` 의 `identities`)에는 `event` 와
 * `eventReward` 두 열쇠가 있는데 파이프라인이 옮기지 않았다. 그래서 여기서만 원본 층을
 * 직접 읽는다 — **화면이 raw 를 읽는 것은 임시다.** 근본 해결은 `canonical.identity` 에
 * 필드로 담는 것이고, 담기면 이 파일은 사라진다.
 *
 * 실측(우리 인격 184 기준)은 이렇다.
 *
 *   eventReward = true   13   이벤트 보상으로 지급된 인격
 *   event = true 만       18   이벤트 기간에 나왔으나 보상은 아니다
 *   둘 다 없음           153
 *
 * 두 예로 갈렸다 — 「약지 야수파 스튜던트」(뫼르소, 10515)는 `eventReward` 가 서 있고
 * 「약지 야수파 도슨트」(로쟈, 10915)는 `event` 만 서 있다. 게임에서 앞은 이벤트 보상,
 * 뒤는 추출이었다. 그래서 **보상 여부는 `eventReward` 하나로 가른다.**
 */
export async function listEventRewardIdentityIds(): Promise<Set<string>> {
	const rows = await canonical.rawObject.findMany({
		where: { source: 'limbus-assets', entity: 'identities' },
		select: { id: true, payload: true },
	});

	const ids = new Set<string>();
	for (const row of rows) {
		const payload = row.payload as Record<string, unknown> | null;
		if (payload?.['eventReward'] === true) ids.add(row.id);
	}
	return ids;
}
