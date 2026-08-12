/**
 * 거울 던전 기프트 456건의 설명문을 한 파일로 낸다. 읽기 위한 것이다.
 *
 * 정규식 표지로 묶는 것은 분류가 아니다 — 「출혈**또는** 특수 출혈」의 「또는」을
 * 조건 OR 로 세는 식의 오분류가 난다(2026-08-12). 사람이(또는 에이전트가)
 * 전문을 읽고 일관된 기준으로 갈라야 한다.
 *
 * 실행: npx tsx scripts/dump-all-descs.ts /tmp/all-descs.md
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';

const out = process.argv[2] ?? '/tmp/all-descs.md';
const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string; levels: number }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc",
	       (SELECT count(*)::int FROM canonical.gift_stage_text x
	        WHERE x.gift_id = t.gift_id AND x.locale = 'ko') AS levels
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id
`;

const lines: string[] = [`# 거울 던전 기프트 설명문 ${rows.length}건 (level 0 · ko)`, ''];
for (const [i, r] of rows.entries()) {
	const paras = r.desc.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');
	lines.push(`## [${i + 1}] ${r.name} · ${r.giftId} · 문단 ${paras.length}${r.levels > 1 ? ` · 강화 ${r.levels}단계` : ''}`);
	for (const [j, p] of paras.entries()) lines.push(`(${j + 1}) ${p.replace(/\n/g, ' ⏎ ')}`);
	lines.push('');
}
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`${rows.length}건 → ${out} (${lines.length}줄)`);

await prisma.$disconnect();
process.exit(0);
