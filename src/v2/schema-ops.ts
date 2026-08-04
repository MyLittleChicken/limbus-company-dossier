/**
 * 스키마 이름 조작의 공통부.
 *
 * **SQL 문자열을 만드는 것과 실행하는 것을 가른다.** 만드는 쪽은 순수 함수라
 * DB 없이 테스트한다 — CI 는 데이터베이스를 쓰지 않는다.
 */
import type { Prisma } from './generated/client.js';

/**
 * 이 파일의 DB 함수들은 전부 `Prisma.TransactionClient` 를 받는다 — `PrismaClient`
 * 가 아니다. `TransactionClient` 는 `Omit<PrismaClient, 트랜잭션 전용이 아닌 메서드
 * 몇 개>` 라 **`PrismaClient` 값은 그대로 여기 넘길 수 있다**(구조적으로 상위집합).
 * 반대로 v2:diff(diff-canonical.ts)처럼 `prisma.$transaction(async (tx) => …)`
 * 안에서 받은 `tx` 도 그대로 넘길 수 있다 — 좁은 타입을 요구해야 양쪽 다 받는다.
 */
type QueryClient = Prisma.TransactionClient;

/**
 * `canonical` 이 비어 있지 않을 때 적재기가 던지는 메시지 — 무엇이 문제인지
 * (행이 있다) · 왜 막는지(결정 4, 살아있는 판 보호) · 어떻게 하는지(v2:build)
 * 세 줄 구조. 테이블 개수가 아니라 「데이터가 있다」는 사실 자체를 담으므로
 * 인자가 없다 — v2:build 3단계 직후는 테이블이 94개라도 행이 0개라 여기 안
 * 걸린다(아래 `hasAnyRow` 참고).
 */
export function emptyRequiredMessage(): string {
	return [
		'canonical 에 이미 행이 있다. 적재기는 빈 canonical 에만 굽는다.',
		'살아있는 판을 지우지 않기 위한 가드다(설계 결정 4).',
		'새로 구우려면 npm run v2:build 를 쓴다 — 살아있는 판을 먼저 옆으로 치운다.',
	].join('\n');
}

export async function tableCount(prisma: QueryClient, schema: string): Promise<number> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n FROM information_schema.tables
		WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
	`;
	return Number(rows[0]?.n ?? 0n);
}

/**
 * 스키마 이름도 테이블 이름도 식별자라 파라미터로 못 넘긴다. 문자열로 박아야
 * 하므로 **모양을 좁혀서 주입을 막는다.** 우리가 쓰는 이름은 소문자·숫자·
 * 밑줄뿐이다 — 스키마 이름 전용이 아니라 두 종류 다 여기를 거친다.
 *
 * export 한다 — v2:diff(diff-canonical.ts)가 `wip`·`canonical` 사이를 오가며
 * 테이블·컬럼 이름을 SQL 에 직접 박을 때 이 검사를 그대로 재사용한다.
 */
export function ident(name: string): string {
	if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`식별자가 이상하다: ${name}`);
	return `"${name}"`;
}

export async function schemaExists(prisma: QueryClient, name: string): Promise<boolean> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n FROM information_schema.schemata WHERE schema_name = ${name}
	`;
	return Number(rows[0]?.n ?? 0n) > 0;
}

/**
 * `schema` 에 행이 하나라도 있는지 — **테이블 존재가 아니라 행 존재**를 본다.
 *
 * `tableCount` 로는 「갓 구운 빈 판」과 「살아있는 판」을 못 가른다 — 둘 다 테이블
 * 94개다. v2:build 3단계(DDL) 직후는 테이블 94·행 0, 살아있는 판은 테이블 94·행
 * 152,399 다. 위험의 실체는 "테이블이 있다"가 아니라 "데이터가 있다"이므로 행을
 * 본다.
 *
 * `pg_stat_user_tables.n_live_tup` 같은 추정치는 안 쓴다 — ANALYZE 시점에 따라
 * 틀리고, 가드가 틀린 값으로 통과하면 그게 최악이다. 테이블마다 `EXISTS` 로
 * 직접 묻고, 하나라도 참이면 즉시 멈춘다(94개를 다 돌 필요가 없다).
 *
 * 스키마 자체가 없으면 테이블 목록이 그냥 비어서 조용히 `false` 가 나온다 —
 * 호출자가 "비었다"로 오해하고 지나가면 뒤에서 Prisma 원시 오류로 죽는다.
 * 먼저 `schemaExists` 로 보고, 없으면 그 사실을 말하는 오류를 던진다.
 */
