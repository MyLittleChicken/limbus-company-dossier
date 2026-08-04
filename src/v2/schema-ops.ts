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
