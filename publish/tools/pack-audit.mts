/**
 * 팩 117 종 전수 감사.
 *
 * 목적은 "어느 팩이 화면에서 서로 구별되지 않는가"를 가리는 것이다. 기준은 둘이다.
 *   1. 스프라이트를 다른 팩과 공유하는가 (기반 그림이 같다)
 *   2. 보스 그림이 있는가 (창을 채울 것이 있다)
 *
 * 둘 다 아니면 그 팩은 같은 빈 봉지로 보인다.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { readdirSync, writeFileSync } from 'node:fs';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as { PrismaClient: new () => any };
const db = new PrismaClient();

const DIR = `${ROOT}/data/assets/packs/limbus-assets`;
const files = new Set(readdirSync(DIR).map((f) => f.replace(/\.webp$/i, '')));

const packs = await db.pack.findMany({
	orderBy: { id: 'asc' },
	include: {
		texts: { where: { locale: 'ko' } },
		bosses: { include: { encounter: { include: { targets: { include: { texts: true } } } } } },
	},
});

const bySprite = new Map<string, any[]>();
for (const p of packs) {
	const key = p.sprite ?? '(없음)';
	if (!bySprite.has(key)) bySprite.set(key, []);
	bySprite.get(key)!.push(p);
}

const rows = packs.map((p: any) => {
	const shared = bySprite.get(p.sprite ?? '(없음)')!.length;
	return {
		id: p.id,
		name: p.texts[0]?.name ?? null,
		category: p.category,
		sprite: p.sprite,
		base: p.sprite ? files.has(p.sprite) : false,
		boss: p.sprite ? files.has(`${p.sprite}_boss`) : false,
		shared,
		encounters: p.bosses.length,
		enemies: p.bosses.flatMap((b: any) =>
			b.encounter.targets.map((t: any) => t.texts.find((x: any) => x.locale === 'ko')?.name ?? t.texts[0]?.name ?? '?'),
		),
	};
});

const distinct = (r: any) => r.boss || r.shared === 1;

console.log('=== 요약 ===');
console.log(`팩 총계            ${rows.length}`);
console.log(`보스 그림 보유      ${rows.filter((r: any) => r.boss).length}`);
console.log(`스프라이트 단독      ${rows.filter((r: any) => r.shared === 1).length}`);
console.log(`구별 가능          ${rows.filter(distinct).length}`);
console.log(`구별 불가          ${rows.filter((r: any) => !distinct(r)).length}`);

console.log('\n=== 공유 스프라이트 (같은 기반 그림을 쓰는 묶음) ===');
for (const [sprite, group] of [...bySprite.entries()].filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length)) {
	const anyBoss = group.some((p: any) => files.has(`${p.sprite}_boss`));
	console.log(`\n${sprite}  (${group.length}종, boss=${anyBoss})`);
	for (const p of group) {
		const enemies = p.bosses.flatMap((b: any) =>
			b.encounter.targets.map((t: any) => t.texts.find((x: any) => x.locale === 'ko')?.name ?? t.texts[0]?.name ?? '?'),
		);
		console.log(`   ${p.id}  ${(p.texts[0]?.name ?? '(이름 없음)').padEnd(24)} ${p.category.padEnd(12)} 적:${enemies.length ? enemies.join(', ') : '-'}`);
	}
}

console.log('\n=== 구별 불가 목록 (전수) ===');
for (const r of rows.filter((r: any) => !distinct(r))) {
	console.log(`  ${r.id}  ${String(r.name).padEnd(24)} ${r.category.padEnd(12)} sprite=${r.sprite}  공유 ${r.shared}종`);
}

writeFileSync(
	`${CACHE}/pack-audit.json`,
	JSON.stringify(rows, null, 2),
);

await db.$disconnect();
