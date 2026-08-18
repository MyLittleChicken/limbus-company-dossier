/**
 * 세 무더기 고르기 — 「확실히 좋다」·「확실히 아니다」는 방향을 고정하는
 * 용도이고, 「엇갈린다」열 장이 저울추를 정하는 표본의 전부다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickThirty } from './pick.js';
import type { Picked } from './pick.js';
import type { FusionRole } from './fusion.js';
import type { DeckSupply, GiftCard } from './types.js';

/**
 * COMBUSTION 이 강한 축(공급 6, 최대치), SINKING 은 곁다리(1/6 ≈ 0.167 —
 * 0 도 1 도 아니다), BURST 는 어휘 안인데 이 덱 공급이 0(정확히 fit 0).
 */
const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['SINKING', 1]]),
	attackType: new Map([['slash', 4], ['blunt', 4]]),
};

interface Built { pool: GiftCard[]; roles: Map<string, FusionRole> }

/**
 * 여섯 갈래(확실히 좋다 · 확실히 아니다 · 엇갈린다 네 갈래)를 각각 `counts`
 * 만큼 만든다. **여기에 상위 합성 결과물 `g_result` 를 하나 얹는다** — 등급·
 * 키워드·켜짐이 「확실히 좋다」감인데 `madeOnly` 라 집을 수 없다. 이게
 * 없으면 madeOnly 를 실제로 거르는지 검사할 수 없다.
 *
 * `branchC` 재료는 전부 이 `g_result` 로 가는 합성 재료로 등록한다.
 */
function buildPool(counts: {
	good: number; bad: number; a: number; b: number; c: number; d: number;
}): Built {
	const pool: GiftCard[] = [];
	const push = (
		prefix: string, n: number, tier: number | null, keywordId: string | null,
		exclusive: boolean, fireable: boolean,
	): void => {
		for (let i = 1; i <= n; i++) {
			pool.push({
				giftId: `${prefix}${String(i).padStart(3, '0')}`,
				name: `기프트 ${prefix}${i}`, desc: '설명',
				tier, keywordId, exclusive, fireable,
			});
		}
	};
	// 확실히 좋다: fit ≥ 0.5(COMBUSTION) · t ≥ 0.75(5등급) · 켜진다
	push('good', counts.good, 5, 'Combustion', false, true);
	// 확실히 아니다: fit = 0(BURST, 공급 0) · t ≤ 0.25(1등급)
	push('bad', counts.bad, 1, 'Burst', false, true);
	// 갈래 a — 고등급인데 축 불일치: t ≥ 0.75 · fit = 0
	push('branchA', counts.a, 5, 'Burst', false, true);
	// 갈래 b — 저등급인데 축 일치: t ≤ 0.25 · fit ≥ 0.5
	push('branchB', counts.b, 1, 'Combustion', false, true);
	// 갈래 c — 저등급인데 상위 재료다: t ≤ 0.25 · fit 은 곁다리(0도 1도 아님)
	//          라야 「확실히 아니다」(fit=0)·갈래 b(fit≥0.5)에 안 먹힌다
	push('branchC', counts.c, 1, 'Sinking', false, true);
	// 갈래 d — 전용인데 저등급: exclusive · t ≤ 0.25, 곁다리 fit이라 다른
	//          갈래에 안 먹힌다. 재료 등록도 안 한다(갈래 c 와 갈라야 한다)
	push('branchD', counts.d, 1, 'Sinking', true, true);

	pool.push({
		giftId: 'g_result', name: '기프트 결과', desc: '설명',
		tier: 5, keywordId: 'Combustion', exclusive: false, fireable: true,
	});
	const roles = new Map<string, FusionRole>();
	roles.set('g_result', { madeOnly: true, makes: [] });
	for (const c of pool) {
		if (!c.giftId.startsWith('branchC')) continue;
		roles.set(c.giftId, {
			madeOnly: false,
			makes: [{ result: 'g_result', withOthers: [], recipeCount: 1 }],
		});
	}
	return { pool, roles };
}

const NONE = new Set<string>();
const stratumOf = (picked: Picked[], s: Picked['stratum']): Picked[] =>
	picked.filter((p) => p.stratum === s);

