/**
 * 절 모형 골든 — 사양 §7 의 덱 C·D·E.
 *
 * **덱 C 여섯은 이 모형의 존재 이유다.** 게이트 PR(#33)이 결손으로 넘긴
 * 과대 판정이고, 절을 나누면 여섯이 동시에 풀린다. 하나라도 남으면 절
 * 분해가 틀린 것이다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { NO_DB, canonicalReachable } from '../../../src/v2/canonical/db-available.js';
import { loadEngineData } from './load.js';
import { evaluateGifts } from './evaluate.js';
import { Profile } from './profile.js';
import type { EngineData, Squad } from './types.js';

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };
const data = DB.skip === false ? await loadEngineData(prisma) : null;

const ROSTER = 12;
const FIELD = 7;

const squadOf = (roster: string[], field = FIELD): Squad => ({
	roster: roster.slice(0, ROSTER).map((identityId) => ({ identityId, egoIds: [] })),
	field: roster.slice(0, field),
});

const judge = (squad: Squad): Map<string, boolean> => {
	const d = data as EngineData;
	const m = new Map<string, boolean>();
	for (const v of evaluateGifts({
		squad, profile: new Profile(squad, d.capabilities),
		giftTriggers: d.giftTriggers, refsByTrigger: d.refsByTrigger, params: d.params,
		abilities: d.abilities, abilityConds: d.abilityConds, supply: d.supply,
	})) m.set(v.giftId, v.fireable);
	return m;
};

/** 소속이 붙은 인격 전부. 편성을 어디서 뽑든 이 못에서 뽑는다 */
const poolAll = (): string[] => {
	const d = data as EngineData;
	return [...new Set([...d.supply.association.values()].flatMap((s) => [...s]))].sort();
};

/**
 * 덱 C — 그 소속·키워드를 **하나도 안 넣은** 편성.
 *
 * 12인을 어떻게 고르느냐로 결과가 흔들리면 안 되므로, 문제의 소속·키워드를
 * 가진 인격을 전부 뺀 나머지에서 앞 12인을 뽑는다.
 */
test('덱 C — 게이트 PR 이 결손으로 넘긴 여섯이 죽는다', DB, () => {
	const d = data as EngineData;
	const excluded = new Set<string>();
	for (const a of ['RING_FINGER', 'LIMBUS_COMPANY', 'LIMBUS_COMPANY_LCE', 'BLACK_BEAST_RABBIT']) {
		for (const id of d.supply.association.get(a) ?? []) excluded.add(id);
	}
	for (const id of d.supply.unitKeyword.get('BLOODFIEND') ?? []) excluded.add(id);
	const pool = poolAll().filter((id) => !excluded.has(id));
	assert.ok(pool.length >= ROSTER, '제외하고도 12인이 남아야 시험이 성립한다');

	const m = judge(squadOf(pool));
	const dead = ['9246', '9778', '9271', '9843', '9262', '9268']
		.filter((id) => m.get(id) === true);
	assert.deepEqual(dead, [], `그 소속이 없으면 죽어야 하는데 살아 있다: ${dead.join(' ')}`);
});

/**
 * 덱 D — 분모가 갈리는지.
 *
 * 피쿼드호 3인을 **대기에만** 넣는다. 「대기 인원 포함」인 9212 는 켜지고
 * 「대기 인원 제외」면 죽어야 한다 — 분모를 안 가르면 둘이 같은 답을 낸다.
 */
test('덱 D — 대기에만 넣은 소속이 「대기 인원 포함」 기프트를 켠다', DB, () => {
	const d = data as EngineData;
	const pequod = [...(d.supply.association.get('PEQUOD_CREW') ?? [])].sort();
	assert.ok(pequod.length >= 3, '피쿼드호가 3인 이상이어야 시험이 성립한다');
	const others = poolAll().filter((id) => !pequod.includes(id));
	// 앞 7인이 출격, 뒤가 대기. 피쿼드호를 대기 자리에 둔다
	const roster = [...others.slice(0, FIELD), ...pequod.slice(0, 3), ...others.slice(FIELD)]
		.slice(0, ROSTER);
	const squad = squadOf(roster);
	assert.equal(squad.field.some((id) => pequod.includes(id)), false,
		'피쿼드호가 출격에 섞이면 이 시험은 분모를 못 가른다');

	assert.equal(judge(squad).get('9212'), true,
		'모든 악의 끝은 「대기 인원 포함」이라 대기에만 있어도 켜져야 한다');
});

/** 덱 E — 출격 인원이 자리 번호를 정한다 */
test('덱 E — 7인 출격이면 7번 자리가 있고 5인이면 없다', DB, () => {
	const pool = poolAll();
	assert.equal(judge(squadOf(pool, 7)).get('9759'), true, '7인 출격이면 불 꺼진 랜턴이 켜진다');
	assert.equal(judge(squadOf(pool, 5)).get('9759'), false, '5인 출격이면 7번 자리가 없어 죽는다');
});

/**
 * **거짓 죽음이 없다.** 어느 편성에서도 못 켜지는 기프트가 있으면 사용자는
 * 그 존재를 아예 모르게 된다 — 과대 판정보다 나쁘다.
 */
test('전 덱에서 죽는 기프트가 없다', DB, () => {
	const d = data as EngineData;
	const alive = new Set<string>();
	/**
	 * **크기로 씨앗을 거르지 않는다.** 3인짜리 소속도 그 소속 기프트를 켜는
	 * 유일한 덱이다 — 걸렀더니 충전 기프트 여섯이 「어느 편성에서도 안 켜진다」로
	 * 잘못 잡혔다(실제로는 163덱 중 11덱에서 산다).
	 *
	 * **`axisSkill` 로도 씨앗을 짠다.** 9100 제 1종 영구기관은 「충전을 획득하는
	 * 공격 스킬을 보유한 인격 5인」이라 `supply='skill'` 이다 — 축 태그로 짠 덱은
	 * 그 조건을 못 채운다. 태그와 스킬은 다른 못이다.
	 */
	const seeds: string[][] = [
		poolAll(),
		...[...d.supply.axisTag.values()].map((s) => [...s].sort()),
		...[...d.supply.axisSkill.values()].map((s) => [...s].sort()),
		...[...d.supply.association.values()].map((s) => [...s].sort()),
		...[...d.supply.unitKeyword.values()].map((s) => [...s].sort()),
	];
	for (const seed of seeds) {
		const rest = poolAll().filter((id) => !seed.includes(id));
		for (const [id, ok] of judge(squadOf([...seed, ...rest]))) if (ok) alive.add(id);
	}
	const never = [...d.abilities.keys()].filter((id) => !alive.has(id)).sort();
	assert.deepEqual(never, [], `어느 편성에서도 안 켜진다: ${never.join(' ')}`);
});