export async function hasAnyRow(prisma: QueryClient, schema: string): Promise<boolean> {
	if (!(await schemaExists(prisma, schema))) {
		throw new Error(`스키마 "${schema}" 가 아예 없다. hasAnyRow 는 있는 스키마의 행만 잰다.`);
	}
	const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
	`;
	for (const { table_name } of tables) {
		const rows = await prisma.$queryRawUnsafe<Array<{ e: boolean }>>(
			`SELECT EXISTS (SELECT 1 FROM ${ident(schema)}.${ident(table_name)}) AS e`,
		);
		if (rows[0]?.e) return true;
	}
	return false;
}

export function renameSchema(from: string, to: string): string {
	return `ALTER SCHEMA ${ident(from)} RENAME TO ${ident(to)}`;
}

export async function exactCount(
	prisma: QueryClient,
	schema: string,
	table: string,
): Promise<number> {
	const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
		`SELECT count(*)::bigint AS n FROM ${ident(schema)}.${ident(table)}`,
	);
	return Number(rows[0]?.n ?? 0n);
}

// ── app 이 canonical 을 참조하는 세 갈래 (설계 3.2) ──────────────────────────
//
// ```
// app.run.difficulty   →  canonical."Difficulty"   enum 타입
// app.run_floor        →  canonical.pack           FK
// app.run_gift         →  canonical.gift           FK
// ```
//
// 스키마 이름을 바꾸면 이 의존이 **따라간다**(설계 3.3 실측 — PostgreSQL 이 의존을
// 이름이 아니라 OID 로 들고 있어서다). 그래서 승격은 `app` 을 새 판으로 다시
// 겨눠야 한다. 안 하면 옛 판을 지우는 순간 `app` 이 깨진다.

/** `app` 이 `app` 밖을 참조하는 FK 하나. 이름도 정의문도 카탈로그에서 읽은 것 그대로다. */
export interface AppFk {
	table: string;
	name: string;
	/** 참조 대상 스키마 — 지금 교체하는 스키마인지 호출부가 가른다. */
	foreignSchema: string;
	/** `pg_get_constraintdef(oid)` 원문. 손대지 않는다. */
	def: string;
}

/** `app` 의 컬럼 하나가 쓰는 `app` 밖 타입. `format_type` 원문을 들고 다닌다. */
export interface AppTypeColumn {
	table: string;
	column: string;
	typeSchema: string;
	/** `format_type(atttypid, atttypmod)` 원문 — 대소문자 섞인 타입 이름이 이미 따옴표까지 붙어 나온다. */
	typeText: string;
}

/**
 * `app` 의 FK 를 뗐다 다시 붙이는 SQL.
 *
 * **정의문을 그대로 다시 쓴다.** `ON DELETE RESTRICT` 같은 옵션을 손으로 옮겨 적으면
 * 언젠가 하나를 빠뜨리고, 그러면 삭제 동작이 조용히 바뀐다. 그 사고는 실행 시점에
 * 아무 오류도 안 내므로 아무도 모른다.
 *
 * **왜 정의문을 그대로 다시 써도 새 판을 가리키나.** 정의문은 `REFERENCES
 * canonical.gift(id)` 처럼 스키마를 **이름으로** 담고 있고, 이름 풀이는 ADD 를
 * 실행하는 시점에 일어난다. 교체를 끝낸 뒤 붙이므로 그때 `canonical` 은 새 판이다
 * (실측으로 확인 — 임시 스키마로 같은 순서를 돌려 FK 가 새 판을 가리키는 것을 봤다).
 * 이름 한정이 없는 정의문이면 이 전제가 깨지므로 호출부가 `qualifiesSchema` 로 먼저
 * 막는다.
 *
 * 제약 이름은 `ident` 를 그대로 쓴다 — Prisma 가 만드는 이름은 소문자·밑줄뿐이다.
 * 어쩌다 대문자가 섞이면 여기서 던지는데, **모든 SQL 을 트랜잭션 밖에서 미리
 * 조립하므로** 그 실패는 DB 를 한 글자도 안 바꾼 상태에서 난다.
 */
export function rebindSql(fks: AppFk[]): { drop: string[]; add: string[] } {
	return {
		drop: fks.map((f) => `ALTER TABLE "app".${ident(f.table)} DROP CONSTRAINT ${ident(f.name)}`),
		add: fks.map((f) => `ALTER TABLE "app".${ident(f.table)} ADD CONSTRAINT ${ident(f.name)} ${f.def}`),
	};
}

/**
 * 컬럼 타입을 새 판의 같은 타입으로 다시 겨누는 SQL.
 *
 * **`app.run` 이 0행이어도 필요하다.** 행을 옮기려는 것이 아니라 컬럼이 어느
 * 스키마의 타입을 가리키는지를 바꾸는 것이다 — 옛 판의 타입을 계속 가리키면
 * `canonical_bak` 을 나중에 못 지운다(의존이 걸려 `DROP SCHEMA` 가 막힌다).
 *
 * `USING …::text::<타입>` 을 거치는 이유 — 옛 타입과 새 타입은 이름만 같지 서로
 * 다른 타입이라 PostgreSQL 이 직접 캐스팅을 못 찾는다. 라벨 문자열을 거치면
 * 라벨이 같은 값끼리 옮겨간다. **새 판에서 라벨이 사라졌으면 여기서 실패한다** —
 * 그것도 옳은 실패다(0행이면 검사할 값이 없어 그냥 통과한다).
 *
 * 타입 이름은 `format_type` 원문을 쓴다 — Prisma 의 enum 은 `"Difficulty"` 처럼
 * 대문자가 섞여 `ident` 의 모양 검사(소문자만)를 못 지난다. PostgreSQL 이 스스로
 * 찍어 준 문자열이라 따옴표도 이미 옳게 붙어 있다.
 */
export function retargetTypeSql(cols: AppTypeColumn[]): string[] {
	return cols.map(
		(c) =>
			`ALTER TABLE "app".${ident(c.table)} ALTER COLUMN ${ident(c.column)} TYPE ${c.typeText} ` +
			`USING ${ident(c.column)}::text::${c.typeText}`,
	);
}

/**
 * 정의문이 `schema` 를 **이름으로 한정**하고 있는지.
 *
 * `pg_get_constraintdef`·`format_type` 은 `search_path` 를 본다 — 대상 스키마가
 * `search_path` 에 들어 있으면 한정을 생략하고 `REFERENCES gift(id)` 로 찍는다.
 * 그런 정의문을 교체 뒤에 그대로 다시 실행하면 어느 판을 가리킬지 알 수 없다.
 * 지금 접속은 `?schema=public` 이라 늘 한정이 붙지만, **재부착이 옳은 판을 가리키는
 * 근거가 접속 문자열 하나**라면 그건 근거가 아니다. 승격 전에 직접 확인한다.
 *
 * 앞 문자를 함께 보는 이유 — `canonical_bak.gift` 는 `canonical` 로 시작하지만
 * 다른 스키마다. 마침표를 요구하고 앞에 식별자 문자가 없어야 통과시킨다.
 *
 * **따옴표를 친 한정형도 통과시킨다**(`"canonical".gift`). 이름에 대문자나 예약어가
 * 섞이면 PostgreSQL 이 따옴표를 붙여 찍는데, 그것도 완벽하게 한정된 정의문이다.
 * 처음엔 앞 문자 제외 목록에 `"` 를 넣었다가 2차 리뷰에서 잡혔다 — 앞 문자 검사가
 * 노리는 `mycanonical.` 은 `[A-Za-z]` 가 이미 막으므로 `"` 제외는 **얻는 것 없이
 * 멀쩡한 정의문을 거부하기만** 했다.
 */
export function qualifiesSchema(def: string, schema: string): boolean {
	return new RegExp(`(^|[^A-Za-z0-9_.])"?${schema}"?\\.`).test(def);
}

/**
 * `schema` **밖**에서 `schema` 안의 것을 참조하는 목록.
 *
 * `DROP SCHEMA … CASCADE` 는 이것들을 **말없이 같이 지운다.** 지우기 전에 세어서
 * 찍어야 「조용한 누락 금지」가 지켜진다 — 지운 뒤에는 무엇이 있었는지 알 방법이 없다.
 *
 * 설계 3.2 가 꼽은 세 갈래(FK · 컬럼 타입 · 뷰)를 각각 묻는다. `pg_depend` 를 통째로
 * 훑고 `pg_identify_object` 로 스키마를 알아내는 방법을 먼저 해 봤는데 못 쓴다 —
 * 규칙(`pg_rewrite`)과 컬럼 기본값(`pg_attrdef`)은 스키마가 `NULL` 로 나와서
 * **안쪽 의존이 전부 "밖"으로 잡힌다**(실측: 멀쩡한 canonical_bak 이 기본값 수십
 * 건으로 걸렸다). 그 두 카탈로그에 namespace 컬럼이 아예 없고 소유 테이블만
 * 가리키기 때문이다(toast 관계는 해당 없다 — `relnamespace = 'pg_toast'` 로 정상
 * 스키마를 갖는다). 세 갈래를 따로 물으면 그 착시가 없고 사람이 읽기도 낫다.
 */
export async function outsideDependents(prisma: QueryClient, schema: string): Promise<string[]> {
	const rows = await prisma.$queryRaw<Array<{ d: string }>>`
		SELECT 'FK ' || fn.nspname || '.' || fc.relname || ' · ' || co.conname AS d
		  FROM pg_constraint co
		  JOIN pg_class fc ON fc.oid = co.conrelid
		  JOIN pg_namespace fn ON fn.oid = fc.relnamespace
		  JOIN pg_class tc ON tc.oid = co.confrelid
		  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
		 WHERE co.contype = 'f' AND tn.nspname = ${schema} AND fn.nspname <> ${schema}
		UNION
		SELECT '타입 ' || n.nspname || '.' || c.relname || '.' || a.attname
		  FROM pg_attribute a
		  JOIN pg_class c ON c.oid = a.attrelid
		  JOIN pg_namespace n ON n.oid = c.relnamespace
		  JOIN pg_type t ON t.oid = a.atttypid
		  JOIN pg_namespace tn ON tn.oid = t.typnamespace
		 WHERE tn.nspname = ${schema} AND n.nspname <> ${schema}
		   AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
		UNION
		SELECT '뷰 ' || vn.nspname || '.' || v.relname
		  FROM pg_depend d
		  JOIN pg_rewrite rw ON rw.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
		  JOIN pg_class v ON v.oid = rw.ev_class
		  JOIN pg_namespace vn ON vn.oid = v.relnamespace
		  JOIN pg_class ref ON ref.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
		  JOIN pg_namespace refn ON refn.oid = ref.relnamespace
		 WHERE refn.nspname = ${schema} AND vn.nspname <> ${schema}
		 ORDER BY 1
	`;
	return rows.map((r) => r.d);
}

/**
 * `app` 이 `app` 밖을 참조하는 FK 를 카탈로그에서 읽는다. **실명을 하드코딩하지
 * 않는다** — 모델이 바뀌면 이름이 바뀐다.
 *
 * `fns.nspname <> 'app'` 이 핵심이다. `app` 안끼리의 FK 넷(`run_floor → app.run`,
 * `run_gift → app.run`, `run → app.account`, `setting → app.account`)은 스키마
 * 교체와 아무 상관이 없다 — 떼었다 붙이면 위험만 는다.
 */
export async function appDependencies(prisma: QueryClient): Promise<AppFk[]> {
	const rows = await prisma.$queryRaw<
		Array<{ table: string; name: string; foreignSchema: string; def: string }>
	>`
		SELECT cl.relname AS "table", co.conname AS "name",
		       fns.nspname AS "foreignSchema", pg_get_constraintdef(co.oid) AS "def"
		  FROM pg_constraint co
		  JOIN pg_class cl ON cl.oid = co.conrelid
		  JOIN pg_namespace ns ON ns.oid = cl.relnamespace
		  JOIN pg_class fcl ON fcl.oid = co.confrelid
		  JOIN pg_namespace fns ON fns.oid = fcl.relnamespace
		 WHERE co.contype = 'f' AND ns.nspname = 'app' AND fns.nspname <> 'app'
		 ORDER BY cl.relname, co.conname
	`;
	return rows;
}

/**
 * `app` 의 컬럼 중 `schema` 의 타입을 쓰는 것 — 지금은 `app.run.difficulty` 하나뿐이지만
 * 세어서 찾는다. 타입이 하나 늘었는데 여기 안 걸리면 `canonical_bak` 이 안 지워진다.
 *
 * `information_schema.columns` 대신 `pg_attribute` 를 보는 이유는 `format_type` 이
 * 필요해서다 — 타입 이름을 우리가 조립하지 않고 PostgreSQL 이 찍어 준 것을 쓴다.
 */
export async function appTypeColumns(
	prisma: QueryClient,
	schema: string,
): Promise<AppTypeColumn[]> {
	const rows = await prisma.$queryRaw<
		Array<{ table: string; column: string; typeSchema: string; typeText: string }>
	>`
		SELECT cl.relname AS "table", a.attname AS "column",
		       tns.nspname AS "typeSchema", format_type(a.atttypid, a.atttypmod) AS "typeText"
		  FROM pg_attribute a
		  JOIN pg_class cl ON cl.oid = a.attrelid
		  JOIN pg_namespace ns ON ns.oid = cl.relnamespace
		  JOIN pg_type t ON t.oid = a.atttypid
		  JOIN pg_namespace tns ON tns.oid = t.typnamespace
		 WHERE ns.nspname = 'app' AND tns.nspname = ${schema}
		   AND cl.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
		 ORDER BY cl.relname, a.attname
	`;
	return rows;
}

/**
 * `app` 이 새 판을 가리킬 수 있는지 보는 검사 둘 — 설계 6.2 의 "FK 재부착이 승격의
 * 검사 역할을 한다"를 **미리** 돌리는 것이다. v2:diff 가 예고로, v2:promote 가
 * 선검사로 같은 질의를 쓴다.
 */
export const APP_FK_CHECKS = [
	{ table: 'run_gift', fkColumn: 'gift_id', targetTable: 'gift' },
	{ table: 'run_floor', fkColumn: 'pack_id', targetTable: 'pack' },
] as const;

export interface AppIntegrityResult {
	total: number;
	/** true 면 `total` 이 0 이라 검사 자체를 안 돌렸다 — "문제 없음"과 구분해야 한다. */
	skipped: boolean;
	missingIds: string[];
}

/**
 * `app.<table>.<fkColumn>` 이 가리키는 값이 `<targetSchema>.<targetTable>.id` 에 다
 * 있는지.
 *
 * `total` 이 0 이면 질의 자체를 건너뛴다 — 지금 DB 상태가 바로 이 경우다
 * (`run_gift`·`run_floor` 둘 다 0행). **"0 행이라 검사가 아무 일도 안 한 것"과 "행이
 * 있는데 전부 통과한 것"을 호출부가 구분해서 찍어야 한다** — 조용히 "문제 없음"만
 * 찍으면 나중에 진짜 문제(가리키는 대상이 아예 없어 검사가 텅 빈 결과를 낸 경우)를
 * 놓친다. `skipped` 를 **반환 타입에** 따로 담아 그 구분을 문구가 아니라 구조로
 * 보장한다 — 호출부가 실수로 `missingIds.length === 0` 만 보고 두 경우를 섞어 찍을
 * 수 없다.
 *
 * `targetSchema` 를 받는 이유 — v2:diff 와 v2:promote 는 `wip` 을 보지만
 * v2:rollback 은 `canonical_bak` 을 본다. 되돌리기도 같은 이유로 실패할 수 있다
 * (승격 뒤에 새 판에만 있는 기프트를 가리키는 행이 들어왔다면).
 */
export async function appIntegrityCheck(
	prisma: QueryClient,
	check: { table: string; fkColumn: string; targetTable: string },
	targetSchema: string,
): Promise<AppIntegrityResult> {
	const total = await exactCount(prisma, 'app', check.table);
	if (total === 0) return { total: 0, skipped: true, missingIds: [] };

	const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
		`SELECT DISTINCT a.${ident(check.fkColumn)} AS ${ident('id')}
		   FROM ${ident('app')}.${ident(check.table)} a
		  WHERE NOT EXISTS (
		    SELECT 1 FROM ${ident(targetSchema)}.${ident(check.targetTable)} w
		     WHERE w.${ident('id')} = a.${ident(check.fkColumn)}
		  )`,
	);
	return { total, skipped: false, missingIds: rows.map((r) => r.id) };
}