test('무더기마다 열 장을 낸다 — 재료가 넉넉할 때', () => {
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const picked = pickThirty(pool, SUPPLY, roles, NONE);
	assert.equal(stratumOf(picked, '확실히 좋다').length, 10);
	assert.equal(stratumOf(picked, '확실히 아니다').length, 10);
	assert.equal(stratumOf(picked, '엇갈린다').length, 10);
	assert.equal(picked.length, 30);
});

test('한 무더기가 모자라면 있는 만큼만 낸다 — 다른 무더기로 안 메운다', () => {
	// 확실히 아니다는 세 장뿐이다. 서른을 채우려고 다른 무더기가 늘어나면 안 된다
	const { pool, roles } = buildPool({ good: 25, bad: 3, a: 25, b: 25, c: 25, d: 25 });
	const picked = pickThirty(pool, SUPPLY, roles, NONE);
	assert.equal(stratumOf(picked, '확실히 좋다').length, 10);
	assert.equal(stratumOf(picked, '확실히 아니다').length, 3);
	assert.equal(stratumOf(picked, '엇갈린다').length, 10);
	assert.equal(picked.length, 23, '다른 무더기로 메워 서른을 채우면 안 된다');
});

test('엇갈린다 네 갈래가 고르게 섞인다 — 한 갈래가 몰리지 않는다', () => {
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const tangled = stratumOf(pickThirty(pool, SUPPLY, roles, NONE), '엇갈린다');
	assert.equal(tangled.length, 10);
	const byPrefix = new Map<string, number>();
	for (const p of tangled) {
		const prefix = p.card.giftId.replace(/\d+$/, '');
		byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
	}
	// 네 갈래(branchA~D)가 다 나와야 하고, 한 갈래가 7장을 넘으면 안 된다
	assert.equal(byPrefix.size, 4, JSON.stringify([...byPrefix]));
	assert.ok(Math.max(...byPrefix.values()) <= 7, JSON.stringify([...byPrefix]));
});

test('한 갈래만 후하면 라운드 로빈이 나머지 셋으로 계속 돈다', () => {
	// branchA 만 100장 두고 나머지 갈래는 2장씩만 둔다. 라운드 로빈이 아니라
	// 「엇갈린다 후보를 그냥 앞에서 긁는」구현이면 branchA 가 열 장을 다 먹는다
	const { pool, roles } = buildPool({ good: 0, bad: 0, a: 100, b: 2, c: 2, d: 2 });
	const tangled = stratumOf(pickThirty(pool, SUPPLY, roles, NONE), '엇갈린다');
	const byPrefix = new Map<string, number>();
	for (const p of tangled) {
		const prefix = p.card.giftId.replace(/\d+$/, '');
		byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
	}
	assert.equal(byPrefix.get('branchA'), 4, JSON.stringify([...byPrefix]));
	assert.equal(byPrefix.get('branchB'), 2, JSON.stringify([...byPrefix]));
	assert.equal(byPrefix.get('branchC'), 2, JSON.stringify([...byPrefix]));
	assert.equal(byPrefix.get('branchD'), 2, JSON.stringify([...byPrefix]));
});

test('합성 결과물은 절대 안 들어간다 — madeOnly 는 확실히 좋다 모양이어도 뺀다', () => {
	// g_result 는 등급·키워드·켜짐이 「확실히 좋다」감이다. 아홉 장짜리 good 에
	// 얹혀 있으니, 안 걸러지면 열 장이 채워지고 걸러지면 아홉 장만 남는다
	const { pool, roles } = buildPool({ good: 9, bad: 0, a: 0, b: 0, c: 0, d: 0 });
	const picked = pickThirty(pool, SUPPLY, roles, NONE);
	assert.equal(stratumOf(picked, '확실히 좋다').length, 9);
	assert.ok(!picked.some((p) => p.card.giftId === 'g_result'), 'madeOnly 가 들어갔다');
});

test('avoid 를 피한다 — 넉넉하면 겹치지 않는다', () => {
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const first = pickThirty(pool, SUPPLY, roles, NONE);
	const avoid = new Set(first.map((p) => p.card.giftId));
	const second = pickThirty(pool, SUPPLY, roles, avoid);
	const overlap = second.filter((p) => avoid.has(p.card.giftId)).map((p) => p.card.giftId);
	assert.deepEqual(overlap, [], `겹친다: ${overlap.join(' ')}`);
	assert.equal(second.length, 30);
});

