/**
 * 골든 — 적재된 `canonical` 로 실제 편성을 판정한다.
 *
 * 단위 테스트는 규칙이 규칙대로 도는지만 본다. 여기서는 **실제 데이터로 알려진
 * 답이 나오는지** 본다. 편성은 축 골든과 같은 화상·진동 덱이다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { NO_DB, canonicalReachable } from '../../../src/v2/canonical/db-available.js';
import { loadEngineData, type EngineData } from './load';
import { Profile } from './profile';
import { evaluateGifts } from './evaluate';
import { chain } from './chain';
import type { Squad } from './types';

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });

/** CI 는 DB 를 쓰지 않는다. 없으면 건너뛰되 건너뛴 사실은 보고에 남는다 */
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };

const SQUAD: Squad = {
	roster: ['10216', '11216', '11009', '10916', '10716', '10512']
		.map((identityId) => ({ identityId, egoIds: [] })),
	field: ['10216', '11216', '11009', '10916', '10716', '10512'],
};

// DB 가 없으면 적재 자체가 던진다. 빈 값으로 두고 아래 테스트를 전부 건너뛴다
const EMPTY: EngineData = {
	capabilities: [], refsByTrigger: new Map(), giftTriggers: new Map(),
	giftEffects: new Map(), effectRefs: new Map(), giftRefs: new Map(),
	params: [], recipes: [], abilities: new Map(), abilityConds: new Map(),
	supply: {
		axisTag: new Map(), axisSkill: new Map(), association: new Map(),
		unitKeyword: new Map(), sin: new Map(), attackType: new Map(),
		skillKind: new Map(), minusCoin: new Set(),
	},
};
const data = DB.skip === false ? await loadEngineData(prisma) : EMPTY;
const verdicts = evaluateGifts({
	squad: SQUAD,
	profile: new Profile(SQUAD, data.capabilities),
	giftTriggers: data.giftTriggers,
	refsByTrigger: data.refsByTrigger,
	params: data.params,
	abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
});
const byId = new Map(verdicts.map((v) => [v.giftId, v]));

test('진혼(9088) 이 켜진다 — 화상 6 ≥ 5, 출전 분모', DB, () => {
	const v = byId.get('9088');
	assert.equal(v?.grade, 'A');
	const r = v?.reasons.find((x) => x.refKind === 'axis' && x.refId === 'COMBUSTION');
	assert.equal(r?.have, 6);
	assert.equal(r?.need, 5);
	assert.equal(r?.denominator, 'field');
	assert.equal(r?.verdict, 'satisfied');
});

test('피안개(9090) 는 같은 편성에서 미달한다 — 출혈 0 < 5', DB, () => {
	const v = byId.get('9090');
	const r = v?.reasons.find((x) => x.refId === 'LACERATION');
	assert.equal(r?.have, 0);
	assert.equal(r?.need, 5);
	assert.equal(r?.verdict, 'unsatisfied');
});

test('등급 셋이 전부 나온다 — 결합을 접지 않은 결과', DB, () => {
	const n = { A: 0, B: 0, C: 0 };
	for (const v of verdicts) n[v.grade] += 1;
	assert.ok(n.A > 0 && n.B > 0 && n.C > 0, JSON.stringify(n));
	/**
	 * **절 모형에서는 A 가 가장 크다**(2026-08-12). 옛 모형은 B 가 가장 컸는데
	 * 그건 트리거 참조의 `evaluability` 가 `runtime`·`unclassified` 를 남발해
	 * 「일부만 판정 가능」이 기본값이 됐기 때문이다. 절 조건은 문장에서 뽑은
	 * 것이라 대부분 편성으로 바로 판정된다 — 그것이 이 단계가 얻은 것이다.
	 */
	assert.ok(n.A > n.B && n.A > n.C, JSON.stringify(n));
	// 절을 가진 기프트 전부를 돈다 — 트리거가 0개인 기프트도 판정 보류로 답한다
	assert.equal(n.A + n.B + n.C, verdicts.length);
});

test('판정 불가를 목록에서 빼지 않는다 — C 도 근거를 갖는다', DB, () => {
	const c = verdicts.filter((v) => v.grade === 'C');
	assert.ok(c.length > 0);
	assert.ok(c.every((v) => v.decidable === 0));
	// 「참조는 있는데 전부 런타임」인 기프트가 실재해야 한다
	assert.ok(c.some((v) => v.total > 0));
});

test('충족은 항상 판정 가능 범위 안이다', DB, () => {
	assert.ok(verdicts.every((v) => v.satisfied <= v.decidable && v.decidable <= v.total));
});

test('분모를 편성으로 바꾸면 답이 달라지는 기프트가 있다', DB, () => {
	// 대기 인원을 채운 12인 편성. 출전은 그대로 6인이다
	const wide: Squad = {
		roster: [...SQUAD.roster, ...['10208', '10501', '10109', '11001', '10601', '10801']
			.map((identityId) => ({ identityId, egoIds: [] }))],
		field: SQUAD.field,
	};
	const wideVerdicts = evaluateGifts({
		squad: wide,
		profile: new Profile(wide, data.capabilities),
		giftTriggers: data.giftTriggers,
		refsByTrigger: data.refsByTrigger,
		params: data.params,
		abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	});
	const wideById = new Map(wideVerdicts.map((v) => [v.giftId, v]));
	// 진혼은 출전 분모라 대기가 늘어도 그대로여야 한다 — 분모 분기가 실제로 산다
	const r = wideById.get('9088')?.reasons.find((x) => x.refId === 'COMBUSTION');
	assert.equal(r?.have, 6);
});

