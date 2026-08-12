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
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from './generated/client.js';
import { validatePayload, type AbilityPayload } from './ability-payload.js';

/**
 * 기프트 능력 저작을 읽는다 — `src/v2/authored/gift-ability.jsonl`.
 *
 * 다른 저작은 이 파일에 배열로 적혀 있지만 이것만 별도 파일이다. 456건이라
 * 소스에 두면 읽을 수 없고, 검수 회차마다 커밋되므로 한 줄이 능력 하나여야
 * diff 가 깨끗하다.
 *
 * **형식이 틀어지면 한 행도 안 심는다.** 사람이 손으로 고치는 파일이라
 * 오타가 DB 로 들어가면 굽는 쪽에서 뒤늦게 터진다.
 */
interface GiftAbilitySeed {
	giftId: string;
	level: number;
	ordinal: number;
	payload: AbilityPayload;
	note: string;
}

async function readGiftAbilitySeed(): Promise<GiftAbilitySeed[]> {
	const path = fileURLToPath(new URL('./authored/gift-ability.jsonl', import.meta.url));
	const raw = await readFile(path, 'utf8');
	const problems: string[] = [];
	const rows: GiftAbilitySeed[] = [];
	for (const [i, line] of raw.split('\n').map((l) => l.trim()).filter((l) => l !== '').entries()) {
		let parsed: GiftAbilitySeed;
		try {
			parsed = JSON.parse(line) as GiftAbilitySeed;
		} catch (e) {
			problems.push(`${i + 1}줄: JSON 이 아니다 — ${(e as Error).message}`);
			continue;
		}
		for (const p of validatePayload(parsed.payload)) {
			problems.push(`${i + 1}줄 (${parsed.giftId}/${parsed.level}/${parsed.ordinal}): ${p}`);
		}
		rows.push(parsed);
	}
	if (problems.length > 0) {
		throw new Error(
			`src/v2/authored/gift-ability.jsonl 의 형식이 틀렸다. 심지 않는다:\n  ${problems.join('\n  ')}`,
		);
	}
	return rows;
}

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

// **폐기됨 (2026-08-10)** — `app.axis_grant` 가 대신한다. 대상과 조건을 구별하지
// 못해 E.G.O 수감자의 인격 전부로 펴졌다(62행 중 58행 과대, 스키마 주석 참고).
// 행은 지우지 않는다 — 출처가 말한 사실이다. 빌더만 이 표를 다시 읽지 않는다.
const EGO_GRANTED_AXIS = [
	{ egoId: '20509', axisId: 'LACERATION', note: '착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20509', axisId: 'BREATH', note: '착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20109', axisId: 'VIBRATION', note: '엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20109', axisId: 'SINKING', note: '엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」' },
];

/**
 * 축 부여·제한 — 출처 10건 · 18행.
 *
 * 「취급」 문형을 ko 전수로 뽑아(패시브 703 · 에고 패시브 113 · 기프트 793 ·
 * 에고 스킬 611 → 31행) 축에 해당하는 것만 남겼다. 소속을 바꾸는 9280·9841 과
 * 스킬 분류를 바꾸는 1021504·1061404 는 축이 아니라 다른 차원이라 뺐다.
 *
 * 10814·11115 는 태그 부분을 `identity_keyword` 가 이미 담고 있어(둘 다
 * Combustion·Laceration) 스킬 취급만 적는다.
 *
 * 10104 한 행은 `sourceKind='system'` 이다 — 게임 텍스트가 아니라 유저 관측이
 * 근거다(2026-08-10, 사용자 확정). 나머지 아홉은 전부 게임 텍스트(패시브·에고
 * 패시브·기프트)가 근거라 `sourceKind` 가 그 종류를 그대로 딴다.
 */
