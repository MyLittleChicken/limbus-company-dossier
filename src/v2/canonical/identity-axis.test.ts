import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentityAxis, type IdentityAxisInput } from './identity-axis.js';
import { Meta } from './meta.js';

function input(): IdentityAxisInput {
	return {
		identityKeyword: [
			// 10916 — 패시브 1091603 이 화상·진동으로만 제한한다. mj 가 이미 반영했다
			{ identityId: '10916', keywordId: 'Combustion' },
			{ identityId: '10916', keywordId: 'Vibration' },
			// 축이 아닌 키워드는 무시된다
			{ identityId: '10916', keywordId: 'Poise' },
			{ identityId: '11001', keywordId: 'Laceration' },
		],
		axisIds: ['COMBUSTION', 'VIBRATION', 'BREATH', 'LACERATION'],
		identityIds: ['10916', '11001', '11002'],
		granted: [
			// 착영휘도를 끼면 호흡·출혈. 10916 은 제한이 있어 살아남지 못한다
			{ identityId: '10916', axisId: 'BREATH', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
			{ identityId: '11001', axisId: 'BREATH', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
		],
		restrict: [
			{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: '1091603' },
			{ identityId: '10916', axisId: 'VIBRATION', affects: 'both', sourceId: '1091603' },
		],
	};
}

test('keyword 경로 — 축인 것만, affects 는 both, 조건 없음', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const kw = rows.filter((r) => r.source === 'keyword' && r.identityId === '10916');
	assert.deepEqual(kw.map((r) => r.axisId).sort(), ['COMBUSTION', 'VIBRATION']);
	assert.ok(kw.every((r) => r.affects === 'both' && r.gateKind === 'always' && r.gateRef === ''));
});

test('제한이 keyword 도 깎는다 — 제한 밖의 축은 남지 않는다', () => {
	const i = input();
	// mj 가 반영을 안 한 경우를 가정한다. 제한이 최종 방어선이어야 한다
	i.identityKeyword.push({ identityId: '10916', keywordId: 'Breath' });
	const rows = buildIdentityAxis(i, new Meta());
	assert.equal(rows.some((r) => r.identityId === '10916' && r.axisId === 'BREATH'), false);
});

test('granted 경로 — 제한이 없는 인격은 살아남는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const g = rows.filter((r) => r.source === 'granted');
	assert.deepEqual(g.map((r) => r.identityId), ['11001']);
	assert.equal(g[0]?.axisId, 'BREATH');
	assert.equal(g[0]?.gateKind, 'ego_equipped');
	assert.equal(g[0]?.gateRef, '20509');
});

test('special_status 는 없다 — source 어휘가 둘뿐이다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	assert.deepEqual([...new Set(rows.map((r) => r.source))].sort(), ['granted', 'keyword']);
});

test('축이 하나도 없는 인격은 결손으로 남는다 — granted 는 안 센다', () => {
	const meta = new Meta();
	buildIdentityAxis(input(), meta);
	// 11002 는 keyword 도 granted 도 없다
	assert.ok(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11002' && g.field === 'axis'));
	// 11001 은 keyword 가 있으므로 결손이 아니다
	assert.equal(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11001'), false);
});

test('같은 행이 두 번 나오지 않는다', () => {
	const i = input();
	i.identityKeyword.push({ identityId: '10916', keywordId: 'Combustion' });
	const rows = buildIdentityAxis(i, new Meta());
	const keys = rows.map((r) => `${r.identityId}|${r.axisId}|${r.source}|${r.gateKind}|${r.gateRef}`);
	assert.equal(keys.length, new Set(keys).size);
});
