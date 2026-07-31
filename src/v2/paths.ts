/**
 * 신규 3스키마 데이터베이스의 경로 규약.
 *
 * 원본은 `data/entities/<계열>/<출처>/<파일>.json` 5단 구조다. 실측상 1,664파일이
 * 전부 이 깊이에 있으며 예외가 없다.
 *
 * 현행 `src/io.ts` 와 겹치는 상수가 있으나 **의도적으로 복제한다.** 신규 파이프라인이
 * 현행 코드에 의존하면 현행을 고칠 때 신규가 깨진다(스펙 0절 「병존」).
 */
import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';

/** 저장소 루트. `src/v2/` 의 두 단계 위다. */
export const ROOT = resolve(import.meta.dirname, '..', '..');

/** 원본 스냅샷 루트. 절대 쓰지 않는다. */
export const ENTITIES = join(ROOT, 'data', 'entities');

/** 수집하는 출처. `data/manifest.json` 의 `sources[].id` 중 현행 보유분이다. */
export const SOURCES = [
	'limbus-assets',
	'limbus-data-mj',
	'loc-en',
	'loc-ja',
	'loc-ko',
	'shared-library',
] as const;

export type Source = (typeof SOURCES)[number];

export interface EntityPath {
	/** 계열. 디렉토리 이름 그대로 쓴다 — gifts · identities · mirror-dungeon … */
	entity: string;
	/** 출처 식별자 */
	source: string;
	/** `data/entities/` 를 기준으로 한 상대경로. 기본키의 일부다 */
	srcPath: string;
	/** 확장자를 벗긴 파일 이름. 단일 객체 파일에서 id 가 된다 */
	stem: string;
}

/**
 * 절대경로를 계열·출처·상대경로로 가른다.
 *
 * 규약을 벗어나면 던진다. 조용히 넘기면 적재 누락이 숫자로만 드러나고
 * 어느 파일인지 알 수 없다.
 */
export function parseEntityPath(absPath: string): EntityPath {
	const rel = relative(ENTITIES, absPath);
	if (rel.startsWith('..')) throw new Error(`data/entities 바깥 경로: ${absPath}`);
	const parts = rel.split(sep);
	if (parts.length !== 3) {
		throw new Error(`경로 규약 위반 (계열/출처/파일 3단이어야 한다): ${absPath}`);
	}
	const [entity, source, file] = parts as [string, string, string];
	if (!file.endsWith('.json')) throw new Error(`JSON 이 아니다: ${absPath}`);
	return {
		entity,
		source,
		srcPath: parts.join('/'),
		stem: basename(file, '.json'),
	};
}

/** `data/entities` 아래의 모든 `.json` 을 절대경로로, 정렬해 낸다. */
export function listEntityFiles(): string[] {
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) walk(p);
			else if (name.endsWith('.json')) out.push(p);
		}
	};
	walk(ENTITIES);
	return out.sort();
}
