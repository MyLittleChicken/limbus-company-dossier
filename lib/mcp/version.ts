import { createHash } from 'node:crypto';
import { canonical } from '@/lib/db-canonical';
import { cacheReference } from '@/lib/query-cache';
import { getBuildInfo } from '@/lib/queries/canonical/reference';

/**
 * 데이터 기준 — `snapshotId`(사람이 읽는 스냅샷) 와 `dataVersion`(캐시 · 커서 키).
 *
 * **왜 snapshotId 만으로 모자라나.** 라이브 갱신은 `canonical.snapshot` 행을 바꾸지 않는다.
 * DB 를 보고 확인한 갱신 경로 둘(2026-11-23):
 *
 *   기프트·팩 미러  scripts/update/mirror.mts  — `field_source.snapshot_id` 에 `md-<후보 해시 20자>`
 *                   를 남긴다. 로컬 DB: `2026-07-25` 10,661 · `md-c3e5…` 5,015 · `md-e926…` 80 행.
 *                   적용 시각 열은 없다 → 「최신 update id」가 아니라 **표지 집합(id · 행 수)** 을 쓴다.
 *   인격·E.G.O     src/update/apply.ts         — 표지를 **아무 데도 남기지 않는다**(field_source ·
 *                   build_info · snapshot 모두 그대로). DB 쪽 유일한 흔적은 Postgres 의 표별
 *                   쓰기 누계(`pg_stat_user_tables` 의 n_tup_ins + n_tup_upd + n_tup_del)다.
 *
 * 그래서 dataVersion = `<snapshotId>.<해시 8자>`, 해시 재료 = field_source 표지 집합 + canonical
 * 쓰기 누계. 쓰기 누계는 통계 초기화 · 롤백된 쓰기에도 바뀌지만 그때는 캐시를 한 번 더 읽을
 * 뿐이다(헛 무효화는 안전, 놓친 무효화가 위험). MCP 경로는 canonical 에 쓰지 않으므로
 * 읽기로는 바뀌지 않는다. 통계를 못 읽는 권한이면 `w?` 로 두고 표지 집합만으로 간다.
 * 통계 반영 지연(PG15+ 최대 수 초)은 60 초 캐시보다 짧다.
 */
export interface ToolCtx {
	snapshotId: string | null;
	dataVersion: string;
}

/** 순수 함수 — 재료가 같으면 같은 판, 하나라도 다르면 다른 판. */
export function composeDataVersion(
	snapshotId: string | null,
	markers: ReadonlyArray<{ snapshotId: string; rows: number }>,
	writes: string,
): string {
	const material = [...markers]
		.sort((a, b) => (a.snapshotId < b.snapshotId ? -1 : a.snapshotId > b.snapshotId ? 1 : 0))
		.map((m) => `${m.snapshotId}=${m.rows}`)
		.join(',');
	const hash = createHash('sha256').update(`fs:${material}|w:${writes}`, 'utf8').digest('base64url').slice(0, 8);
	return `${snapshotId ?? 'none'}.${hash}`;
}

async function canonicalWrites(): Promise<string> {
	try {
		const rows = await canonical.$queryRaw<Array<{ w: bigint | number | null }>>`
			SELECT coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0)::bigint AS w
			FROM pg_stat_user_tables WHERE schemaname = 'canonical'`;
		return String(rows[0]?.w ?? 0);
	} catch {
		return '?';
	}
}

/** snapshotId 와 dataVersion 을 **한 번에** 읽어 1 분 둔다 — 둘이 서로 다른 시점을 가리키지 않게. */
const versionInfo = cacheReference(async (): Promise<ToolCtx> => {
	const [info, markers, writes] = await Promise.all([
		getBuildInfo(),
		canonical.$queryRaw<Array<{ snapshotId: string; rows: number }>>`
			SELECT snapshot_id AS "snapshotId", count(*)::int AS rows
			FROM canonical.field_source GROUP BY snapshot_id`,
		canonicalWrites(),
	]);
	const snapshotId = info?.snapshotId ?? null;
	return { snapshotId, dataVersion: composeDataVersion(snapshotId, markers, writes) };
}, 60_000);

/** 도구 호출 머리에 한 번 읽는 맥락. `defineTool` 이 부른다. */
export async function readToolCtx(): Promise<ToolCtx> {
	const { snapshotId, dataVersion } = await versionInfo();
	return { snapshotId, dataVersion };
}

/** DB 의 최신 스냅샷 id. 행이 없으면 `null`. 1 분 캐시. */
export async function currentSnapshotId(): Promise<string | null> {
	return (await versionInfo()).snapshotId;
}

/** 라이브 갱신까지 반영한 데이터 판. 1 분 캐시. */
export async function dataVersion(): Promise<string> {
	return (await versionInfo()).dataVersion;
}
