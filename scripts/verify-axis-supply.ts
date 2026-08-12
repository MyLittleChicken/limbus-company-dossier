/**
 * `identity_axis` 와 `coin_token` 이 축 공급을 두고 어긋나는가.
 *
 * 스펙 §8 이 「Profile 이 편성 공급을 coin_token 으로 센다」고 적었다. 그 근거가
 * 서려면 두 층이 실제로 어긋나야 한다. 조사만 한다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';

const prisma = new PrismaClient();

/** identity_axis 가 말하는 (인격, 축) — E.G.O 조건부는 뺀다(장착해야 생긴다) */
const claimed = await prisma.$queryRaw<Array<{ identityId: string; axisId: string; source: string }>>`
  SELECT identity_id AS "identityId", axis_id AS "axisId", source
  FROM canonical.identity_axis
  WHERE ego_id = ''
`;

/** coin_token 이 말하는 (인격, 축) — 스킬이 실제로 그 상태를 주는가 */
const actual = await prisma.$queryRaw<Array<{ identityId: string; axisId: string; skills: bigint }>>`
  SELECT i.identity_id AS "identityId", sc.category AS "axisId",
         count(DISTINCT ct.skill_id) AS skills
  FROM canonical.identity_skill i
  JOIN canonical.coin_token ct ON ct.skill_id = i.skill_id AND ct.kind = 'status'
  JOIN canonical.status_category sc ON sc.status_id = ct.status_id
  JOIN canonical.axis a ON a.id = sc.category
  GROUP BY 1, 2
`;

const actualKey = new Set(actual.map((r) => `${r.identityId}\t${r.axisId}`));
const claimedKey = new Set(claimed.map((r) => `${r.identityId}\t${r.axisId}`));

const overclaim = claimed.filter((r) => !actualKey.has(`${r.identityId}\t${r.axisId}`));
const missed = actual.filter((r) => !claimedKey.has(`${r.identityId}\t${r.axisId}`));

console.log(`identity_axis 가 말하는 (인격,축)  ${claimed.length}`);
console.log(`coin_token 이 뒷받침하는 (인격,축) ${actual.length}`);
console.log();
console.log(`identity_axis 만 말한다 (스킬 근거 없음)  ${overclaim.length}`);
const bySource = new Map<string, number>();
for (const r of overclaim) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
for (const [s, n] of [...bySource].sort((a, b) => b[1] - a[1])) console.log(`    source=${s}  ${n}`);
console.log(`coin_token 만 말한다 (identity_axis 누락) ${missed.length}`);
console.log();

console.log('=== 호흡(BREATH) 만 따로 ===');
const cB = claimed.filter((r) => r.axisId === 'BREATH');
const aB = actual.filter((r) => r.axisId === 'BREATH');
console.log(`  identity_axis  ${cB.length}인격`);
console.log(`  coin_token     ${aB.length}인격`);
const aBset = new Set(aB.map((r) => r.identityId));
const over = cB.filter((r) => !aBset.has(r.identityId));
console.log(`  스킬 근거 없이 BREATH 를 가진다고 하는 인격 ${over.length}`);
console.log(`    ${over.slice(0, 20).map((r) => `${r.identityId}(${r.source})`).join(' ')}`);

console.log('\n=== 스킬 근거 없이 축을 가진다는 표본 12건 ===');
for (const r of overclaim.slice(0, 12)) {
	console.log(`  ${r.identityId}  ${r.axisId.padEnd(12)} source=${r.source}`);
}

await prisma.$disconnect();
process.exit(0);
