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

/**
 * 축 부여·제한 — 출처 9건 · 17행.
 *
 * 「취급」 문형을 ko 전수로 뽑아(패시브 703 · 에고 패시브 113 · 기프트 793 ·
 * 에고 스킬 611 → 31행) 축에 해당하는 것만 남겼다. 소속을 바꾸는 9280·9841 과
 * 스킬 분류를 바꾸는 1021504·1061404 는 축이 아니라 다른 차원이라 뺐다.
 *
 * 10814·11115 는 태그 부분을 `identity_keyword` 가 이미 담고 있어(둘 다
 * Combustion·Laceration) 스킬 취급만 적는다.
 */
const AXIS_GRANT = [
	// ── 제한 4건 · 7행 ──────────────────────────────────────────
	{
		id: '1091603:COMBUSTION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
		targetKind: 'self', targetId: '10916', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '보냐텔리 가문의 수치 — 「이 인격은 화상, 진동을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1091603:VIBRATION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
		targetKind: 'self', targetId: '10916', axisId: 'VIBRATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '보냐텔리 가문의 수치 — 「이 인격은 화상, 진동을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1041502:BREATH', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'BREATH', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1041502:COMBUSTION', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1041502:LACERATION', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1010902:LACERATION', sourceKind: 'passive', sourceId: '1010902', mode: 'restrict',
		targetKind: 'self', targetId: '10109', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 출혈을 부여하는 인격으로만 취급됨. 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 해당 키워드를 부여하는 스킬로 취급되지 않음.」',
	},
	{
		id: '1110902:LACERATION', sourceKind: 'passive', sourceId: '1110902', mode: 'restrict',
		targetKind: 'self', targetId: '11109', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 출혈을 부여하는 인격으로만 취급됨. 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 해당 키워드를 부여하는 스킬로 취급되지 않음.」',
	},

	// ── E.G.O 장착 부여 2건 · 4행 ────────────────────────────────
	// **인격 전용이다.** 원문이 「…전용 상시 효과」라 못 박는다. 폐기하는
	// app.ego_granted_axis 는 이것을 그 E.G.O 수감자의 인격 전부로 폈고
	// (20109 → 이상 16인격 · 20509 → 뫼르소 15인격 = 62행) 그중 58행이 과대였다.
	// 대상(targetId)과 조건(gateKind)이 서로 다른 칸이라 둘 다 정확히 적힌다
	{
		id: '2010911:SINKING', sourceKind: 'ego_passive', sourceId: '2010911', mode: 'add',
		targetKind: 'self', targetId: '10110', axisId: 'SINKING', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20109', gateMin: null,
		note: '엄숙한 애도 — 「[로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과] … 이 인격은 진동, 침잠을 부여하는 인격으로 취급됨」. 10110 은 keyword 가 Sinking 뿐이라 이 효과로 진동이 는다',
	},
	{
		id: '2010911:VIBRATION', sourceKind: 'ego_passive', sourceId: '2010911', mode: 'add',
		targetKind: 'self', targetId: '10110', axisId: 'VIBRATION', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20109', gateMin: null,
		note: '엄숙한 애도 — 「[로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과] … 이 인격은 진동, 침잠을 부여하는 인격으로 취급됨」',
	},
	{
		id: '2050911:BREATH', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
		targetKind: 'self', targetId: '10508', axisId: 'BREATH', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20509', gateMin: null,
		note: '착영휘도 — 「[검계 우두머리 뫼르소 전용 상시 효과] … 이 인격은 출혈, 호흡을 부여하는 인격으로 취급됨」. 10508 은 keyword 에 Breath 가 이미 있다',
	},
	{
		id: '2050911:LACERATION', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
		targetKind: 'self', targetId: '10508', axisId: 'LACERATION', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20509', gateMin: null,
		note: '착영휘도 — 「[검계 우두머리 뫼르소 전용 상시 효과] … 이 인격은 출혈, 호흡을 부여하는 인격으로 취급됨」. 10508 은 keyword 가 Breath 뿐이라 이 효과로 출혈이 는다',
	},

	// ── 상태 조건 부여 2건 · 4행 · 스킬 취급만 ───────────────────
	// 태그(「이 인격은 화상, 출혈을 부여하는 인격으로 취급됨」)는 조건이 없고
	// identity_keyword 가 이미 담았다(10814·11115 둘 다 Combustion·Laceration).
	{
		id: '1081402:COMBUSTION', sourceKind: 'passive', sourceId: '1081402', mode: 'add',
		targetKind: 'self', targetId: '10814', axisId: 'COMBUSTION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null,
		note: '「열선 효과를 보유하고 있을 시, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},
	{
		id: '1081402:LACERATION', sourceKind: 'passive', sourceId: '1081402', mode: 'add',
		targetKind: 'self', targetId: '10814', axisId: 'LACERATION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null,
		note: '「열선 효과를 보유하고 있을 시, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},
	{
		id: '1111502:COMBUSTION', sourceKind: 'passive', sourceId: '1111502', mode: 'add',
		targetKind: 'self', targetId: '11115', axisId: 'COMBUSTION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'SwordUnseal', gateMin: null,
		note: '「자신의 검이 1단계 봉인 해제, 2단계 봉인 해제 상태면, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},
	{
		id: '1111502:LACERATION', sourceKind: 'passive', sourceId: '1111502', mode: 'add',
		targetKind: 'self', targetId: '11115', axisId: 'LACERATION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'SwordUnseal', gateMin: null,
		note: '「자신의 검이 1단계 봉인 해제, 2단계 봉인 해제 상태면, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},

	// ── 기프트 부여 1건 · 2행 · 소속 단위 ────────────────────────
	{
		id: '9282:COMBUSTION', sourceKind: 'gift', sourceId: '9282', mode: 'add',
		targetKind: 'association', targetId: 'DAWN', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3,
		note: '날개 모양 양초 — 「새벽 사무소 소속 인격을 화상, 진동을 부여하는 인격으로 취급됨」. 발동 조건은 「새벽 사무소 소속 인격이 3인 이상일 때 (편성 인원을 기준으로 함)」',
	},
	{
		id: '9282:VIBRATION', sourceKind: 'gift', sourceId: '9282', mode: 'add',
		targetKind: 'association', targetId: 'DAWN', axisId: 'VIBRATION', affects: 'both',
		gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3,
		note: '날개 모양 양초 — 「새벽 사무소 소속 인격을 화상, 진동을 부여하는 인격으로 취급됨」. 발동 조건은 「새벽 사무소 소속 인격이 3인 이상일 때 (편성 인원을 기준으로 함)」',
	},
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

		const c = await prisma.axisGrant.createMany({ data: AXIS_GRANT, skipDuplicates: true });
		const totalC = await prisma.axisGrant.count();
		console.log(`axis_grant        새로 ${c.count}행 · 합계 ${totalC}`);
		if (totalC !== AXIS_GRANT.length) {
			console.error(`axis_grant 합계가 ${AXIS_GRANT.length} 이 아니다`);
			process.exitCode = 1;
		}
	} finally {
		await prisma.$disconnect();
	}
}

await main();
