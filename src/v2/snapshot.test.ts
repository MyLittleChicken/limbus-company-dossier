import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasSnapshot } from './paths.js';
import { parseSnapshot, readManifest } from './snapshot.js';

/** 원본 스냅샷은 커밋하지 않는다. CI 는 원본 없이 돌므로 건너뛴다. */
const SNAPSHOT = { skip: hasSnapshot() ? false : 'data/entities 가 없다 (원본은 커밋하지 않는다)' };

const FIXTURE = {
	generatedAt: '2026-07-25',
	gameStateAnchor: '차원찢개 이상 인격 출시 시점',
	sources: [
		{
			id: 'limbus-data-mj',
			repo: 'github.com/monthofjune/limbus_data',
			branch: 'main',
			commit: '97c385678e3bc1d9013eb735c48203ef63f3ac51',
			fileCount: 17,
			status: 'current',
		},
		{
			id: 'game-dump-2023-pggb',
			repo: 'github.com/PGGB/limbus-company-data',
			branch: 'main',
			commit: 'b0f287a930a9db24c036d438347dd5e353d24563',
			fileCount: 1511,
			status: 'removed',
			note: '확인 후 로컬에서 제거',
		},
	],
};

test('parseSnapshot 은 generatedAt 을 id 로 쓰고 version 을 받는다', () => {
	const m = parseSnapshot(FIXTURE, 3);
	assert.equal(m.snapshot.id, '2026-07-25');
	assert.equal(m.snapshot.version, 3);
	assert.equal(m.snapshot.gameAnchor, '차원찢개 이상 인격 출시 시점');
});

test('parseSnapshot 은 createdAt 을 Date 로 낸다', () => {
	const m = parseSnapshot(FIXTURE, 1);
	assert.ok(m.snapshot.createdAt instanceof Date);
	assert.equal(m.snapshot.createdAt.toISOString().slice(0, 10), '2026-07-25');
});

test('parseSnapshot 은 status 가 removed 인 출처도 담는다', () => {
	const m = parseSnapshot(FIXTURE, 1);
	assert.equal(m.sources.length, 2);
	assert.equal(m.sources[1]?.status, 'removed');
	assert.equal(m.sources[1]?.fileCount, 1511);
});

test('parseSnapshot 은 모든 출처 행에 snapshotId 를 붙인다', () => {
	const m = parseSnapshot(FIXTURE, 1);
	for (const s of m.sources) assert.equal(s.snapshotId, '2026-07-25');
});

test('parseSnapshot 은 generatedAt 이 없으면 던진다', () => {
	assert.throws(() => parseSnapshot({ sources: [] }, 1), /generatedAt/);
});

test('parseSnapshot 은 sources 가 배열이 아니면 던진다', () => {
	assert.throws(() => parseSnapshot({ generatedAt: '2026-07-25' }, 1), /sources/);
});

test('실제 manifest 를 파싱한다 — 출처가 하나 이상이고 커밋이 40자다', SNAPSHOT, () => {
	const m = parseSnapshot(readManifest(), 1);
	assert.equal(m.snapshot.id, '2026-07-25');
	assert.ok(m.sources.length >= 6, '출처 6종 이상');
	for (const s of m.sources) assert.match(s.commit, /^[0-9a-f]{40}$/);
});
