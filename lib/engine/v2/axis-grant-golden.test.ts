/**
 * 축 제한·부여 골든 — 적재된 `canonical` 로 실제 편성의 **축 공급**을 잰다.
 *
 * **기프트 판정은 여기서 단정하지 않는다.** 이 PR 은 「이 인격이 어느 축의
 * 인격인가」(태그 층)를 옳게 만들 뿐이고, 기프트 조건이 태그를 묻는지 스킬을
 * 묻는지 가릴 칸(`supply`)이 아직 없다.
 *
 * 9073 엔도르핀 키트가 그 경계를 정확히 보여준다.
 *   조건    「스킬 효과로 호흡 위력을 획득할 때마다」 — **스킬 층**을 묻는다
 *   10916   호흡 인격은 아니다(패시브 1091603 이 화상·진동으로 제한)
 *           그러나 스킬 1091606 이 Breath 5 를 준다(coin_token, uptie 1~5 전부)
 *   이 경계는 코드로 단정하지 않고 결손으로 남긴다
 *   (`identity-axis.ts`의 `meta.gap('gift', '9073', 'supply', …)`).
 *
 * 지금 엔진은 공급을 무조건 태그 층에서 세므로 이 기프트를 죽인다. 그 답이
 * 옳아지려면 조건에 `supply` 가 있어야 하고, 그것은 기프트 능력 PR 의 몫이다.
 * 여기서 `fireable` 을 단정하면 틀린 답을 골든으로 굳히게 된다.
 *
 * 「제한 다섯의 축과 채널」·「10508 게이트」는 `src/v2/verify-canonical.ts` 에
 * 이미 있다(Task 6, RESTRICTED_EXPECTED·10104 채널·10508 ego_equipped 검사).
 * 그쪽은 DB 원시 행을 직접 본다. 여기서는 **엔진의 `Profile`** 이 같은 사실에서
 * 같은 답을 내는지를 잰다 — 값이 옳아도 `Profile.count` 가 옳게 읽는지는 별개다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { NO_DB, canonicalReachable } from '../../../src/v2/canonical/db-available.js';
import { loadEngineData } from './load';
import { Profile } from './profile';
import type { Squad } from './types';

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };

const IDS_A = ['10216', '11216', '11009', '10916', '10716', '10512'];
const DECK_A: Squad = { roster: IDS_A.map((identityId) => ({ identityId, egoIds: [] })), field: IDS_A };

const data = DB.skip === false ? await loadEngineData(prisma) : null;

test('덱 A — 10916 은 호흡 인격이 아니다 (패시브 1091603 이 제한한다)', DB, () => {
	const p = new Profile(DECK_A, data!.capabilities);
	assert.equal(p.count('axis', 'BREATH', 'field'), 0);
	// 제한이 남긴 두 축은 그대로 있어야 한다
	assert.ok(p.count('axis', 'COMBUSTION', 'field') > 0);
	assert.ok(p.count('axis', 'VIBRATION', 'field') > 0);
});

test('덱 A — 축 공급 실측', DB, () => {
	const p = new Profile(DECK_A, data!.capabilities);
	// 이 PR 이 책임지는 것은 여기까지다 — 「이 편성이 어느 축의 인격을 몇 명 갖는가」
	// (실측, 2026-08-10 — scripts/check-axis-effect.ts 로 확인함)
	assert.equal(p.count('axis', 'COMBUSTION', 'field'), 6);
	assert.equal(p.count('axis', 'VIBRATION', 'field'), 6);
	assert.equal(p.count('axis', 'BULLET', 'field'), 2);
	assert.equal(p.count('axis', 'LACERATION', 'field'), 0);
});

test('덱 C — 착영휘도(20509)는 검계 우두머리 뫼르소(10508) 전용이다', DB, () => {
	// 2050911 은 「[검계 우두머리 뫼르소 전용 상시 효과]」라 못 박는다.
	// 출혈이 그 효과로 느는 축이다 — 호흡은 10508 의 keyword 에 이미 있다
	const squad = (identityId: string, egoIds: string[]): Squad =>
		({ roster: [{ identityId, egoIds }], field: [identityId] });
	const lac = (s: Squad): number =>
		new Profile(s, data!.capabilities).count('axis', 'LACERATION', 'field');

	assert.equal(lac(squad('10508', [])), 0, '안 끼면 안 생긴다');
	assert.equal(lac(squad('10508', ['20509'])), 1, '끼면 생긴다');
	// 같은 수감자의 다른 인격은 같은 E.G.O 를 껴도 안 생긴다 — 전용이다
	assert.equal(lac(squad('10512', ['20509'])), 0, '10512 는 대상이 아니다');
});
