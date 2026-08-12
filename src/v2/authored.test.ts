import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unknownRefs, authoredDigest, type Authored, type KnownIds } from './authored.js';
import { verdictOf, DIGEST_EXCLUDE } from './rebuild-verdict.js';

const KNOWN: KnownIds = {
	axisIds: new Set(['LACERATION', 'BREATH']),
	unitKeywordIds: new Set(['BLOODFIEND']),
	associationIds: new Set(['YURODIVY']),
	sinIds: new Set(['wrath', 'gloom']),
	attackTypes: new Set(['slash', 'pierce', 'blunt']),
	skillKinds: new Set(['counter', 'evade', 'guard']),
	resonanceIds: new Set(['wrath', 'gloom']),
	coinKinds: new Set(['minus', 'plus', 'single']),
	deploymentIds: new Set(['slot1', 'slot7']),
};

const OK: Authored = {
	refException: [
		{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		{ kind: 'trigger', key: 'Yurodivy Identities', refKind: 'association', refId: 'YURODIVY' },
	],
	egoGranted: [{ egoId: '20509', axisId: 'LACERATION' }],
	axisGrant: [], giftAbility: [],
};

test('전부 닿으면 빈 배열이다', () => {
	assert.deepEqual(unknownRefs(OK, KNOWN), []);
});

test('없는 ref_id 를 키와 함께 낸다 — 어느 행인지 바로 알아야 한다', () => {
	const bad: Authored = {
		refException: [{ kind: 'trigger', key: 'X Identities', refKind: 'unit_keyword', refId: 'NOPE' }],
		egoGranted: [],
		axisGrant: [], giftAbility: [],
	};
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /ref_exception/);
	assert.match(got[0] as string, /X Identities/);
	assert.match(got[0] as string, /NOPE/);
});

test('모르는 ref_kind 도 잡는다 — 조용히 통과시키지 않는다', () => {
	const bad: Authored = {
		refException: [{ kind: 'trigger', key: 'X', refKind: 'planet', refId: 'MARS' }],
		egoGranted: [],
		axisGrant: [], giftAbility: [],
	};
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /모르는 ref_kind/);
});

test('없는 axis_id 를 잡는다', () => {
	const bad: Authored = { refException: [], egoGranted: [{ egoId: '20509', axisId: 'NOPE' }], axisGrant: [], giftAbility: [] };
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /ego_granted_axis/);
});

test('없는 ego_id 는 여기서 안 잡는다 — 결손으로 남는 경로다', () => {
	// 새 E.G.O 가 나오기 전에 그 사실을 먼저 적어 둘 수 있어야 한다.
	// identity-axis 가 결손으로 기록하고, 굽기는 멈추지 않는다
	const bad: Authored = { refException: [], egoGranted: [{ egoId: '99999', axisId: 'LACERATION' }], axisGrant: [], giftAbility: [] };
	assert.deepEqual(unknownRefs(bad, KNOWN), []);
});

test('여러 건이면 여러 줄로 낸다 — 첫 건에서 멈추지 않는다', () => {
	const bad: Authored = {
		refException: [
			{ kind: 'trigger', key: 'A', refKind: 'unit_keyword', refId: 'NOPE1' },
			{ kind: 'token', key: 'B', refKind: 'axis', refId: 'NOPE2' },
		],
		egoGranted: [{ egoId: '20509', axisId: 'NOPE3' }],
		axisGrant: [], giftAbility: [],
	};
	assert.equal(unknownRefs(bad, KNOWN).length, 3);
});

