/**
 * 원본 읽기와 산출물 쓰기.
 *
 * 원본은 읽기 전용으로 다룬다(ADR-02 원칙 5). 이 모듈 밖에서 data/ 를 직접 열지 않는다.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** 저장소 루트. src/ 의 부모다. */
export const ROOT = resolve(import.meta.dirname, '..');

/** 원본 스냅샷. 절대 쓰지 않는다. */
export const DATA = join(ROOT, 'data');
export const ENTITIES = join(DATA, 'entities');

/** 정규화 산출물. 커밋하지 않는다(ADR-01 6절). */
export const OUT = join(ROOT, 'build', 'data');

/**
 * 정본 출처 식별자. ADR-04 2.1 의 배정과 1:1로 대응한다.
 * 문자열을 코드 곳곳에 흩지 않기 위해 여기서만 정의한다.
 */
export const SOURCE = {
	/** E.G.O · 기프트 · 합성 · 층별 팩 · 상태 · 소속 · 거울 던전 */
	assets: 'limbus-assets',
	/** 수감자 · 인격 · 스킬 · 패시브 · 테마 팩 · 죄악 · 키워드 */
	mj: 'limbus-data-mj',
	/** 표시 문자열 (한국어 정본) */
	ko: 'loc-ko',
	/** 표시 문자열 (영어, 결손 폴백 겸용) */
	en: 'loc-en',
} as const;

export type SourceId = (typeof SOURCE)[keyof typeof SOURCE];

/**
 * JSON 을 읽는다. UTF-8 BOM 이 있으면 제거한다.
 * 현행 스냅샷에서 BOM 보유 파일은 12개다.
 */
export function readJson<T = unknown>(...segments: string[]): T {
	const path = join(ENTITIES, ...segments);
	const raw = readFileSync(path, 'utf8');
	const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
	try {
		return JSON.parse(text) as T;
	} catch (cause) {
		throw new Error(`JSON 파싱 실패: ${path}`, { cause });
	}
}

/** 디렉토리 안의 JSON 파일을 전부 읽는다. 파일명(확장자 제외)을 키로 돌려준다. */
export function readJsonDir<T = unknown>(...segments: string[]): Map<string, T> {
	const dir = join(ENTITIES, ...segments);
	const out = new Map<string, T>();
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (!name.endsWith('.json')) continue;
		out.set(name.slice(0, -'.json'.length), readJson<T>(...segments, name));
	}
	return out;
}

/** 접두어로 시작하는 JSON 파일들을 읽는다. 로컬라이즈처럼 파일이 쪼개진 경우에 쓴다. */
export function readJsonGlob<T = unknown>(segments: string[], prefix: string): T[] {
	const dir = join(ENTITIES, ...segments);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((n) => n.startsWith(prefix) && n.endsWith('.json'))
		.sort()
		.map((n) => readJson<T>(...segments, n));
}

/**
 * 테이블 하나를 파일 하나로 쓴다(ADR-01 제약 1).
 * 키 순서를 고정해 같은 입력이면 같은 바이트가 나오게 한다(ADR-02 원칙 3).
 */
export function writeTable(name: string, rows: readonly unknown[]): void {
	const path = join(OUT, `${name}.json`);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(rows, null, '\t')}\n`, 'utf8');
}

/**
 * 레코드 목록을 꺼낸다.
 *
 * **같은 출처 안에서도 컨테이너가 다르다** — mj 의 `identities.json` 은 배열이고
 * `identities_detail.json` 은 객체다. 호출 측이 매번 분기하지 않도록 여기서 흡수한다.
 */
export function toRecords<T>(source: Record<string, T> | T[] | null | undefined): T[] {
	if (source === null || source === undefined) return [];
	return Array.isArray(source) ? source : Object.values(source);
}

/** 게임 로컬라이즈 파일의 공통 껍데기. 최상위가 dataList 하나뿐이다. */
export interface DataList<T> {
	dataList?: T[];
}

/** dataList 를 평탄화해 꺼낸다. */
export function flattenDataList<T>(files: readonly DataList<T>[]): T[] {
	return files.flatMap((f) => f.dataList ?? []);
}
