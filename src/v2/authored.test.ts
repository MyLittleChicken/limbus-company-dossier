import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unknownRefs, authoredDigest, type Authored, type KnownIds } from './authored.js';

const KNOWN: KnownIds = {
	axisIds: new Set(['LACERATION', 'BREATH']),
	unitKeywordIds: new Set(['BLOODFIEND']),
	associationIds: new Set(['YURODIVY']),
};

const OK: Authored = {
	refException: [
		{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		{ kind: 'trigger', key: 'Yurodivy Identities', refKind: 'association', refId: 'YURODIVY' },
	],
	egoGranted: [{ egoId: '20509', axisId: 'LACERATION' }],
};

test('전부 닿으면 빈 배열이다', () => {
	assert.deepEqual(unknownRefs(OK, KNOWN), []);
});

test('없는 ref_id 를 키와 함께 낸다 — 어느 행인지 바로 알아야 한다', () => {
	const bad: Authored = {
		refException: [{ kind: 'trigger', key: 'X Identities', refKind: 'unit_keyword', refId: 'NOPE' }],
		egoGranted: [],
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
	};
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /모르는 ref_kind/);
});

test('없는 axis_id 를 잡는다', () => {
	const bad: Authored = { refException: [], egoGranted: [{ egoId: '20509', axisId: 'NOPE' }] };
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /ego_granted_axis/);
});

test('없는 ego_id 는 여기서 안 잡는다 — 결손으로 남는 경로다', () => {
	// 새 E.G.O 가 나오기 전에 그 사실을 먼저 적어 둘 수 있어야 한다.
	// identity-axis 가 결손으로 기록하고, 굽기는 멈추지 않는다
	const bad: Authored = { refException: [], egoGranted: [{ egoId: '99999', axisId: 'LACERATION' }] };
	assert.deepEqual(unknownRefs(bad, KNOWN), []);
});

test('여러 건이면 여러 줄로 낸다 — 첫 건에서 멈추지 않는다', () => {
	const bad: Authored = {
		refException: [
			{ kind: 'trigger', key: 'A', refKind: 'unit_keyword', refId: 'NOPE1' },
			{ kind: 'token', key: 'B', refKind: 'axis', refId: 'NOPE2' },
		],
		egoGranted: [{ egoId: '20509', axisId: 'NOPE3' }],
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
	};
	const b: Authored = {
		refException: [
			{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' },
			{ kind: 'trigger', key: 'B', refKind: 'axis', refId: 'X' },
		],
		egoGranted: [{ egoId: '1', axisId: 'P' }, { egoId: '2', axisId: 'Q' }],
	};
	assert.equal(authoredDigest(a), authoredDigest(b));
});

test('값이 하나만 달라도 지문이 달라진다', () => {
	const a: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'X' }], egoGranted: [] };
	const b: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' }], egoGranted: [] };
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('행이 늘면 지문이 달라진다', () => {
	const a: Authored = { refException: [], egoGranted: [{ egoId: '1', axisId: 'P' }] };
	const b: Authored = {
		refException: [],
		egoGranted: [{ egoId: '1', axisId: 'P' }, { egoId: '1', axisId: 'Q' }],
	};
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('두 표가 안 섞인다 — 같은 문자열이 다른 표에 있어도 지문이 갈린다', () => {
	// 구분자 없이 이어 붙이면 경계가 무너져 다른 입력이 같은 지문을 낼 수 있다
	const a: Authored = {
		refException: [{ kind: 'x', key: 'y', refKind: 'z', refId: 'w' }],
		egoGranted: [],
	};
	const b: Authored = { refException: [], egoGranted: [{ egoId: 'x y z', axisId: 'w' }] };
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('빈 저작도 지문을 낸다 — sha256 64자', () => {
	assert.equal(authoredDigest({ refException: [], egoGranted: [] }).length, 64);
});
