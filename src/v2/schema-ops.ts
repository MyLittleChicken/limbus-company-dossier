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
