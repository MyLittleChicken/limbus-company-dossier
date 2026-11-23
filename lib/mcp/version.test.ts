import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../db-canonical';
import { canonicalReachable, NO_DB } from '../../src/v2/canonical/db-available';
import { composeDataVersion, currentSnapshotId, dataVersion, readToolCtx } from './version';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

const BASE = [{ snapshotId: '2026-07-25', rows: 10661 }];

test('composeDataVersion: 재료가 같으면 같은 판 · 표지 순서는 무관', () => {
	const m = [...BASE, { snapshotId: 'md-c3e5', rows: 5015 }];
	assert.equal(composeDataVersion('2026-07-25', m, '100'), composeDataVersion('2026-07-25', [...m].reverse(), '100'));
	assert.match(composeDataVersion('2026-07-25', m, '100'), /^2026-07-25\.[\w-]{8}$/);
	assert.match(composeDataVersion(null, [], '?'), /^none\./);
});

test('composeDataVersion: 라이브 갱신 표지 · 행 수 · 쓰기 누계 어느 것이 바뀌어도 판이 바뀐다', () => {
	const v = composeDataVersion('2026-07-25', BASE, '100');
	assert.notEqual(composeDataVersion('2026-07-25', [...BASE, { snapshotId: 'md-1', rows: 80 }], '100'), v, '미러 갱신 표지');
	assert.notEqual(composeDataVersion('2026-07-25', [{ snapshotId: '2026-07-25', rows: 10660 }], '100'), v, '행 수');
	assert.notEqual(composeDataVersion('2026-07-25', BASE, '101'), v, '인격·E.G.O 갱신(쓰기 누계)');
});

test('readToolCtx 는 snapshotId 와 dataVersion 을 같은 시점에서 준다', { skip: reachable ? false : NO_DB }, async () => {
	const ctx = await readToolCtx();
	assert.equal(ctx.snapshotId, await currentSnapshotId());
	assert.equal(ctx.dataVersion, await dataVersion());
	assert.ok(ctx.dataVersion.startsWith(`${ctx.snapshotId ?? 'none'}.`));
});
