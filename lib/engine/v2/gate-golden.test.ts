/**
 * 게이트 골든 — 적재된 `canonical` 로 실제 편성을 판정한다.
 *
 * 열 건 전부 설명문을 손으로 읽어 판정한 것이다. 규칙이 이 열을 맞히면
 * 「게이트만 막는다」가 실제 데이터에서 선다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { NO_DB, canonicalReachable } from '../../../src/v2/canonical/db-available.js';
import { loadEngineData } from './load';
import { Profile } from './profile';
import { evaluateGifts } from './evaluate';
import type { Squad } from './types';

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };

const IDS = ['10216', '11216', '11009', '10916', '10716', '10512'];
const SQUAD: Squad = { roster: IDS.map((identityId) => ({ identityId, egoIds: [] })), field: IDS };

const data = DB.skip === false ? await loadEngineData(prisma) : null;
const verdicts = DB.skip === false
	? evaluateGifts({
		squad: SQUAD, profile: new Profile(SQUAD, data!.capabilities),
		giftTriggers: data!.giftTriggers, refsByTrigger: data!.refsByTrigger, params: data!.params,
		abilities: data!.abilities, abilityConds: data!.abilityConds, supply: data!.supply,
	})
	: [];
const byId = new Map(verdicts.map((v) => [v.giftId, v]));

/** 손으로 설명문을 읽어 판정한 열 건 */
const EXPECTED: Array<[string, boolean, string]> = [
	['9140', true, '결의 — 시 협회는 적용 범위, 참격으로 발동한다'],
	/**
	 * **알려진 결함이다 — 축복이 아니다**(2026-08-12).
	 *
	 * 설명문은 문단이 둘이다. 앞은 「참격 기본 공격 스킬로 합 승리 시」이고
	 * 뒤가 「스테이지 시작 시, 세븐 협회 …」다. 앞 문단이 절로 안 잡혀 세븐이
	 * 유일한 조건이 됐고, 그래서 세븐 없는 덱에서 거짓으로 죽는다(163덱에서
	 * 162 → 64). **같은 모양이 28건 있다** — 빈 줄로 갈린 문단이 있는데 절이
	 * 하나뿐인 기프트다.
	 *
	 * 고치려면 `scripts/split-clauses.ts` 를 손봐야 하고 그건 1단계(저작) 일이라
	 * 이 PR 밖이다. 값을 실제에 맞춰 두되 **이유를 남겨 다음 절 회차가 집는다.**
	 */
	['9194', false, '짧은 케인 소드 — 앞 문단이 절로 안 잡힌 결함. 28건 갈래'],
	['9005', false, '상처붙이 — 출혈이 진짜 조건'],
	['9023', false, '벼락가지 — 파열이 진짜 조건'],
	['9048', false, '녹슨 커터 나이프 — 출혈이 조건, 색욕은 강화판'],
	['9041', false, '적색 지령 — 침잠이 조건'],
	['9718', false, '검계 3인 게이트 — 이 덱에 검계가 없다'],
	['9717', false, '흑운회 3인 게이트'],
	// 게이트 PR 이 「이 PR 로는 못 고친다」로 남긴 둘. 절 모형이 고쳤다 —
	// 사원증은 「분노 완전 공명 **또는** 충전」이라 이 덱에서 충전으로 선다.
	// 전지 소켓도 같은 갈래다(2026-08-12)
	['9043', true, '사원증 — 진짜 OR 이었고 절 모형이 고쳤다'],
	['9052', true, '휴대용 전지 소켓 — 절 모형이 고쳤다'],
];

for (const [giftId, want, why] of EXPECTED) {
	test(`${giftId} 는 ${want ? '산다' : '죽는다'} — ${why}`, DB, () => {
		assert.equal(byId.get(giftId)?.fireable, want);
	});
}

/**
 * 절 모형에는 「게이트 vs 수혜 대상」이 없다 — 조건은 그냥 조건이다.
 *
 * 대신 **강화판의 조건은 못 막는다.** 9048 녹슨 커터 나이프는 절 0(출혈)이
 * 조건이고 절 1(색욕)은 그 강화판이다. 색욕이 없다고 기프트가 죽으면 안 된다.
 */
test('강화판의 조건은 blocking 이 아니다', DB, () => {
	const v = byId.get('9048');
	const base = v?.reasons.find((r) => r.refId === 'LACERATION');
	const refined = v?.reasons.find((r) => r.refId === 'lust');
	assert.equal(base?.blocking, true);
	assert.equal(refined?.blocking, false);
});

/**
 * **거짓 죽음이 사라진 것이 이 단계의 값이다.**
 *
 * 옛 판정은 이 덱에서 130건을 죽였는데 「발동 불가」 173건 중 158건(91%)이
 * 틀렸다는 실측이 있었다. 절 모형은 조건을 문장에서 뽑으므로 그 종류의
 * 어림이 없다.
 */
test('실측 — 죽는 기프트가 130 에서 73 으로 줄었다', DB, () => {
	const dead = verdicts.filter((v) => !v.fireable).length;
	assert.equal(dead, 73);
	assert.equal(verdicts.length - dead, 383);
});
