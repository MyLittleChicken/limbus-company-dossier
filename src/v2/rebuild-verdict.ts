/**
 * 재현 검사의 판정부. **순수라 DB 없이 테스트한다.**
 *
 * `verify-rebuild.ts` 에서 갈라 둔 이유는 그 파일이 최상위에서 `main()` 을
 * 돌리기 때문이다 — 테스트가 import 하면 실행된다. `schema-ops.ts` 가 SQL 을
 * 만드는 것과 실행하는 것을 가른 것과 같은 이유다.
 */

export type Verdict = 'reproduced' | 'input-changed' | 'failed' | 'undecidable';

/**
 * 판정. **입력이 먼저다** — 입력이 달라졌으면 결과가 다른 것이 정상이고,
 * 그때 「재현 실패」라고 말하면 거짓말이다(ADR-08).
 *
 * `undecidable` 은 여기서 안 낸다. 판 표식이 없거나 두 행인 경우인데, 그건
 * 대조를 시작하기도 전에 갈리므로 호출부가 먼저 끊는다.
 */
export function verdictOf(s: { inputChanged: boolean; same: boolean }): Verdict {
	if (s.inputChanged) return 'input-changed';
	return s.same ? 'reproduced' : 'failed';
}

/** 대조에서 뺄 표. `build_info` 는 `built_at` 이 굽는 순간이라 매번 다르다. */
export const DIGEST_EXCLUDE = new Set(['build_info']);
