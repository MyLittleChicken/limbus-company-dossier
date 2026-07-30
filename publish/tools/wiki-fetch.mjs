/**
 * 위키 완성 카드를 전부 받는다. 대조 확인 목적이며 저장소에 넣지 않는다.
 * 이미 받은 것은 건너뛴다.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';


const OUT = join(CACHE, 'cards');
mkdirSync(OUT, { recursive: true });

const rows = JSON.parse(readFileSync(join(CACHE, 'wiki-survey.json'), 'utf8'));
const targets = rows.filter((r) => r.wiki?.exists && r.wiki.url);

let got = 0;
let skip = 0;
let fail = 0;

for (const r of targets) {
	const file = join(OUT, `${r.id}.png`);
	if (existsSync(file)) { skip++; continue; }
	try {
		const res = await fetch(r.wiki.url, { headers: { 'User-Agent': 'limbus-dossier-asset-audit/1.0' } });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		writeFileSync(file, Buffer.from(await res.arrayBuffer()));
		got++;
	} catch (e) {
		fail++;
		console.log(`FAIL ${r.id} ${r.ko} — ${e.message}`);
	}
	await new Promise((s) => setTimeout(s, 120));
}

console.log(`받음 ${got} · 이미 있음 ${skip} · 실패 ${fail} · 대상 ${targets.length}`);
