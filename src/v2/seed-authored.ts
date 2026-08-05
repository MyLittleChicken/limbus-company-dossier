/**
 * 저작 사실 초기 심기.
 *
 * **이미 있는 행은 안 덮는다.** DB 가 정본이고 이 파일은 빈 DB 를 채우는
 * 용도다. 값을 고치려면 DB 에서 고친다 — 그러면 `build_info` 의
 * `authored_digest` 가 달라지고, `v2:verify:rebuild` 가 「저작이 바뀌었다」로
 * 보고한다(ADR-08).
 *
 * 실행: npm run v2:seed:authored
 */
import { PrismaClient } from './generated/client.js';

const REF_EXCEPTION = [
	{
		kind: 'trigger', key: 'Bloodfiend Identities',
		refKind: 'unit_keyword', refId: 'BLOODFIEND',
		note: 'Bloodfiend 는 소속이 아니라 유닛 키워드다. 이름 매칭으로 풀면 association 으로 잘못 붙는다',
	},
	{
		kind: 'trigger', key: 'Yurodivy Identities',
		refKind: 'association', refId: 'YURODIVY',
		note: '소속은 YURODIVY 인데 표시명이 Yurodiviye 라 이름 매칭이 안 붙는다',
	},
	{
		kind: 'token', key: 'BLOODDINNER',
		refKind: 'unit_keyword', refId: 'BLOODFIEND',
		note: '9795 떨어진 한 방울. BloodDinner 는 status_category 에 없어 축으로 못 닿지만 그 기프트의 Bloodfiend Identities 트리거가 정확히 그 조건이다',
	},
];

const EGO_GRANTED_AXIS = [
	{ egoId: '20509', axisId: 'LACERATION', note: '착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20509', axisId: 'BREATH', note: '착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20109', axisId: 'VIBRATION', note: '엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20109', axisId: 'SINKING', note: '엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」' },
];

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		const a = await prisma.refException.createMany({ data: REF_EXCEPTION, skipDuplicates: true });
		const b = await prisma.egoGrantedAxis.createMany({ data: EGO_GRANTED_AXIS, skipDuplicates: true });
		const totalA = await prisma.refException.count();
		const totalB = await prisma.egoGrantedAxis.count();
		console.log(`ref_exception     새로 ${a.count}행 · 합계 ${totalA}`);
		console.log(`ego_granted_axis  새로 ${b.count}행 · 합계 ${totalB}`);
		if (totalA !== REF_EXCEPTION.length || totalB !== EGO_GRANTED_AXIS.length) {
			console.error(`기대와 다르다 — ref_exception ${REF_EXCEPTION.length} · ego_granted_axis ${EGO_GRANTED_AXIS.length} 여야 한다`);
			process.exitCode = 1;
		}
	} finally {
		await prisma.$disconnect();
	}
}

await main();
