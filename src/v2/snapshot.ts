/**
 * 스냅샷 메타를 `data/manifest.json` 에서 읽는다.
 *
 * 「버전」이 우리 것인지 게임 것인지 갈리지 않도록 둘 다 담는다(스펙 2.3).
 *   version     우리 스냅샷 일련. 단조 증가. 호출자가 준다
 *   gameAnchor  게임 시점. manifest 의 gameStateAnchor
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.js';

export interface SnapshotRow {
	id: string;
	version: number;
	createdAt: Date;
	gameAnchor: string | null;
	note: string | null;
}

export interface SnapshotSourceRow {
	snapshotId: string;
	sourceId: string;
	repo: string;
	branch: string;
	commit: string;
	fileCount: number;
	status: string;
}

export interface SnapshotMeta {
	snapshot: SnapshotRow;
	sources: SnapshotSourceRow[];
}

export function readManifest(): unknown {
	const text = readFileSync(join(ROOT, 'data', 'manifest.json'), 'utf8').replace(/^﻿/, '');
	return JSON.parse(text);
}

function str(v: unknown): string | null {
	return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * manifest 를 적재 행으로 바꾼다.
 *
 * `status: 'removed'` 인 출처도 담는다. 그 출처가 언제 무엇을 줬는지가
 * 나중의 재현에 필요하다(manifest 주석: "커밋 해시로 재수집 가능").
 */
export function parseSnapshot(manifest: unknown, version: number): SnapshotMeta {
	if (typeof manifest !== 'object' || manifest === null) {
		throw new Error('manifest 가 객체가 아니다');
	}
	const m = manifest as Record<string, unknown>;

	const generatedAt = str(m['generatedAt']);
	if (generatedAt === null) throw new Error('manifest 에 generatedAt 이 없다');

	const rawSources = m['sources'];
	if (!Array.isArray(rawSources)) throw new Error('manifest 의 sources 가 배열이 아니다');

	const snapshot: SnapshotRow = {
		id: generatedAt,
		version,
		createdAt: new Date(`${generatedAt}T00:00:00Z`),
		gameAnchor: str(m['gameStateAnchor']),
		note: str(m['note']),
	};

	const sources = rawSources.map((raw, i): SnapshotSourceRow => {
		if (typeof raw !== 'object' || raw === null) {
			throw new Error(`manifest sources[${i}] 가 객체가 아니다`);
		}
		const s = raw as Record<string, unknown>;
		const sourceId = str(s['id']);
		if (sourceId === null) throw new Error(`manifest sources[${i}] 에 id 가 없다`);
		return {
			snapshotId: snapshot.id,
			sourceId,
			repo: str(s['repo']) ?? '',
			branch: str(s['branch']) ?? '',
			commit: str(s['commit']) ?? '',
			fileCount: typeof s['fileCount'] === 'number' ? s['fileCount'] : 0,
			status: str(s['status']) ?? 'unknown',
		};
	});

	return { snapshot, sources };
}
