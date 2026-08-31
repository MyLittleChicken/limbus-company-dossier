/**
 * 합법 편성 짜기 — 수감자 하나당 인격 하나만 낸다.
 *
 * **이것이 이 태스크의 존재 이유다.** 앞선 회차가 이 규칙을 빠뜨려 이상이 12
 * 명보다 많은 편성을 만들었다 — 사용자가 「무슨 덱인지 모르겠다」고 했고, 실제로
 * 편성이 아니라 인격 목록이었다(한 수감자가 인격을 여럿 냈다). `lib/engine/v2`
 * 는 안 건드린다 — 이 태스크는 그 엔진과 무관하게 편성 하나를 순수 함수로 짠다.
 */

/** `canonical.identity` · `canonical.identity_text` 를 옮긴 것. DB 를 모른다 */
export interface Identity {
	id: string;
	sinnerId: string;
	/** 수감자 이름(「이상」) */
	name: string;
	/** 인격 칭호. **줄바꿈이 들어 있다**(예: `"검계\n살수"`) */
	title: string;
}

/** 「검계 살수 이상」 — title 의 줄바꿈을 공백으로 이어 한 줄로 만든다 */
export function labelOf(i: Identity): string {
	return `${i.title.replace(/\n/g, ' ')} ${i.name}`;
}

/**
 * 편성 하나를 짠다 — `prefer` 가 큰 인격부터, 수감자마다 하나만.
 *
 * **한 번의 정렬이면 충분하다.** 인격 전체를 prefer 내림차순으로 한 줄로 세우고
 * 앞에서부터 훑으며 처음 보는 수감자만 집으면, 그 수감자에서 가장 센 인격이
 * 항상 먼저 걸린다(같은 수감자의 나머지는 뒤에 있어 「이미 씀」에 자동으로
 * 걸러진다) — 그리고 `size` 가 다 찰 때까지 그대로 훑으면 「모자라면 남은
 * 수감자에서 prefer 가 가장 큰 것으로 메운다」(prefer 가 0 이어도)도 같은
 * 한 바퀴로 끝난다. 두 단계로 나눠 짤 이유가 없다.
 *
 * **무작위를 안 쓴다.** `Math.random` 을 쓰면 표본을 다시 짤 때마다 편성이
 * 달라져 「왜 이 열둘인가」를 답할 수 없다. 동점은 `id` 오름차순으로 고정한다.
 */
export function buildSquad(
	pool: Identity[],
	prefer: (id: string) => number,
	size = 12,
): Identity[] {
	const sorted = [...pool].sort((a, b) => {
		const byPrefer = prefer(b.id) - prefer(a.id);
		if (byPrefer !== 0) return byPrefer;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // 동점은 id 오름차순
	});

	const squad: Identity[] = [];
	const usedSinners = new Set<string>();
	for (const identity of sorted) {
		if (squad.length >= size) break;
		if (usedSinners.has(identity.sinnerId)) continue; // 이 수감자는 이미 냈다
		squad.push(identity);
		usedSinners.add(identity.sinnerId);
	}
	return squad;
}
