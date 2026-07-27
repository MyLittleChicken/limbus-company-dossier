import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client 단일 인스턴스.
 *
 * ADR-02 2절이 웹 서비스 코드도 Prisma Client 를 ORM 으로 쓰기로 정했고,
 * ADR-05 2절이 이 클라이언트로 PostgreSQL 을 직접 질의하기로 정했다.
 *
 * 개발 서버는 파일이 바뀔 때마다 모듈을 다시 평가한다. 전역에 붙여두지 않으면
 * 그때마다 새 커넥션 풀이 생겨 연결이 고갈된다.
 */
const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db = globalForDb.db ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;
