import { PrismaClient } from '../src/v2/generated/client';

/**
 * 캐노니컬 층 Prisma Client.
 *
 * `lib/db.ts` 의 것과 **다른 클라이언트다.** 현행은 `public` 스키마를, 이쪽은
 * `raw` · `canonical` · `app` 을 쓴다(`prisma/v2/schema.prisma`). 같은 데이터베이스
 * 안에서 병존하며, 화면이 어느 층을 읽는지가 import 로 드러난다.
 *
 * 목록 화면부터 이쪽으로 옮긴다 — 캐노니컬이 시즌·출시일처럼 현행 스키마가 내려주지
 * 않던 값을 갖고 있기 때문이다.
 *
 * 개발 서버는 파일이 바뀔 때마다 모듈을 다시 평가한다. 전역에 붙여두지 않으면 그때마다
 * 새 커넥션 풀이 생겨 연결이 고갈된다 — `lib/db.ts` 와 같은 이유다.
 */
const globalForCanonical = globalThis as unknown as { canonical?: PrismaClient };

export const canonical = globalForCanonical.canonical ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForCanonical.canonical = canonical;