test('연쇄 — 보유 기프트가 아직 안 켜진 기프트를 켠다', DB, () => {
	// **9088 진혼으로는 안 된다.** 진혼이 거는 화상은 이 편성이 이미 갖고 있어
	// 사슬이 줄 것이 없다 — 설계가 「이미 충족된 참조는 뺀다」로 정한 자리다.
	// 9095 고장난 나침반은 이 화상 덱에 없는 침잠을 건다
	const links = chain({
		heldGiftIds: ['9095'],
		giftEffects: data.giftEffects,
		effectRefs: data.effectRefs,
		giftRefs: data.giftRefs,
		verdicts,
	});
	assert.ok(links.length > 0);
	assert.ok(links.every((l) => l.depth >= 1 && l.depth <= 2));
	assert.equal(links.some((l) => l.giftId === '9095'), false);
	// 침잠을 보는 기프트가 실제로 나와야 한다
	assert.ok(links.some((l) => l.via.some((v) => v.refId === 'SINKING')));
	// 근거가 비어 있으면 사슬을 낼 이유가 없다
	assert.ok(links.every((l) => l.via.length > 0));
});

test('이미 충족된 참조는 사슬이 되풀이하지 않는다 — 화상 덱에 화상 기프트', DB, () => {
	// 진혼이 거는 화상은 편성이 이미 갖고 있다. 사슬이 이것으로 늘면 중복이다
	const links = chain({
		heldGiftIds: ['9088'],
		giftEffects: data.giftEffects,
		effectRefs: data.effectRefs,
		giftRefs: data.giftRefs,
		verdicts,
	});
	assert.equal(links.some((l) => l.via.some((v) => v.refId === 'COMBUSTION')), false);
});

/**
 * 절 모형의 실측 등급. 옛 모형은 A 146 · B 219 · C 86 이었다.
 *
 * `C 192` 는 「셀 것이 없다」다 — 조건이 하나도 안 붙은 기프트이며, 그중
 * 대부분은 실제로 무조건 절을 갖는다(「매 턴 시작 시 모든 적에게 파열 3」처럼
 * 편성과 무관한 문단). 결손도 여기 섞여 있으므로 이 수는 「범용 기프트 수」의
 * 상한이지 확정치가 아니다.
 */
test('실측 등급 — A 246 · B 18 · C 192', DB, () => {
	const n = { A: 0, B: 0, C: 0 };
	for (const v of verdicts) n[v.grade] += 1;
	assert.deepEqual(n, { A: 246, B: 18, C: 192 });
});

/**
 * 절 모형에는 **「가능」이 없다** — 충족은 언제나 확정이다.
 *
 * 옛 모형은 89건 중 49건만 확정이었다. 그 「가능」은 트리거 이름 접미사
 * (`roster_gated`)로 지어낸 어림이었고, 절 조건은 문장에서 뽑은 것이라 그런
 * 어림이 없다. 전투 중에만 아는 것은 `runtime` 으로 따로 적혀 `unknown` 이
 * 되므로 애초에 「충족」으로 세지지 않는다.
 *
 * 아래 주석은 옛 모형의 89·49 가 어떻게 나온 값인지에 대한 기록이다.
 */
test('전부 충족 108 — 절 모형에는 「가능」이 없어 확정과 같다', DB, () => {
	// 자리 한정을 씌우기 전엔 95였다. 9143·9210 이 「편성 4·5번」 자리 조건과
	// 무기 갈래 조건(각각 pierce · blunt)을 갖는데, 이 골든 편성의 4·5번은
	// 10916 · 10716 이고 둘 다 그 무기 갈래가 없다(pierce 는 3번, blunt 는
	// 6번). 자리 한정 전에는 무기 갈래를 편성 전체로 세어 충족으로 잘못
	// 잡혔다 — 죽음바라기(9120, 슬롯은 {1,2}로 다르다)와 같은 결의 오판정이다
	//
	// 93·50 이었던 값이 89·49 로 줄었다. **채널(affects) 필터 탓이 아니다** — 모든
	// capability 를 `affects: 'both'` 로 강제해도, 모든 게이트를 열어도 여전히
	// 89·49 였다(재실측, 2026-08-10). 실제 원인은 `identity_axis` 의 `special_status`
	// 출처 행수가 300 → 13(BULLET 전용)으로 좁혀진 데이터 변화다 — 게임의 「…으로만
	// 취급됨」을 무너뜨리던 과대 special_status 축이 빠지면서 그 축에 기대던 몇 편성이
	// 「전부 충족」 문턱에서 떨어졌다.
	const fired = verdicts.filter((v) => v.grade === 'A' && v.satisfied === v.total);
	const sure = fired.filter((v) => v.certain === v.total);
	assert.equal(fired.length, 108);
	assert.equal(sure.length, 108);
});

test('10104(개화 E.G.O::동백 이상) 만 넣은 편성 — 침잠 인격이지 진동 인격이 아니다', DB, () => {
	// VIBRATION 은 이 인격에서 affects='skill' 이다(유저가 발견한 미문서화
	// 예외 — 「진동 인격 5인」조건에는 안 들지만 「진동 부여 스킬」조건은
	// 받는다). SINKING 은 affects='both' 라 인격 취급 그대로다
	const squad: Squad = { roster: [{ identityId: '10104', egoIds: [] }], field: ['10104'] };
	const profile = new Profile(squad, data.capabilities);
	assert.equal(profile.count('axis', 'SINKING', 'field'), 1);
	assert.equal(profile.count('axis', 'VIBRATION', 'field'), 0);
});
