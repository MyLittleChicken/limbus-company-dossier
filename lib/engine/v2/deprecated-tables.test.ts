/**
 * 엔진이 폐기된 표를 **새로** 읽지 못하게 한다.
 *
 * 폐기 5표는 `canonical.gift_ability` 가 대신한다. 다만 판정을 옮기는 것은
 * 2단계 PR 이므로 지금은 다섯 다 읽고 있다 — 그 사실을 허용 목록에 적어 두고
 * **목록이 늘어나는 것만** 막는다.
 *
 * 지금은 다섯이 다 허용 목록에 있으므로 첫 검사는 아직 걸릴 것이 없다.
 * 폐기 표가 더 생겼을 때를 위한 톱니다. **살아 있는 검사는 둘째**다 —
 * 2단계가 하나씩 끊을 때 목록도 같이 줄어야 하고, 안 줄면 그것이 알려준다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DEPRECATED = ['giftTrigger', 'giftEffect', 'triggerRef', 'effectRef', 'giftTriggerParam'];

/**
 * 아직 남는 부채. **여기에 새로 더하지 마라.**
 *
 * `giftTriggerParam` 은 2단계가 끊었다(2026-08-12) — 판정이 절로 옮겨가며 그
 * 표를 보는 곳이 옛 판정뿐이 됐고, 옛 판정은 `scripts/verdict-diff.ts` 가
 * 대조용으로만 부르므로 그 스크립트가 직접 읽는다.
 *
 * 남은 넷은 **연쇄(`chain.ts`)가 쓴다** — 「보유 기프트가 이 기프트를 켜 주나」
 * 를 답하려면 기프트의 효과와 참조가 필요하고, 그것은 절 모형이 아직 안 담는다.
 * 연쇄를 절로 옮기는 것이 이 넷을 끊는 조건이다.
 */
const ALLOWED_UNTIL_STAGE_2 = new Set([
	'giftTrigger', 'giftEffect', 'triggerRef', 'effectRef',
]);

const loadSrc = (): string => readFileSync(new URL('./load.ts', import.meta.url), 'utf8');

test('엔진이 읽는 폐기 표가 허용 목록보다 늘지 않았다', () => {
	const src = loadSrc();
	const unexpected = DEPRECATED
		.filter((t) => src.includes(`prisma.${t}.`))
		.filter((t) => !ALLOWED_UNTIL_STAGE_2.has(t));
	assert.deepEqual(
		unexpected, [],
		`폐기된 표를 새로 읽고 있다: ${unexpected.join(', ')} — canonical.gift_ability 를 써라`,
	);
});

test('허용 목록에 죽은 항목이 없다', () => {
	// 2단계가 하나씩 끊을 때 목록도 같이 줄어야 한다. 안 줄면 이 검사가
	// 알려준다 — 「이제 안 읽는데 목록에 남아 있다」
	const src = loadSrc();
	const stale = [...ALLOWED_UNTIL_STAGE_2].filter((t) => !src.includes(`prisma.${t}.`));
	assert.deepEqual(
		stale, [],
		`이제 안 읽는데 허용 목록에 남아 있다: ${stale.join(', ')} — 목록에서 빼라`,
	);
});
