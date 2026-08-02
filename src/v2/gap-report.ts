/**
 * 결손 대장을 작업 지시서로 뽑는다.
 *
 * canonical.field_gap 은 DB 안에만 있어 읽기 어렵다. 이것을 markdown 으로 내면
 * **사용자가 게임에서 확인해 채울 목록**이 된다(스펙 3.4).
 *
 * 실행: npm run v2:gap-report
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from './generated/client.js';
import { ROOT } from './paths.js';

const OUT = join(ROOT, 'build', 'gap-report.md');
const SAMPLE = 30;

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	const lines: string[] = [];
	try {
		const snapshot = await prisma.snapshot.findFirst({ orderBy: { version: 'desc' } });
		const total = await prisma.fieldGap.count();
		const groups = await prisma.fieldGap.groupBy({
			by: ['entity', 'field', 'locale'],
			_count: { _all: true },
			orderBy: { _count: { entity: 'desc' } },
		});

		lines.push('# 결손 대장 — 채워야 하는 것');
		lines.push('');
		lines.push(`> 스냅샷 \`${snapshot?.id ?? '?'}\` · 결손 **${total.toLocaleString()}건**`);
		lines.push('> 이 파일은 생성물이다. `npm run v2:gap-report` 로 다시 만든다.');
		lines.push('');
		lines.push('## 채우는 법');
		lines.push('');
		lines.push('1. 게임에서 값을 확인한다');
		lines.push('2. `app.field_override` 에 넣는다');
		lines.push('');
		lines.push('```sql');
		lines.push('INSERT INTO app.field_override (entity, entity_id, field, locale, value, note)');
		lines.push('VALUES (\'status\', \'FullCharon\', \'name\', \'ko\', \'"완전한 카론"\'::jsonb,');
		lines.push('        \'게임에서 직접 확인 2026-08-02\');');
		lines.push('```');
		lines.push('');
		lines.push('3. `npm run v2:canonical` 을 다시 돌린다');
		lines.push('');
		lines.push('**보정은 재적재에 살아남는다.** `app` 스키마는 `TRUNCATE` 범위 밖이다.');
		lines.push('덮은 값은 `canonical.field_source.rule = \'manual\'` 로 기록된다.');
		lines.push('');
		lines.push('## 요약');
		lines.push('');
		lines.push('| 계열 | 필드 | 로케일 | 건수 |');
		lines.push('| --- | --- | --- | ---: |');
		for (const g of groups) {
			lines.push(
				`| \`${g.entity}\` | \`${g.field}\` | ${g.locale === '' ? '—' : g.locale} | ${g._count._all.toLocaleString()} |`,
			);
		}
		lines.push('');

		for (const g of groups) {
			const rows = await prisma.fieldGap.findMany({
				where: { entity: g.entity, field: g.field, locale: g.locale },
				orderBy: { entityId: 'asc' },
				take: SAMPLE,
			});
			const head = `## \`${g.entity}.${g.field}\`${g.locale === '' ? '' : ` (${g.locale})`} — ${g._count._all.toLocaleString()}건`;
			lines.push(head);
			lines.push('');
			lines.push(`> ${rows[0]?.reason ?? ''}`);
			lines.push(`> 근거 \`${rows[0]?.evidence ?? ''}\``);
			lines.push('');
			lines.push('| id |');
			lines.push('| --- |');
			for (const r of rows) lines.push(`| \`${r.entityId}\` |`);
			if (g._count._all > SAMPLE) {
				lines.push('');
				lines.push(`… 그 밖 ${(g._count._all - SAMPLE).toLocaleString()}건. 전량은 SQL 로 본다.`);
				lines.push('');
				lines.push('```sql');
				lines.push(`SELECT entity_id FROM canonical.field_gap`);
				lines.push(
					`WHERE entity = '${g.entity}' AND field = '${g.field}' AND locale = '${g.locale}';`,
				);
				lines.push('```');
			}
			lines.push('');
		}
	} finally {
		await prisma.$disconnect();
	}

	mkdirSync(join(ROOT, 'build'), { recursive: true });
	writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
	console.log(`결손 대장을 썼다 — ${OUT}`);
}

await main();
