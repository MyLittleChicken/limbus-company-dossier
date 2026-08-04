import { canonical } from '@/lib/db-canonical';

/**
 * 팩 분류 태그.
 *
 * **현행 `public.pack` 에는 없는 축이다.** 현행은 `category` 한 칸에 `event` 처럼 뭉쳐
 * 담지만, 캐노니컬은 원본의 중첩 분류를 `pack_tag` 과 `pack_category_path` 로 편다 —
 * `Attack Type > Slash` · `Canto > I` · `Collab` · `Hidden` 같은 것이다.
 *
 * 지금 필요한 것은 콜라보 판정 하나다. 이름으로 짐작하거나 id 를 박아 넣지 않고
 * **데이터가 가진 태그를 읽는다** — 실측 1 건이며 명일방주 「선의의 순례」다.
 */
export async function listCollabPackIds(): Promise<Set<string>> {
	const rows = await canonical.packTag.findMany({
		where: { tag: 'Collab' },
		select: { packId: true },
	});
	return new Set(rows.map((r) => r.packId));
}
