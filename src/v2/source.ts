/**
 * canonical 변환기의 입력 계층.
 *
 * **변환기는 파일을 읽지 않는다.** raw.raw_object 를 질의해 만든다 — 그래야 판정이
 * 뒤집혔을 때 파일이 아니라 DB 에서 재조사할 수 있다(스펙 2.1).
 *
 * payload 는 JSONB 라 타입이 없다. 아래 도우미로만 꺼낸다. 직접 캐스팅하면
 * 원본의 타입 흔들림(tier 가 "2" 와 2, portrait 가 정수와 문자열)에 걸린다.
 */
import type { PrismaClient } from './generated/client.js';

export interface RawRecord {
	id: string;
	payload: Record<string, unknown>;
}

export type RawIndex = Map<string, Record<string, unknown>>;

/** id 를 열쇠로 하는 맵. 중복이면 뒤에 온 것이 이긴다. */
export function indexRows(rows: RawRecord[]): RawIndex {
	const m: RawIndex = new Map();
	for (const r of rows) m.set(r.id, r.payload);
	return m;
}

/** 가장 최근 스냅샷 id. version 이 가장 큰 것이다. */
export async function latestSnapshotId(prisma: PrismaClient): Promise<string> {
	const s = await prisma.snapshot.findFirst({ orderBy: { version: 'desc' } });
	if (s === null) throw new Error('스냅샷이 없다. npm run v2:load 를 먼저 돌린다.');
	return s.id;
}

/**
 * 원본 파일 하나를 통째로 읽어 맵으로 준다.
 *
 * `srcPath` 로 좁힌다 — `(entity, id)` 만으로는 유일하지 않다(계획 1에서 확인한
 * 충돌 8,530건).
 */
export async function readSource(
	prisma: PrismaClient,
	snapshotId: string,
	srcPath: string,
): Promise<RawIndex> {
	const rows = await prisma.rawObject.findMany({
		where: { snapshotId, srcPath },
		select: { id: true, payload: true },
	});
	if (rows.length === 0) {
		throw new Error(`raw 에 ${srcPath} 가 없다. 적재를 확인한다.`);
	}
	return indexRows(
		rows.map((r) => ({ id: r.id, payload: (r.payload ?? {}) as Record<string, unknown> })),
	);
}

// ── payload 에서 값을 꺼내는 도우미 ────────────────────────────

/** 문자열. 빈 문자열은 값이 없는 것으로 본다(원본이 결손을 ""로 표현하는 곳이 있다). */
export function str(o: Record<string, unknown>, k: string): string | null {
	const v = o[k];
	return typeof v === 'string' && v.length > 0 ? v : null;
}

/** 숫자. 숫자 문자열도 받는다 — 원본이 tier 를 "2" 와 2 로 갈라 쓴다. */
export function num(o: Record<string, unknown>, k: string): number | null {
	const v = o[k];
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '') {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

/** 불리언. `true` 만 true 다. 키가 없으면 false. */
export function bool(o: Record<string, unknown>, k: string): boolean {
	return o[k] === true;
}

/** 배열. 배열이 아니면 빈 배열. */
export function arr(o: Record<string, unknown>, k: string): unknown[] {
	const v = o[k];
	return Array.isArray(v) ? v : [];
}

/** 문자열 배열. 원소를 문자열로 정규화하고 null·undefined 는 버린다. */
export function strArr(o: Record<string, unknown>, k: string): string[] {
	return arr(o, k)
		.filter((v) => v !== null && v !== undefined)
		.map((v) => String(v));
}

/** 여러 맵을 하나로 합친다. 뒤에 온 것이 이긴다. */
export function mergeIndexes(parts: RawIndex[]): RawIndex {
	const m: RawIndex = new Map();
	for (const part of parts) for (const [k, v] of part) m.set(k, v);
	return m;
}

/**
 * 한 계열·한 출처의 **모든 파일**을 합쳐 읽는다.
 *
 * 기프트 로케일이 30파일로 흩어져 있어 필요하다. `exclude` 는 파일명(basename)
 * 목록이며 성격이 다른 파일을 뺀다 — EgoGiftCategory 는 키워드 사전이고
 * MirrorDungeonEgoGiftLockedDesc 는 획득 문구라 기프트 본체와 섞으면 안 된다.
 */
export async function readSourceGroup(
	prisma: PrismaClient,
	snapshotId: string,
	entity: string,
	source: string,
	exclude: string[] = [],
): Promise<RawIndex> {
	const rows = await prisma.rawObject.findMany({
		where: { snapshotId, entity, source },
		select: { id: true, payload: true, srcPath: true },
	});
	if (rows.length === 0) throw new Error(`raw 에 ${entity}/${source} 가 없다`);
	const skip = new Set(exclude);
	return indexRows(
		rows
			.filter((r) => !skip.has(r.srcPath.split('/').pop() ?? ''))
			.map((r) => ({ id: r.id, payload: (r.payload ?? {}) as Record<string, unknown> })),
	);
}
