/**
 * 절 규칙 — **DB 없이 돈다.**
 *
 * ordinal 간 OR · group 간 AND · group 내 OR. 「모른다」는 배제하지 않는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeGift, type Ability, type AbilityCond } from './ability.js';
import type { SupplyTables } from './supply.js';
import type { Squad } from './types.js';

const IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SQUAD: Squad = {
	roster: IDS.map((identityId) => ({ identityId, egoIds: [] })),
	field: IDS.slice(0, 7),
};
const T: SupplyTables = {
	axisTag: new Map([['COMBUSTION', new Set(['A', 'B'])]]),
	axisSkill: new Map([['COMBUSTION', new Set(['A'])]]),
	association: new Map([['DAWN', new Set(['A', 'B', 'C'])], ['SHI', new Set<string>()]]),
	unitKeyword: new Map(),
	sin: new Map([['wrath', new Set(['A', 'B', 'C', 'D'])]]),
	attackType: new Map(),
	skillKind: new Map(),
	minusCoin: new Set(),
};

const ab = (o: Partial<Ability> = {}): Ability =>
	({ giftId: 'G', level: 0, ordinal: 0, unconditional: false, refines: null, ...o });
const cd = (o: Partial<AbilityCond> = {}): AbilityCond => ({
	giftId: 'G', level: 0, ordinal: 0, group: 0, idx: 0,
	refKind: 'association', refId: 'DAWN', op: 'has', threshold: null,
	scope: 'field', supply: 'tag', slot: null, runtime: false, resonanceMode: null, ...o,
});
const run = (abilities: Ability[], conds: AbilityCond[]) => {
	const byAb = new Map<string, AbilityCond[]>();
	for (const c of conds) {
		const k = String(c.ordinal);
		byAb.set(k, [...(byAb.get(k) ?? []), c]);
	}
	return judgeGift({ tables: T, squad: SQUAD, abilities, condsByAbility: byAb });
};

test('무조건 절은 언제나 켜진다', () => {
	assert.equal(run([ab({ unconditional: true })], []).fireable, true);
});

test('조건이 서면 켜진다', () => {
	assert.equal(run([ab()], [cd()]).fireable, true);
});

test('조건이 안 서면 죽는다', () => {
	assert.equal(run([ab()], [cd({ refId: 'SHI' })]).fireable, false);
});

test('독립 절이 여럿이면 하나만 서도 켜진다 — OR', () => {
	const abilities = [ab({ ordinal: 0 }), ab({ ordinal: 1 })];
	const conds = [cd({ ordinal: 0, refId: 'SHI' }), cd({ ordinal: 1, refId: 'DAWN' })];
	assert.equal(run(abilities, conds).fireable, true);
});

test('독립 절이 전부 안 서면 죽는다', () => {
	const abilities = [ab({ ordinal: 0 }), ab({ ordinal: 1 })];
	const conds = [cd({ ordinal: 0, refId: 'SHI' }), cd({ ordinal: 1, refId: 'SHI' })];
	assert.equal(run(abilities, conds).fireable, false);
});

test('같은 group 안은 OR — 하나만 서면 된다', () => {
	const conds = [
		cd({ group: 0, idx: 0, refId: 'SHI' }),
		cd({ group: 0, idx: 1, refId: 'DAWN' }),
	];
	assert.equal(run([ab()], conds).fireable, true);
});

test('group 끼리는 AND — 하나라도 안 서면 죽는다', () => {
	const conds = [
		cd({ group: 0, idx: 0, refId: 'DAWN' }),
		cd({ group: 1, idx: 0, refId: 'SHI' }),
	];
	assert.equal(run([ab()], conds).fireable, false);
});

test('강화판은 켜짐 판정에 참여하지 않는다', () => {
	// ordinal 1 은 ordinal 0 의 강화판이다. 0 이 죽으면 1 도 같이 죽는다 —
	// 1 이 혼자 서서 기프트를 살리면 안 된다
	const abilities = [ab({ ordinal: 0 }), ab({ ordinal: 1, refines: 0 })];
	const conds = [cd({ ordinal: 0, refId: 'SHI' }), cd({ ordinal: 1, refId: 'DAWN' })];
	assert.equal(run(abilities, conds).fireable, false);
});

test('runtime 은 배제 근거가 아니다', () => {
	assert.equal(run([ab()], [cd({ refId: 'SHI', runtime: true })]).fireable, true);
});

test('op≠has 인데 threshold 가 null 이면 배제하지 않는다 — 모른다', () => {
	assert.equal(run([ab()], [cd({ refId: 'SHI', op: 'gte', threshold: null })]).fireable, true);
});

test('op=has 는 한 명이라도 있으면 선다', () => {
	assert.equal(run([ab()], [cd({ refKind: 'axis', refId: 'COMBUSTION' })]).fireable, true);
});

test('gte 는 문턱을 센다', () => {
	assert.equal(run([ab()], [cd({ op: 'gte', threshold: 3 })]).fireable, true);
	assert.equal(run([ab()], [cd({ op: 'gte', threshold: 4 })]).fireable, false);
});

test('셀 방법이 없는 조건은 배제하지 않는다', () => {
	assert.equal(run([ab()], [cd({ refKind: 'other', refId: '알 수 없는 조건' })]).fireable, true);
});

test('조건이 하나도 없는 절은 배제하지 않는다 — 결손이다', () => {
	// unconditional=false 인데 조건이 없다 = 「조건이 있는 줄은 아는데 못 뽑았다」
	assert.equal(run([ab()], []).fireable, true);
});

test('능력이 하나도 없으면 판정 보류다 — 죽이지 않는다', () => {
	assert.equal(run([], []).fireable, true);
});

test('근거를 조건마다 낸다 — 화면이 왜 그런지 보여야 한다', () => {
	const r = run([ab()], [cd({ op: 'gte', threshold: 3 }), cd({ group: 1, refId: 'SHI' })]);
	assert.equal(r.reasons.length, 2);
	assert.equal(r.reasons[0]?.verdict, 'satisfied');
	assert.equal(r.reasons[0]?.have, 3);
	assert.equal(r.reasons[0]?.need, 3);
	assert.equal(r.reasons[1]?.verdict, 'unsatisfied');
});

test('runtime 근거는 unknown 이다 — 충족으로 세면 점수가 부푼다', () => {
	const r = run([ab()], [cd({ refId: 'SHI', runtime: true })]);
	assert.equal(r.reasons[0]?.verdict, 'unknown');
});