/**
 * id 목록이 길면 앞부분만 찍는다 — v2:diff 가 사라진/새 개체나 무결성이 깨진
 * FK 값을 사람이 읽는 로그에 낼 때 쓴다. 수백 건이 통째로 로그를 덮으면 정작
 * 중요한 요약이 묻힌다.
 *
 * `limit` 개까지는 그대로 나열하고, 넘으면 잘라서 "… (총 N건)" 을 덧붙인다 —
 * 총 건수는 잘려도 알 수 있어야 한다. 경계는 `limit` 과 정확히 같을 때다:
 * `ids.length === limit` 이면 전부 나열되고 꼬리표는 안 붙는다(잘린 것이
 * 아니므로).
 */
export function formatIds(ids: string[], limit = 20): string {
	const shown = ids.slice(0, limit).join(', ');
	return ids.length > limit ? `${shown} … (총 ${ids.length}건)` : shown;
}

/**
 * `prisma/v2/schema.sql` 은 `raw`·`canonical`·`app` 세 스키마의 DDL 이 한 파일에
 * 섞여 있다(설계 9절). v2:build Step 1 에서 실측한 것 — `prisma migrate diff
 * --from-url` 로 "canonical 이 없을 때" 를 흉내 내려 하면 두 갈래로 막힌다.
 *
 *   1. 옆으로 치운 이름(`canonical_hold`)을 datasource 의 schemas 목록에 안 넣으면
 *      `app.run_floor` 가 그 이름을 가리키는 FK 때문에 P4002 로 죽는다
 *      (Cross schema references ... add `canonical_hold` to schemas).
 *   2. 넣어서 통과시키면, 그 이름 밑에 딸려 있는 살아있는 94테이블이 "목표
 *      데이터모델에 없는 여분"으로 잡혀 `DROP TABLE`/`DROP TYPE` 105건이 나온다.
 *      그대로 실행하면 살아있는 판을 지운다.
 *
 * 그래서 `--from-url` 은 못 쓴다. 대신 `--from-empty` 산물(`v2:schema:ddl` 이
 * 만드는 이 파일)을 문장 단위로 걸러 쓴다. **빈 상태에서 만드는 것이니 DROP 이
 * 애초에 없다.** 문장(주석 헤더로 시작하는 블록)마다 `"canonical"` 을 포함하고
 * `"app"`·`"raw"` 를 포함하지 않으면 채택한다.
 *
 * 실측(256개 블록 중 227개 순수 canonical·3개는 `app` 문장에 canonical 참조가
 * 섞여 있어 제외 — `app.run.difficulty` 컬럼과 `app.run_floor`/`run_gift` 의
 * FK. 그 재조준은 v2:promote 몫이다). `raw` 문장은 canonical 블록에 전혀
 * 섞이지 않는다 — raw 를 다시 만들려 들지 않는다.
 */
