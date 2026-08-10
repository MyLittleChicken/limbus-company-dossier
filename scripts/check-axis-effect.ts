/**
 * 이 PR 이 판정을 어떻게 바꿨나 — 조사만 한다.
 *
 * 축 공급 층만 고쳤다. 기프트 조건을 AND 로 읽는 결함은 다음 PR 몫이므로
 * 여기서 「발동 가능」이 늘 것을 기대하지 않는다. 보려는 것은 **공급이
 * 옳아졌는가** 하나다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

const squadOf = (ids: string[]): Squad =>
	({ roster: ids.map((identityId) => ({ identityId, egoIds: [] })), field: ids });

const DECK_A = squadOf(['10216', '11216', '11009', '10916', '10716', '10512']);

console.log('=== 덱 A (화상·진동) 의 축 공급 ===');
const pA = new Profile(DECK_A, data.capabilities);
for (const axis of ['COMBUSTION', 'VIBRATION', 'BREATH', 'BULLET', 'LACERATION']) {
	console.log(`  ${axis.padEnd(11)} ${pA.count('axis', axis, 'field')}`);
}

console.log('\n=== 사용자가 짚은 세 건 ===');
const verdicts = evaluateGifts({
	squad: DECK_A, profile: pA,
	giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
});
const byId = new Map(verdicts.map((v) => [v.giftId, v]));
for (const [id, name] of [['9052', '휴대용 전지 소켓'], ['9043', '사원증'], ['9073', '엔도르핀 키트']] as const) {
	const v = byId.get(id);
	console.log(`  ${id} ${name.padEnd(12)} ${v?.fireable ? '유효' : '발동 불가'}`);
	for (const r of v?.reasons ?? []) {
		console.log(`        ${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict}`);
	}
}

console.log('\n=== 10104 동백 — 진동 인격이 아니다 ===');
const p104 = new Profile(squadOf(['10104']), data.capabilities);
console.log(`  SINKING   ${p104.count('axis', 'SINKING', 'field')}`);
console.log(`  VIBRATION ${p104.count('axis', 'VIBRATION', 'field')}   (0 이어야 한다)`);

console.log('\n=== 10508 검계 우두머리 — 착영휘도 전용 ===');
for (const [label, sq] of [
	['안 낌      ', { roster: [{ identityId: '10508', egoIds: [] }], field: ['10508'] }],
	['20509 낌   ', { roster: [{ identityId: '10508', egoIds: ['20509'] }], field: ['10508'] }],
	['10512 가 낌', { roster: [{ identityId: '10512', egoIds: ['20509'] }], field: ['10512'] }],
] as Array<[string, Squad]>) {
	const p = new Profile(sq, data.capabilities);
	console.log(`  ${label}  LACERATION ${p.count('axis', 'LACERATION', 'field')}`);
}

await prisma.$disconnect();
process.exit(0);
