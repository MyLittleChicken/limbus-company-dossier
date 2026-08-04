/**
 * 골든 테스트가 DB 에 닿는지 본다.
 *
 * **CI 는 데이터베이스를 쓰지 않는다**(`.github/workflows` 의 「단위 테스트 —
 * 데이터베이스도 브라우저도 쓰지 않는다」). 골든은 적재된 `canonical` 을 읽어
 * 실제 답을 확인하는 것이라 개발 기계에서만 돈다.
 *
 * `data/entities` 가 없으면 건너뛰는 `hasSnapshot()` 과 같은 성격이다 —
 * 없는 것을 실패로 세지 않되, **건너뛴 사실은 보고에 남는다.**
 */
import { PrismaClient } from '../generated/client.js';

export const NO_DB = 'DATABASE_URL 로 canonical 에 못 닿는다 (CI 는 DB 를 쓰지 않는다)';

export async function canonicalReachable(prisma: PrismaClient): Promise<boolean> {
	try {
		// 뷰까지 확인한다. 테이블만 보면 v_identity_capability 가 없는 상태를 놓친다
		await prisma.$queryRaw`SELECT 1 FROM canonical.v_identity_capability LIMIT 1`;
		return true;
	} catch {
		return false;
	}
}