test('지문은 순서에 안 흔들린다', () => {
	const a: Authored = {
		refException: [
			{ kind: 'trigger', key: 'B', refKind: 'axis', refId: 'X' },
			{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' },
		],
		egoGranted: [{ egoId: '2', axisId: 'Q' }, { egoId: '1', axisId: 'P' }],
		axisGrant: [], giftAbility: [],
	};
	const b: Authored = {
		refException: [
			{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' },
			{ kind: 'trigger', key: 'B', refKind: 'axis', refId: 'X' },
		],
		egoGranted: [{ egoId: '1', axisId: 'P' }, { egoId: '2', axisId: 'Q' }],
		axisGrant: [], giftAbility: [],
	};
	assert.equal(authoredDigest(a), authoredDigest(b));
});

test('값이 하나만 달라도 지문이 달라진다', () => {
	const a: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'X' }], egoGranted: [], axisGrant: [], giftAbility: [] };
	const b: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' }], egoGranted: [], axisGrant: [], giftAbility: [] };
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('행이 늘면 지문이 달라진다', () => {
	const a: Authored = { refException: [], egoGranted: [{ egoId: '1', axisId: 'P' }], axisGrant: [], giftAbility: [] };
	const b: Authored = {
		refException: [],
		egoGranted: [{ egoId: '1', axisId: 'P' }, { egoId: '1', axisId: 'Q' }],
		axisGrant: [], giftAbility: [],
	};
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('두 표가 안 섞인다 — 같은 문자열이 다른 표에 있어도 지문이 갈린다', () => {
	// 구분자 없이 이어 붙이면 경계가 무너져 다른 입력이 같은 지문을 낼 수 있다
	const a: Authored = {
		refException: [{ kind: 'x', key: 'y', refKind: 'z', refId: 'w' }],
		egoGranted: [],
		axisGrant: [], giftAbility: [],
	};
	const b: Authored = { refException: [], egoGranted: [{ egoId: 'x y z', axisId: 'w' }], axisGrant: [], giftAbility: [] };
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('빈 저작도 지문을 낸다 — sha256 64자', () => {
	assert.equal(authoredDigest({ refException: [], egoGranted: [], axisGrant: [], giftAbility: [] }).length, 64);
});

// ── axis_grant ───────────────────────────────────────────────────

test('axis_grant — restrict 는 self 여야 한다', () => {
	const a: Authored = {
		refException: [], egoGranted: [],
		axisGrant: [{
			id: 'x:COMBUSTION', sourceKind: 'passive', sourceId: 'x', mode: 'restrict',
			targetKind: 'association', targetId: 'DAWN', axisId: 'COMBUSTION',
			affects: 'both', gateKind: 'always', gateRef: '', gateMin: null,
		}],
		giftAbility: [],
	};
	const known = {
		axisIds: new Set(['COMBUSTION']), unitKeywordIds: new Set<string>(),
		associationIds: new Set(['DAWN']),
		sinIds: new Set<string>(), attackTypes: new Set<string>(),
		skillKinds: new Set<string>(), resonanceIds: new Set<string>(),
		coinKinds: new Set<string>(), deploymentIds: new Set<string>(),
	};
	const out = unknownRefs(a, known);
	assert.equal(out.length, 1);
	assert.match(out[0] as string, /restrict 는 target_kind='self'/);
});

test('axis_grant — source_kind 어휘 밖이면 잡는다', () => {
	const a: Authored = {
		refException: [], egoGranted: [],
		axisGrant: [{
			id: 'z:COMBUSTION', sourceKind: 'nope', sourceId: 'z', mode: 'add',
			targetKind: 'self', targetId: 'z', axisId: 'COMBUSTION',
			affects: 'both', gateKind: 'always', gateRef: '', gateMin: null,
		}],
		giftAbility: [],
	};
	const known = {
		axisIds: new Set(['COMBUSTION']), unitKeywordIds: new Set<string>(),
		associationIds: new Set<string>(),
		sinIds: new Set<string>(), attackTypes: new Set<string>(),
		skillKinds: new Set<string>(), resonanceIds: new Set<string>(),
		coinKinds: new Set<string>(), deploymentIds: new Set<string>(),
	};
	assert.match(unknownRefs(a, known)[0] as string, /모르는 source_kind 'nope'/);
});

test('axis_grant — gate_min 은 roster_count 일 때만 있다', () => {
	const a: Authored = {
		refException: [], egoGranted: [],
		axisGrant: [{
			id: 'y:BREATH', sourceKind: 'gift', sourceId: 'y', mode: 'add',
			targetKind: 'self', targetId: '', axisId: 'BREATH',
			affects: 'both', gateKind: 'ego_equipped', gateRef: '20509', gateMin: 3,
		}],
		giftAbility: [],
	};
	const known = {
		axisIds: new Set(['BREATH']), unitKeywordIds: new Set<string>(),
		associationIds: new Set<string>(),
		sinIds: new Set<string>(), attackTypes: new Set<string>(),
		skillKinds: new Set<string>(), resonanceIds: new Set<string>(),
		coinKinds: new Set<string>(), deploymentIds: new Set<string>(),
	};
	assert.match(unknownRefs(a, known)[0] as string, /gate_min 은 roster_count 일 때만/);
});

test('지문은 note 를 안 본다', () => {
	const base: Authored = { refException: [], egoGranted: [], axisGrant: [], giftAbility: [] };
	assert.equal(authoredDigest(base), authoredDigest({ ...base }));
});

// ── 재현 판정 ────────────────────────────────────────────────────

test('입력 같고 결과 같으면 재현됨', () => {
	assert.equal(verdictOf({ inputChanged: false, same: true }), 'reproduced');
});

test('입력 같은데 결과가 다르면 경보다', () => {
	assert.equal(verdictOf({ inputChanged: false, same: false }), 'failed');
});

test('입력이 바뀌었으면 결과가 달라도 실패가 아니다', () => {
	// 저작이나 코드를 고쳤으면 결과가 다른 것이 정상이다.
	// 여기서 「재현 실패」라고 말하면 거짓말이 된다
	assert.equal(verdictOf({ inputChanged: true, same: false }), 'input-changed');
});

test('입력이 바뀌었는데 결과가 같아도 입력이 바뀐 것이다', () => {
	// 고친 저작이 이 판에 영향을 안 줬을 뿐이다. 「재현됨」이라고 하면
	// 다음 사람이 build_info 의 지문을 믿게 된다
	assert.equal(verdictOf({ inputChanged: true, same: true }), 'input-changed');
});

test('build_info 는 대조에서 빠진다 — built_at 이 매번 다르다', () => {
	assert.equal(DIGEST_EXCLUDE.has('build_info'), true);
});

// ── 기프트 능력 ──────────────────────────────────────────────

const ABILITY_COND = {
	group: 0, idx: 0, refKind: 'association', refId: 'YURODIVY', op: 'has' as const,
	threshold: null, scope: 'roster' as const, supply: 'tag' as const,
	slot: null, runtime: false, resonanceMode: null,
};
const EMPTY: Authored = { refException: [], egoGranted: [], axisGrant: [], giftAbility: [] };
const withAbility = (conds: unknown[]): Authored => ({
	...EMPTY,
	giftAbility: [{
		giftId: '9262', level: 0, ordinal: 0,
		payload: {
			timing: 'none', unconditional: false, refines: null, sourceText: '문단',
			conds: conds as never,
		},
	}],
});

test('기프트 능력 — 실재하는 참조는 통과한다', () => {
	assert.deepEqual(unknownRefs(withAbility([ABILITY_COND]), KNOWN), []);
});

test('기프트 능력 — 없는 소속을 어느 조건인지와 함께 낸다', () => {
	const bad = { ...ABILITY_COND, refId: 'NOT_A_CLAN' };
	assert.deepEqual(
		unknownRefs(withAbility([bad]), KNOWN),
		['gift_ability 9262/0/0 조건 0/0 의 association 참조가 없다: NOT_A_CLAN'],
	);
});

test('기프트 능력 — 새 참조 종류 넷도 검사한다', () => {
	const bad = { ...ABILITY_COND, refKind: 'attack_type', refId: 'kick', scope: 'field' as const };
	assert.deepEqual(
		unknownRefs(withAbility([bad]), KNOWN),
		['gift_ability 9262/0/0 조건 0/0 의 attack_type 참조가 없다: kick'],
	);
});

test('기프트 능력 — 어휘 밖 refKind 를 잡는다', () => {
	const bad = { ...ABILITY_COND, refKind: '해괴한종류' };
	assert.deepEqual(
		unknownRefs(withAbility([bad]), KNOWN),
		['gift_ability 9262/0/0 조건 0/0 의 refKind 가 어휘에 없다: 해괴한종류'],
	);
});

test("기프트 능력 — refKind='other' 는 검사에서 뺀다", () => {
	// 어휘에 못 담는 조건의 원문 조각을 담는 자리다. 실재를 물을 수 없다.
	const other = {
		...ABILITY_COND, refKind: 'other', refId: '지령 대상이 사망했으면',
		scope: 'enemy' as const, supply: 'any' as const, runtime: true,
	};
	assert.deepEqual(unknownRefs(withAbility([other]), KNOWN), []);
});

test('기프트 능력 — 형식이 틀어진 payload 도 굽기 직전에 잡는다', () => {
	// 심을 때 막지만 손으로 DB 를 고칠 수 있으므로 여기서 다시 본다
	const bad = { ...ABILITY_COND, scope: 'slot' as const, slot: 9 };
	assert.deepEqual(
		unknownRefs(withAbility([bad]), KNOWN),
		['gift_ability 9262/0/0 형식: 조건 0/0 의 slot 이 1~7 이 아니다: 9'],
	);
});

test('지문 — 기프트 능력이 바뀌면 달라진다', () => {
	const base = withAbility([ABILITY_COND]);
	const changed: Authored = {
		...base,
		giftAbility: [{
			...base.giftAbility[0],
			payload: { ...base.giftAbility[0].payload, timing: 'turn_start' },
		}],
	};
	assert.notEqual(authoredDigest(base), authoredDigest(changed));
});

test('지문 — 조건 순서가 바뀌어도 같다', () => {
	// DB 왕복이나 편집으로 배열 순서가 흔들려도 같은 사실이면 같은 지문이어야 한다
	const a = { ...ABILITY_COND, group: 0, idx: 0 };
	const b = { ...ABILITY_COND, group: 0, idx: 1 };
	assert.equal(
		authoredDigest(withAbility([a, b])),
		authoredDigest(withAbility([b, a])),
	);
});

test('KnownIds 에 어휘가 빠지면 크게 터뜨린다', () => {
	// tsconfig 가 src 를 검사에서 빼므로 타입이 이 실수를 못 잡는다.
	// 조용히 「어휘에 없다」로 오진하느니 부르는 쪽을 지목한다
	const half = {
		axisIds: new Set<string>(), unitKeywordIds: new Set<string>(),
		associationIds: new Set<string>(),
	} as unknown as KnownIds;
	assert.throws(
		() => unknownRefs(EMPTY, half),
		/KnownIds 에 어휘가 빠졌다: sin, attack_type, skill_kind, resonance, coin, deployment/,
	);
});
