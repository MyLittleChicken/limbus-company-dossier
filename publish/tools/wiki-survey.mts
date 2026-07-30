/**
 * 팩 117 종 × 위키 카드 전수 조사.
 *
 * 우리 DB 의 영문 이름으로 위키 파일명(`{영문명} Theme Pack.png`)을 만들어 실재를 확인한다.
 * 목적은 둘이다 — 보스 그림이 없는 팩을 위키가 채워 줄 수 있는지, 그리고 위키 카드에
 * 이름이 인쇄되는 것이 전 계열 공통인지.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as { PrismaClient: new () => any };
const db = new PrismaClient();

const DIR = `${ROOT}/data/assets/packs/limbus-assets`;
const files = new Set(readdirSync(DIR).map((f) => f.replace(/\.webp$/i, '')));

const packs = await db.pack.findMany({ orderBy: { id: 'asc' }, include: { texts: true } });

const rows = packs.map((p: any) => {
	const ko = p.texts.find((t: any) => t.locale === 'ko')?.name ?? null;
	const en = p.texts.find((t: any) => t.locale === 'en')?.name ?? null;
	return {
		id: p.id,
		ko,
		en,
		category: p.category,
		sprite: p.sprite,
		boss: p.sprite ? files.has(`${p.sprite}_boss`) : false,
	};
});

/** MediaWiki 는 한 번에 50 제목까지 받는다. */
async function probe(titles: string[]) {
	const out: Record<string, { exists: boolean; width?: number; height?: number; url?: string }> = {};
	for (let i = 0; i < titles.length; i += 40) {
		const batch = titles.slice(i, i + 40);
		const url =
			'https://limbuscompany.wiki.gg/api.php?action=query&format=json&prop=imageinfo' +
			'&iiprop=url|size|dimensions&titles=' +
			encodeURIComponent(batch.map((t) => `File:${t}`).join('|'));
		const res = await fetch(url, { headers: { 'User-Agent': 'limbus-dossier-asset-audit/1.0' } });
		if (!res.ok) throw new Error(`위키 API ${res.status}`);
		const json: any = await res.json();
		for (const page of Object.values<any>(json.query?.pages ?? {})) {
			const title = String(page.title).replace(/^File:/, '');
			const info = page.imageinfo?.[0];
			out[title] = info
				? { exists: true, width: info.width, height: info.height, url: info.url }
				: { exists: false };
		}
		await new Promise((r) => setTimeout(r, 400));
	}
	return out;
}

const candidates = rows.filter((r: any) => r.en).map((r: any) => `${r.en} Theme Pack.png`);
console.log(`영문 이름 보유 ${candidates.length} / ${rows.length}`);

const result = await probe(candidates);

let hit = 0;
const misses: any[] = [];
const dims = new Map<string, number>();
for (const r of rows) {
	if (!r.en) { misses.push({ ...r, why: '영문 이름 없음' }); continue; }
	const key = `${r.en} Theme Pack.png`;
	const info = result[key];
	(r as any).wiki = info ?? { exists: false };
	if (info?.exists) {
		hit++;
		const d = `${info.width}x${info.height}`;
		dims.set(d, (dims.get(d) ?? 0) + 1);
	} else {
		misses.push({ ...r, why: '위키 파일 없음' });
	}
}

console.log(`위키 카드 확인 ${hit} / ${rows.length}`);
console.log('치수 분포: ' + [...dims.entries()].map(([d, n]) => `${d}×${n}`).join('  '));

console.log(`\n=== 위키에서 못 찾은 것 (${misses.length}) ===`);
for (const m of misses) console.log(`  ${m.id}  ${String(m.ko).padEnd(24)} ${String(m.en).padEnd(34)} ${m.why}`);

console.log('\n=== 보스 그림이 없는 팩의 위키 상태 ===');
for (const r of rows.filter((r: any) => !r.boss)) {
	const w = (r as any).wiki;
	console.log(`  ${r.id}  ${String(r.ko).padEnd(22)} ${r.category.padEnd(12)} wiki=${w?.exists ? `${w.width}x${w.height}` : '없음'}`);
}

writeFileSync(
	`${CACHE}-survey.json`,
	JSON.stringify(rows, null, 2),
);

await db.$disconnect();