const AXIS_GRANT = [
	// ── 제한 5건 · 8행 ──────────────────────────────────────────
	{
		id: '1091603:COMBUSTION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
		targetKind: 'self', targetId: '10916', axisId: 'COMBUSTION', affects: 'tag',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '보냐텔리 가문의 수치 — 「이 인격은 화상, 진동을 부여하는 인격으로만 취급됨」. ' +
			'스킬 취급을 부정하는 문장이 없다 — tag 만 제한한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1091603:VIBRATION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
		targetKind: 'self', targetId: '10916', axisId: 'VIBRATION', affects: 'tag',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '보냐텔리 가문의 수치 — 「이 인격은 화상, 진동을 부여하는 인격으로만 취급됨」. ' +
			'스킬 취급을 부정하는 문장이 없다 — tag 만 제한한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1041502:BREATH', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'BREATH', affects: 'tag',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」. ' +
			'스킬 취급을 부정하는 문장이 없다 — tag 만 제한한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1041502:COMBUSTION', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'COMBUSTION', affects: 'tag',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」. ' +
			'스킬 취급을 부정하는 문장이 없다 — tag 만 제한한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1041502:LACERATION', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'LACERATION', affects: 'tag',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」. ' +
			'스킬 취급을 부정하는 문장이 없다 — tag 만 제한한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1010902:LACERATION', sourceKind: 'passive', sourceId: '1010902', mode: 'restrict',
		targetKind: 'self', targetId: '10109', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 출혈을 부여하는 인격으로만 취급됨. 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 해당 키워드를 부여하는 스킬로 취급되지 않음.」' +
			' 스킬 취급까지 명시적으로 부정한다 — both 다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1110902:LACERATION', sourceKind: 'passive', sourceId: '1110902', mode: 'restrict',
		targetKind: 'self', targetId: '11109', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 출혈을 부여하는 인격으로만 취급됨. 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 해당 키워드를 부여하는 스킬로 취급되지 않음.」' +
			' 스킬 취급까지 명시적으로 부정한다 — both 다(2026-08-10, 사용자 확정)',
	},
	{
		id: '10104:SINKING', sourceKind: 'system', sourceId: '10104', mode: 'restrict',
		targetKind: 'self', targetId: '10104', axisId: 'SINKING', affects: 'tag',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '개화 E.G.O::동백 이상 — 진동을 부여하는 인격으로 취급되지 않는다. 게임 텍스트에 근거가 없는 미문서화 예외이고 유저 관측으로 알려졌다(패시브는 「만개」·「알싸한 봄바람」뿐). 태그에서만 빼고 스킬 채널은 남긴다 — 「진동 인격 5인 이상」에는 안 들지만 「진동을 부여하는 스킬 사용시」 효과는 받는다',
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

	// ── 스킬 취급 부여 2건 · 4행 · status_held 게이트(2026-08-10, 되살림) ────
	// 태그(「이 인격은 화상, 출혈을 부여하는 인격으로 취급됨」)는 조건이 없고
	// identity_keyword 가 이미 담았다(10814·11115 둘 다 Combustion·Laceration).
	//
	// status_held 게이트를 한 번 뗐다가(ea436ea) 되살렸다(사용자 확정) — 결론은
	// 같지만 사실이 있어야 할 자리가 다르다. 「열선 보유 시 …로 취급됨」은 게임이
	// 말한 메카니즘이고, 인격 정보 화면이 그 메카니즘을 원문 그대로 보여줘야
	// 한다. 게이트를 코드/note 문자열로만 남기면 정보 화면이 그걸 다시 파싱해야
	// 한다 — 메카니즘은 데이터에 두고, 「전투 중 상태라 거울 던전 추적 범위 밖」
	// 이라는 판단은 엔진(`lib/engine/v2/profile.ts` 의 `status_held` 게이트 평가)
	// 이 진다. 추천 근거는 그 판단을 적용한 뒤의 결론(「화상·출혈 부여 스킬 보유」)
	// 으로 말한다.
	{
		id: '1081402:COMBUSTION', sourceKind: 'passive', sourceId: '1081402', mode: 'add',
		targetKind: 'self', targetId: '10814', axisId: 'COMBUSTION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null,
		note: '「열선 효과를 보유하고 있을 시, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」' +
			' 인격 정보 화면은 이 원문 그대로 보여준다 — 전투 중 상태라 거울 던전 추적 범위 밖이라는 판단은 엔진이 한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1081402:LACERATION', sourceKind: 'passive', sourceId: '1081402', mode: 'add',
		targetKind: 'self', targetId: '10814', axisId: 'LACERATION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null,
		note: '「열선 효과를 보유하고 있을 시, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」' +
			' 인격 정보 화면은 이 원문 그대로 보여준다 — 전투 중 상태라 거울 던전 추적 범위 밖이라는 판단은 엔진이 한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1111502:COMBUSTION', sourceKind: 'passive', sourceId: '1111502', mode: 'add',
		targetKind: 'self', targetId: '11115', axisId: 'COMBUSTION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'SwordUnseal', gateMin: null,
		note: '「자신의 검이 1단계 봉인 해제, 2단계 봉인 해제 상태면, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」' +
			' 인격 정보 화면은 이 원문 그대로 보여준다 — 전투 중 상태라 거울 던전 추적 범위 밖이라는 판단은 엔진이 한다(2026-08-10, 사용자 확정)',
	},
	{
		id: '1111502:LACERATION', sourceKind: 'passive', sourceId: '1111502', mode: 'add',
		targetKind: 'self', targetId: '11115', axisId: 'LACERATION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'SwordUnseal', gateMin: null,
		note: '「자신의 검이 1단계 봉인 해제, 2단계 봉인 해제 상태면, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」' +
			' 인격 정보 화면은 이 원문 그대로 보여준다 — 전투 중 상태라 거울 던전 추적 범위 밖이라는 판단은 엔진이 한다(2026-08-10, 사용자 확정)',
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

		// 기프트 능력은 파일에서 읽는다. 형식이 틀리면 위에서 이미 던졌다
		const abilities = await readGiftAbilitySeed();
		// 파일에는 origin(hand·auto) 같은 검수용 칸이 더 있다. **표에 있는 칸만
		// 골라 넣는다** — 파일이 표보다 넓어도 심기가 막히면 안 된다
		/**
		 * **파일이 진실이다 — 통째로 갈아 끼운다.**
		 *
		 * 예전에는 `skipDuplicates` 로 더하기만 했다. 그러면 (gift,level,ordinal)
		 * 이 이미 있는 행은 파일이 바뀌어도 영영 안 바뀐다 — 추출기를 고쳐도
		 * DB 는 낡은 채로 남는다. 실제로 그렇게 굳어 있었다: 9194 의 0절이
		 * 조건을 잃었는데도 DB 에는 옛 조건이 그대로 있었다.
		 *
		 * 저작 파일은 git 이 들고 있으므로 지우고 다시 넣어도 잃는 것이 없다.
		 */
		await prisma.giftAbilityAuthored.deleteMany({});
		const d = await prisma.giftAbilityAuthored.createMany({
			data: abilities.map((a) => ({
				giftId: a.giftId, level: a.level, ordinal: a.ordinal,
				payload: a.payload as never, note: a.note,
			})),
		});
		const totalD = await prisma.giftAbilityAuthored.count();
		console.log(`gift_ability_authored  갈아끼움 ${d.count}행 · 합계 ${totalD} (파일 ${abilities.length})`);
	} finally {
		await prisma.$disconnect();
	}
}

await main();