export function extractCanonicalDdl(fullDdl: string): string[] {
	return fullDdl
		.split(/(?=^-- [A-Z])/m)
		.map((block) => block.trim())
		.filter((block) => block.length > 0)
		.filter(
			(block) =>
				block.includes('"canonical"') && !block.includes('"app"') && !block.includes('"raw"'),
		);
}

/**
 * `extractCanonicalDdl` 이 걸러낸 것과 원본이 종류별로 몇 개씩 같은지 재는
 * 잣대다. **검사 203건은 행 수만 본다** — 인덱스나 FK 가 통째로 빠져도 걸리지
 * 않는다. 그 누락을 잡는 곳이 이 함수뿐이다.
 *
 * `build-canonical.ts` 가 원본 `fullDdl` 과 걸러낸 `statements` 양쪽에 이 함수를
 * 돌려 **서로** 비교한다 — 숫자를 여기 상수로 안 박는 이유다. 스키마가 자라면
 * 두 쪽 다 같이 자라니 "같다"만 참이면 된다.
 */
export function tallyCanonicalDdl(sql: string): Record<string, number> {
	const patterns: Record<string, RegExp> = {
		'CREATE TABLE "canonical".': /^CREATE TABLE "canonical"\./gm,
		'CREATE INDEX ... ON "canonical"': /^CREATE (?:UNIQUE )?INDEX .* ON "canonical"\./gm,
		// canonical 소유 테이블은 항상 "canonical"."table" 로 이어지므로 뒤에 `.` 을
		// 본다 — `\b` 는 안 된다. `"` 와 `.` 둘 다 비단어 문자라 그 사이엔 단어
		// 경계가 없어서 아예 매치가 0 이 되는 함정이 있었다(실측으로 잡음).
		'ALTER TABLE "canonical".': /^ALTER TABLE "canonical"\./gm,
		'CREATE TYPE "canonical".': /^CREATE TYPE "canonical"\./gm,
	};
	const out: Record<string, number> = {};
	for (const [label, re] of Object.entries(patterns)) {
		out[label] = (sql.match(re) ?? []).length;
	}
	return out;
}
