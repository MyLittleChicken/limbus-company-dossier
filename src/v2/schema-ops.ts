/**
 * 스키마 이름 조작의 공통부.
 *
 * **SQL 문자열을 만드는 것과 실행하는 것을 가른다.** 만드는 쪽은 순수 함수라
 * DB 없이 테스트한다 — CI 는 데이터베이스를 쓰지 않는다.
 */
import type { PrismaClient } from './generated/client.js';

export function emptyRequiredMessage(n: number): string {
	return [
		`canonical 에 테이블이 ${n}개 있다. 적재기는 빈 canonical 에만 굽는다.`,
		'살아있는 판을 지우지 않기 위한 가드다(설계 결정 4).',
		'새로 구우려면 npm run v2:build 를 쓴다 — 살아있는 판을 먼저 옆으로 치운다.',
	].join('\n');
}

export async function tableCount(prisma: PrismaClient, schema: string): Promise<number> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n FROM information_schema.tables
		WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
	`;
	return Number(rows[0]?.n ?? 0n);
}

/**
 * 스키마 이름은 식별자라 파라미터로 못 넘긴다. 문자열로 박아야 하므로
 * **모양을 좁혀서 주입을 막는다.** 우리가 쓰는 이름은 소문자·숫자·밑줄뿐이다.
 */
function ident(name: string): string {
	if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`스키마 이름이 이상하다: ${name}`);
	return `"${name}"`;
}

export function renameSchema(from: string, to: string): string {
	return `ALTER SCHEMA ${ident(from)} RENAME TO ${ident(to)}`;
}

export async function schemaExists(prisma: PrismaClient, name: string): Promise<boolean> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n FROM information_schema.schemata WHERE schema_name = ${name}
	`;
	return Number(rows[0]?.n ?? 0n) > 0;
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
