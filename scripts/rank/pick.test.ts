/**
 * 세 무더기 고르기 — 「확실히 좋다」·「확실히 아니다」는 방향을 고정하는
 * 용도이고, 「엇갈린다」열 장이 저울추를 정하는 표본의 전부다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickThirty as pickThirtyRaw } from './pick.js';
import type { Picked, Quota } from './pick.js';
import type { FusionRole } from './fusion.js';
import type { DeckSupply, GiftCard } from './types.js';

/**
 * 출격 7인. COMBUSTION 이 강한 축(6/7 ≈ 0.857), SINKING 은 곁다리(1/7 ≈ 0.14 —
 * 0 도 0.5 도 아니다), BURST 는 어휘 안인데 이 덱 공급이 0(정확히 fit 0).
 */
const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['SINKING', 1]]),
	attackType: new Map([['slash', 4], ['blunt', 4]]),
	fieldSize: 7,
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

/**
 * 기프트 **전체**의 이름표. 합성 결과물(`g_result`)이 여기 들어 있는 것이
 * 요점이다 — 못에는 없는 이름을 갈래 c 의 `why` 가 불러야 한다.
 */
const NAMES = new Map([['g_result', '기프트 결과'], ['g_x', '기프트 엑스']]);
const nameOf = (giftId: string): string => NAMES.get(giftId) ?? giftId;

/** 검사마다 이름표를 다시 적지 않게 감싼다 */
const pickThirty = (
	pool: GiftCard[], supply: DeckSupply,
	roles: Map<string, FusionRole>, avoid: ReadonlySet<string>,
	quota?: Quota,
): Picked[] => pickThirtyRaw(pool, supply, roles, avoid, nameOf, quota);

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

test('갈래 안에서는 avoid 아닌 것을 먼저 쓴다', () => {
	// branchA 는 avoid 아닌 것 하나, avoid 인 것 여럿. avoid 는 갈래 자기 차례
	// 안의 우선순위일 뿐이다 — avoid 아닌 branchA 카드 하나는 반드시 들어가야 한다
	const { pool, roles } = buildPool({ good: 0, bad: 0, a: 6, b: 6, c: 6, d: 6 });
	const branchAIds = pool.filter((c) => c.giftId.startsWith('branchA')).map((c) => c.giftId);
	const avoid = new Set(branchAIds.slice(1)); // 첫 장만 avoid 아니다
	const tangled = stratumOf(pickThirty(pool, SUPPLY, roles, avoid), '엇갈린다');
	assert.ok(tangled.some((p) => p.card.giftId === branchAIds[0]),
		'avoid 아닌 branchA 카드가 안 들어갔다');
});

