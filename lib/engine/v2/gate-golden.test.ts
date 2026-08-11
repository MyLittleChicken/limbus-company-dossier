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
	})
	: [];
const byId = new Map(verdicts.map((v) => [v.giftId, v]));

/** 손으로 설명문을 읽어 판정한 열 건 */
const EXPECTED: Array<[string, boolean, string]> = [
	['9140', true, '결의 — 시 협회는 적용 범위, 참격으로 발동한다'],
	['9194', true, '짧은 케인 소드 — 세븐 협회는 적용 범위'],
	['9005', false, '상처붙이 — 출혈이 진짜 조건'],
	['9023', false, '벼락가지 — 파열이 진짜 조건'],
	['9048', false, '녹슨 커터 나이프 — 출혈이 조건, 색욕은 강화판'],
	['9041', false, '적색 지령 — 침잠이 조건'],
	['9718', false, '검계 3인 게이트 — 이 덱에 검계가 없다'],
	['9717', false, '흑운회 3인 게이트'],
	['9043', false, '사원증 — 진짜 OR 이지만 이 PR 로는 못 고친다'],
	['9052', false, '휴대용 전지 소켓 — 우선순위 주석 문제, 이 PR 밖'],
];

for (const [giftId, want, why] of EXPECTED) {
	test(`${giftId} 는 ${want ? '산다' : '죽는다'} — ${why}`, DB, () => {
		assert.equal(byId.get(giftId)?.fireable, want);
	});
}

test('게이트 기프트는 게이트만 막는다 — 수혜 대상은 blocking 이 아니다', DB, () => {
	const v = byId.get('9718');
	const gate = v?.reasons.find((r) => r.refKind === 'association');
	const payoff = v?.reasons.find((r) => r.refKind === 'attack_type');
	assert.equal(gate?.blocking, true);
	assert.equal(payoff?.blocking, false);
});

test('실측 — 죽는 기프트 130 · 발동 가능 321', DB, () => {
	const dead = verdicts.filter((v) => !v.fireable).length;
	assert.equal(dead, 130);
	assert.equal(verdicts.length - dead, 321);
});
