/**
 * 스킬 코인 효과 문자열의 대괄호 토큰을 뽑는다.
 *
 * **스펙 6절 「그래프 파생을 위한 조건」의 구현이다.** 원문은 skill_coin.effects 에
 * 그대로 남고 이것은 분해 결과다 — 파싱이 틀려도 원문에서 다시 뽑을 수 있다.
 *
 * 실측 유일 215종이며 상태 189 + 발동 시점 26 으로 정확히 갈린다. 남는 것이 없다.
 *
 *   "[OnSucceedAttack] Inflict 3 [Sinking]"
 *     → OnSucceedAttack (timing) · Sinking (status, amount 3)
 */
export interface ParsedToken {
	token: string;
	/** 문자열 안 등장 순서 */
	ordinal: number;
	/** 토큰 바로 앞 숫자. 없으면 null */
	amount: number | null;
}

/** 대괄호 안 토큰. 첫 글자가 영문이어야 한다 — `[3]` 같은 숫자는 토큰이 아니다. */
const TOKEN = /\[([A-Za-z][A-Za-z0-9 _-]*)\]/g;

/** 토큰 바로 앞의 숫자. "Inflict 3 " 의 3 을 잡는다. */
const AMOUNT_BEFORE = /(\d+)\s*$/;

export function parseCoinTokens(effect: string): ParsedToken[] {
	const out: ParsedToken[] = [];
	let ordinal = 0;
	let cursor = 0;
	TOKEN.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TOKEN.exec(effect)) !== null) {
		const token = m[1];
		if (token === undefined) continue;
		// 앞 토큰이 끝난 자리부터 이 토큰 시작까지가 수치를 찾을 구간이다.
		// 그래야 앞 토큰의 수치가 뒤 토큰으로 새지 않는다.
		const between = effect.slice(cursor, m.index);
		const found = AMOUNT_BEFORE.exec(between);
		out.push({
			token,
			ordinal,
			amount: found?.[1] === undefined ? null : Number(found[1]),
		});
		ordinal += 1;
		cursor = m.index + m[0].length;
	}
	return out;
}