test('avoid 가 갈래 하나를 통째로 굶겨도 다른 세 갈래가 차례를 잃지 않는다', () => {
	// 리뷰어가 재현한 회귀: branchA 는 avoid 없이 넉넉하고, branchB·C·D 는
	// 전부 avoid 다. "avoid 아닌 패를 먼저 통째로 돈다"로 짰던 이전 구현은
	// branchA 가 열 장을 혼자 다 먹고 나머지 세 갈래는 0장이었다(10/0/0/0) —
	// avoid 가 다른 갈래의 차례 자체를 뺏은 것이다. 지금은 갈래마다 자기
	// 차례에서 "가장 나은 것"(avoid 아닌 게 없으면 avoid 라도)을 내야 한다
	const { pool, roles } = buildPool({ good: 0, bad: 0, a: 15, b: 15, c: 15, d: 15 });
	const avoid = new Set(
		pool
			.filter((c) => /^branch[BCD]/.test(c.giftId))
			.map((c) => c.giftId),
	);
	const tangled = stratumOf(pickThirty(pool, SUPPLY, roles, avoid), '엇갈린다');
	assert.equal(tangled.length, 10);
	const byPrefix = new Map<string, number>();
	for (const p of tangled) {
		const prefix = p.card.giftId.replace(/\d+$/, '');
		byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
	}
	assert.equal(byPrefix.size, 4, `네 갈래가 다 나와야 한다: ${JSON.stringify([...byPrefix])}`);
	for (const [prefix, n] of byPrefix) {
		assert.ok(n <= 4, `${prefix} 가 ${n}장으로 몰렸다(10/0/0/0 회귀): ${JSON.stringify([...byPrefix])}`);
	}
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

/**
 * 경계값 전용 공급 — COMBUSTION 을 **정확히 0.5** 에 오게 짠다(3 / 최대치 6).
 * 등급 경계는 `tierOf` 가 이미 정확한 자를 준다(4등급→0.75 · 2등급→0.25).
 *
 * **`buildPool` 은 이 경계를 한 번도 안 건드린다** — tier ∈ {1,5}(t ∈
 * {0,1})·fit ∈ {0, ~0.167, 1.0}뿐이라, `>=`/`<=` 를 `>`/`<` 로 바꿔도 그
 * 갈래에 든 카드는 여전히 같은 무더기에 남는다(리뷰어가 뮤테이션으로
 * 확인: 12/12 그대로 통과). 아래는 그 사각을 메운다.
 */
const BOUNDARY_SUPPLY: DeckSupply = {
	// 출격 6인 중 화상 3 — 정확히 0.5 다. LACERATION 6 을 함께 둔 것은 **다른
	// 축이 아무리 커도 분모(출격 인원)가 안 바뀐다**는 것을 고정물로 못 박기
	// 위해서다. 최댓값으로 나누던 때에는 이 6 이 분모였다
	axis: new Map([['COMBUSTION', 3], ['LACERATION', 6]]),
	attackType: new Map(),
	fieldSize: 6,
};

test('경계값 — fit 0.5·t 0.75 정확히·켜짐 → 확실히 좋다', () => {
	const card: GiftCard = {
		giftId: 'bnd_good', name: '경계 좋음', desc: '설명',
		tier: 4, keywordId: 'Combustion', exclusive: false, fireable: true,
	};
	const picked = pickThirty([card], BOUNDARY_SUPPLY, new Map(), NONE);
	assert.equal(picked[0]?.stratum, '확실히 좋다', JSON.stringify(picked));
});

test('경계값 — fit 0·t 0.25 정확히 → 확실히 아니다', () => {
	const card: GiftCard = {
		giftId: 'bnd_bad', name: '경계 나쁨', desc: '설명',
		tier: 2, keywordId: 'Burst', exclusive: false, fireable: true,
	};
	const picked = pickThirty([card], BOUNDARY_SUPPLY, new Map(), NONE);
	assert.equal(picked[0]?.stratum, '확실히 아니다', JSON.stringify(picked));
});

test('경계값 — t 0.75 정확히·fit 0 → 엇갈린다(고등급 축 불일치)', () => {
	const card: GiftCard = {
		giftId: 'bnd_a', name: '경계 갈래a', desc: '설명',
		tier: 4, keywordId: 'Burst', exclusive: false, fireable: true,
	};
	const picked = pickThirty([card], BOUNDARY_SUPPLY, new Map(), NONE);
	assert.equal(picked[0]?.stratum, '엇갈린다', JSON.stringify(picked));
	assert.match(picked[0]?.why ?? '', /4등급.*안 맞는다/);
});

test('경계값 — t 0.25 정확히·fit 0.5 → 엇갈린다(저등급 축 일치)', () => {
	const card: GiftCard = {
		giftId: 'bnd_b', name: '경계 갈래b', desc: '설명',
		tier: 2, keywordId: 'Combustion', exclusive: false, fireable: true,
	};
	const picked = pickThirty([card], BOUNDARY_SUPPLY, new Map(), NONE);
	assert.equal(picked[0]?.stratum, '엇갈린다', JSON.stringify(picked));
	assert.match(picked[0]?.why ?? '', /2등급.*맞는다/);
});

test('경계값 — fit 0.5·t 0.75 인데 안 켜지면 확실히 좋다가 아니다', () => {
	// 등급·적합도는 확실히 좋다감인데 fireable 게이트가 막는다. 게이트가
	// 빠지면 이 카드가 확실히 좋다로 들어온다 — 그게 이 검사가 잡는 것이다
	const card: GiftCard = {
		giftId: 'bnd_nofire', name: '경계 안켜짐', desc: '설명',
		tier: 4, keywordId: 'Combustion', exclusive: false, fireable: false,
	};
	const picked = pickThirty([card], BOUNDARY_SUPPLY, new Map(), NONE);
	assert.ok(!picked.some((p) => p.card.giftId === 'bnd_nofire'),
		'안 켜지는데 확실히 좋다에 들어갔다 — fireable 게이트가 없다');
});

test('몫을 바꿔 부르면 그 수만큼 낸다', () => {
	// 「확실히 좋다」가 원리적으로 0 인 덱(방향미정)에 그 몫을 엇갈림으로 옮기는
	// 자리다. 무더기 정의는 그대로이므로 낼 장수만 달라져야 한다
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const quota: Quota = { good: 0, bad: 5, tangled: 20, turns: [1, 1, 1, 1] };
	const picked = pickThirty(pool, SUPPLY, roles, NONE, quota);
	assert.equal(stratumOf(picked, '확실히 좋다').length, 0);
	assert.equal(stratumOf(picked, '확실히 아니다').length, 5);
	assert.equal(stratumOf(picked, '엇갈린다').length, 20);
	assert.equal(picked.length, 25);
});

test('갈래 차례를 키우면 그 갈래가 더 많이 나온다 — 다른 갈래를 죽이지는 않는다', () => {
	const { pool, roles } = buildPool({ good: 0, bad: 0, a: 25, b: 25, c: 25, d: 25 });
	const quota: Quota = { good: 10, bad: 10, tangled: 20, turns: [2, 1, 1, 1] };
	const tangled = stratumOf(pickThirty(pool, SUPPLY, roles, NONE, quota), '엇갈린다');
	assert.equal(tangled.length, 20);
	const byBranch = [0, 1, 2, 3].map((b) => tangled.filter((p) => p.branch === b).length);
	// 한 바퀴에 2·1·1·1 이면 스무 장은 8·4·4·4 다
	assert.deepEqual(byBranch, [8, 4, 4, 4]);
});

test('기본 몫은 예전과 같다 — 10·10·10 에 갈래 고르게', () => {
	const { pool, roles } = buildPool({ good: 25, bad: 25, a: 25, b: 25, c: 25, d: 25 });
	const withDefault = pickThirty(pool, SUPPLY, roles, NONE).map((p) => p.card.giftId);
	const explicit = pickThirty(pool, SUPPLY, roles, NONE,
		{ good: 10, bad: 10, tangled: 10, turns: [1, 1, 1, 1] }).map((p) => p.card.giftId);
	assert.deepEqual(withDefault, explicit);
});

test('갈래를 밖으로 낸다 — why 를 뜯어 되짚지 않아도 되게', () => {
	const { pool, roles } = buildPool({ good: 1, bad: 1, a: 1, b: 1, c: 1, d: 1 });
	const byId = new Map(pickThirty(pool, SUPPLY, roles, NONE).map((p) => [p.card.giftId, p.branch]));
	assert.equal(byId.get('good001'), -1);
	assert.equal(byId.get('bad001'), -1);
	assert.equal(byId.get('branchA001'), 0);
	assert.equal(byId.get('branchB001'), 1);
	assert.equal(byId.get('branchC001'), 2);
	assert.equal(byId.get('branchD001'), 3);
});

test('갈래 c 의 why 는 못에 없는 결과물의 이름을 부른다', () => {
	/**
	 * 회귀 검사. 이름표를 못(`pool`)에서 찾던 때에는 **합성 결과물이 못에서 이미
	 * 빠져 있어** 폴백이 100% 발동했고 「1등급인데 9170의 재료다」가 나왔다
	 * (실측 21장 전부). 여기서는 못에 결과물을 아예 안 넣어 그 상황을 만든다.
	 */
	const card: GiftCard = {
		giftId: 'mat001', name: '재료', desc: '설명',
		tier: 1, keywordId: 'Sinking', exclusive: false, fireable: true,
	};
	const roles = new Map<string, FusionRole>([
		['mat001', { madeOnly: false, makes: [{ result: 'g_result', withOthers: [], recipeCount: 1 }] }],
	]);
	const picked = pickThirty([card], SUPPLY, roles, NONE);
	assert.equal(picked[0]?.stratum, '엇갈린다');
	assert.match(picked[0]?.why ?? '', /기프트 결과의 재료다/, picked[0]?.why);
});

test('why 가 축과 공격 타입과 키워드 없음을 갈라 적는다', () => {
	// 셈은 맞는데 설명이 「축」으로 고정돼 있으면 사람은 설명을 믿고 판정한다.
	// SUPPLY 는 slash 4 / 출격 7 ≈ 0.57 이라 참격은 「맞는다」 쪽이다
	const slash: GiftCard = {
		giftId: 'atk001', name: '참격', desc: '설명',
		tier: 5, keywordId: 'Slash', exclusive: false, fireable: true,
	};
	const plain: GiftCard = {
		giftId: 'none001', name: '범용', desc: '설명',
		tier: 1, keywordId: 'None', exclusive: false, fireable: true,
	};
	const picked = pickThirty([slash, plain], SUPPLY, new Map(), NONE);
	const byId = new Map(picked.map((p) => [p.card.giftId, p.why]));
	assert.match(byId.get('atk001') ?? '', /공격 타입과 맞는다/, byId.get('atk001'));
	assert.doesNotMatch(byId.get('atk001') ?? '', /축/, '참격을 축이라 적었다');
	assert.match(byId.get('none001') ?? '', /키워드가 없어/, byId.get('none001'));
});

test('무더기가 겹치면 앞선 것 하나로만 들어간다 — 확실히 아니다가 엇갈린다(재료)보다 앞선다', () => {
	// fit=0·t≤0.25(확실히 아니다 조건)이면서 동시에 상위 재료(엇갈린다 갈래 c
	// 조건)인 카드. 판정 순서상 확실히 아니다가 먼저이므로 갈래 c 로는 안 간다
	const card: GiftCard = {
		giftId: 'overlap001', name: '겹침', desc: '설명',
		tier: 1, keywordId: 'Burst', exclusive: false, fireable: true,
	};
	const roles = new Map<string, FusionRole>([
		['overlap001', { madeOnly: false, makes: [{ result: 'g_x', withOthers: [], recipeCount: 1 }] }],
	]);
	const picked = pickThirty([card], SUPPLY, roles, NONE);
	assert.equal(picked.length, 1);
	assert.equal(picked[0]?.stratum, '확실히 아니다', JSON.stringify(picked));
});
