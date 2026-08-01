/**
 * Unity 리치텍스트 마크업을 지운다.
 *
 * **화이트리스트로 지운다.** `<[^>]*>` 로 뭉뚱그리면 게임 텍스트의 리터럴
 * 꺾쇠까지 지운다. 실측 태그 24종 중 **절반이 리터럴**이다.
 *
 *   마크업   style 17,081 · color 551 · noparse 346 · u 339 · link 280 …
 *   리터럴   <Bloodfiend> 54 · <La …> 36 · <Bloodbag> 7 · <Mechanical> 6 …
 *
 * 현행 `src/text.ts` 의 `UNITY_TAGS` 와 같은 목록이다 — 의도적으로 복제한다.
 * 신규 파이프라인이 현행 코드에 의존하면 현행을 고칠 때 신규가 깨진다.
 */
const UNITY_TAGS = [
	'color', 'style', 'b', 'i', 'u', 's', 'size', 'mark', 'sprite', 'link', 'noparse',
	'font', 'br', 'align', 'cspace', 'indent', 'line-height', 'lowercase', 'uppercase',
	'smallcaps', 'margin', 'nobr', 'pos', 'space', 'voffset', 'width', 'alpha',
	'gradient', 'rotate', 'sup', 'sub',
] as const;

const MARKUP = new RegExp(`</?(?:${UNITY_TAGS.join('|')})\\b[^>]*>`, 'gi');

/**
 * 마크업을 지운 표시용 문자열. 원문은 `*_raw` 컬럼에 그대로 남는다.
 * 지운 결과가 원문과 같으면 `raw` 를 담을 필요가 없다.
 */
export function stripMarkup(text: string): string {
	return text.replace(MARKUP, '');
}

/** 마크업이 들어 있나. `desc_raw` 를 담을지 정하는 데 쓴다. */
export function hasMarkup(text: string): boolean {
	MARKUP.lastIndex = 0;
	return MARKUP.test(text);
}

/**
 * 표시용 `desc` 와 원문 `descRaw` 를 함께 낸다.
 *
 * 마크업이 없으면 `descRaw` 는 null 이다 — `desc` 가 곧 원문이므로 중복 저장할
 * 이유가 없다. 있으면 원문을 남겨 파싱이 틀려도 되돌릴 수 있다.
 */
export function descOf(raw: string | null): { desc: string | null; descRaw: string | null } {
	if (raw === null) return { desc: null, descRaw: null };
	if (!hasMarkup(raw)) return { desc: raw, descRaw: null };
	return { desc: stripMarkup(raw), descRaw: raw };
}
