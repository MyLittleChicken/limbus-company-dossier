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
		// BULLET 은 이 어휘에 없다 — special_status 로만 닿을 수 있는 축이다
		keywordVocabulary: ['Combustion', 'Vibration', 'Breath', 'Laceration'],
		identityStatus: [
			// BULLET 은 keyword 어휘에 없다 — 11003 은 이 경로로만 축을 얻는다.
			// 상태 둘(Bullet · BulletLament)이 같은 축을 가리켜도 한 행으로 합쳐진다
			{ identityId: '11003', statusId: 'Bullet' },
			{ identityId: '11003', statusId: 'BulletLament' },
			// COMBUSTION 은 keyword 어휘에 있다 — 상태로 와도 special_status 를 안 만든다
			{ identityId: '11001', statusId: 'SomeCombustionStatus' },
			// 10916 은 restrict 가 COMBUSTION·VIBRATION 뿐이라 BULLET 상태가 있어도 제한에 깎인다
			{ identityId: '10916', statusId: 'Bullet' },
		],
		statusCategory: [
			{ statusId: 'Bullet', category: 'BULLET' },
			{ statusId: 'BulletLament', category: 'BULLET' },
			{ statusId: 'SomeCombustionStatus', category: 'COMBUSTION' },
		],
		axisIds: ['COMBUSTION', 'VIBRATION', 'BREATH', 'LACERATION', 'BULLET'],
		identityIds: ['10916', '11001', '11002', '11003'],
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

test('keyword 어휘에 없는 축은 special_status 로 들어온다 — BULLET', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const sp = rows.filter((r) => r.source === 'special_status' && r.identityId === '11003');
	// Bullet · BulletLament 둘 다 BULLET 이라 한 행으로 합쳐진다
	assert.deepEqual(sp.map((r) => r.axisId), ['BULLET']);
	assert.ok(sp.every((r) => r.affects === 'both' && r.gateKind === 'always' && r.gateRef === ''));
});

test('keyword 어휘에 있는 축은 special_status 로 안 들어온다 — 제한이 무너지지 않는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	// 11001 은 SomeCombustionStatus(→COMBUSTION) 상태를 가졌지만 COMBUSTION 은
	// keyword 어휘에 있으므로 special_status 가 만들어지지 않는다
	assert.equal(
		rows.some((r) => r.source === 'special_status' && r.identityId === '11001'),
		false,
	);
	assert.equal(rows.some((r) => r.source === 'special_status' && r.axisId === 'COMBUSTION'), false);
});

test('제한이 special_status 행도 깎는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	// 10916 은 restrict 가 COMBUSTION·VIBRATION 뿐이다 — BULLET 상태가 있어도 살아남지 못한다
	assert.equal(
		rows.some((r) => r.identityId === '10916' && r.axisId === 'BULLET'),
		false,
	);
});

test('source 어휘가 셋이다 — keyword · special_status · granted', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	assert.deepEqual(
		[...new Set(rows.map((r) => r.source))].sort(),
		['granted', 'keyword', 'special_status'],
	);
});

test('축이 하나도 없는 인격은 결손으로 남는다 — granted 는 안 센다', () => {
	const meta = new Meta();
	buildIdentityAxis(input(), meta);
	// 11002 는 keyword 도 special_status 도 granted 도 없다
	assert.ok(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11002' && g.field === 'axis'));
	// 11001 은 keyword 가 있으므로 결손이 아니다
	assert.equal(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11001'), false);
	// 11003 은 special_status 만으로도 결손이 아니다
	assert.equal(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11003'), false);
});

test('같은 행이 두 번 나오지 않는다', () => {
	const i = input();
	i.identityKeyword.push({ identityId: '10916', keywordId: 'Combustion' });
	const rows = buildIdentityAxis(i, new Meta());
	const keys = rows.map((r) => `${r.identityId}|${r.axisId}|${r.source}|${r.gateKind}|${r.gateRef}`);
	assert.equal(keys.length, new Set(keys).size);
});