test('피할 것뿐이면 그냥 쓴다 — 자리를 비우느니 겹친다', () => {
	// 확실히 좋다감이 다섯 장뿐이고 전부 avoid 다 — 그래도 다섯 장을 내야 한다
	const { pool, roles } = buildPool({ good: 5, bad: 0, a: 0, b: 0, c: 0, d: 0 });
	const avoid = new Set(pool.filter((c) => c.giftId.startsWith('good')).map((c) => c.giftId));
	const picked = pickThirty(pool, SUPPLY, roles, avoid);
	assert.equal(stratumOf(picked, '확실히 좋다').length, 5, '피할 것뿐인데 비웠다');
});

test('엇갈린다도 avoid 없는 패스를 먼저 다 돈 뒤에 avoid 로 넘어간다', () => {
	// branchA 는 avoid 아닌 것 하나, avoid 인 것 여럿. 다른 세 갈래는 avoid 없이
	// 넉넉하다. avoid 아닌 branchA 카드 하나는 반드시 들어가야 한다
	const { pool, roles } = buildPool({ good: 0, bad: 0, a: 6, b: 6, c: 6, d: 6 });
	const branchAIds = pool.filter((c) => c.giftId.startsWith('branchA')).map((c) => c.giftId);
	const avoid = new Set(branchAIds.slice(1)); // 첫 장만 avoid 아니다
	const tangled = stratumOf(pickThirty(pool, SUPPLY, roles, avoid), '엇갈린다');
	assert.ok(tangled.some((p) => p.card.giftId === branchAIds[0]),
		'avoid 아닌 branchA 카드가 안 들어갔다');
});

test('같은 못이면 같은 답이 나온다 — 무작위가 아니다', () => {
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const a = pickThirty(pool, SUPPLY, roles, NONE).map((p) => `${p.card.giftId}:${p.stratum}`);
	const b = pickThirty(pool, SUPPLY, roles, NONE).map((p) => `${p.card.giftId}:${p.stratum}`);
	assert.deepEqual(a, b);
});

test('「앞에서 서른을 집는 것」과 다르다 — 검사에 이빨이 있는지 못 박는다', () => {
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const naive = [...pool]
		.filter((c) => c.giftId !== 'g_result') // madeOnly 는 애초에 집을 수 없다
		.sort((x, y) => x.giftId.localeCompare(y.giftId))
		.slice(0, 30)
		.map((c) => c.giftId);
	const picked = pickThirty(pool, SUPPLY, roles, NONE).map((p) => p.card.giftId);
	assert.notDeepEqual(picked, naive);
});

test('어디에도 안 맞는 카드는 어느 무더기에도 안 들어간다', () => {
	// 4등급 · 곁다리 fit(SINKING) · 공용 · 안 켜짐: 확실히 좋다(안 켜짐 탈락) ·
	// 확실히 아니다(fit≠0 탈락) · 네 갈래 전부(등급이 높지도 낮지도 않다) 다
	// 안 맞는다
	const orphan: GiftCard = {
		giftId: 'orphan001', name: '어중간', desc: '설명',
		tier: 3, keywordId: 'Sinking', exclusive: false, fireable: false,
	};
	const { pool, roles } = buildPool({ good: 5, bad: 5, a: 5, b: 5, c: 5, d: 5 });
	const picked = pickThirty([...pool, orphan], SUPPLY, roles, NONE);
	assert.ok(!picked.some((p) => p.card.giftId === 'orphan001'));
});

test('why 가 갈래를 설명한다', () => {
	const { pool, roles } = buildPool({ good: 1, bad: 1, a: 1, b: 1, c: 1, d: 1 });
	const picked = pickThirty(pool, SUPPLY, roles, NONE);
	const byId = new Map(picked.map((p) => [p.card.giftId, p.why]));
	assert.match(byId.get('good001') ?? '', /맞는다/);
	assert.match(byId.get('bad001') ?? '', /안 맞는다/);
	assert.match(byId.get('branchA001') ?? '', /5등급.*안 맞는다/);
	assert.match(byId.get('branchB001') ?? '', /1등급.*맞는다/);
	assert.match(byId.get('branchC001') ?? '', /재료다/);
	assert.match(byId.get('branchC001') ?? '', /기프트 결과/, 'why 에 상위 이름이 없다');
	assert.match(byId.get('branchD001') ?? '', /전용/);
});
