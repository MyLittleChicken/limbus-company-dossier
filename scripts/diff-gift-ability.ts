/**
 * 두 판을 견줘 검수 우선순위를 낸다.
 *
 * 같은 설명문을 독립적으로 두 번 뽑으면 판단이 갈린 자리가 드러난다.
 * **전건을 다 보되**(2026-08-11 사용자 확정) 어긋난 것부터 본다 — 회차의
 * 앞쪽에 어려운 것을 두면 뒤로 갈수록 빨라진다.
 *
 * 실행: npm run gift:diff
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PASS1 = 'src/v2/authored/gift-ability.pass1.jsonl';
const PASS2 = 'src/v2/authored/gift-ability.pass2.jsonl';
const OUT = 'src/v2/authored/gift-ability.priority.json';

const read = (path: string): Map<string, string> => {
	const m = new Map<string, string>();
	if (!existsSync(path)) return m;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const t = line.trim();
		if (t === '') continue;
		const o = JSON.parse(t) as { giftId: string; level: number; ordinal: number; note?: string };
		// note 는 견주지 않는다 — 설명이 달라도 판정이 같으면 같은 것이다
		const { note: _note, ...rest } = o;
		m.set(`${o.giftId}\t${o.level}\t${o.ordinal}`, JSON.stringify(rest));
	}
	return m;
};

const p1 = read(PASS1);
const p2 = read(PASS2);
if (p1.size === 0 && p2.size === 0) {
	console.error(`두 판이 다 비어 있다. 먼저 ${PASS1} · ${PASS2} 를 만들어라 (npm run gift:extract)`);
	process.exit(1);
}

const keys = [...new Set([...p1.keys(), ...p2.keys()])].sort();
const only1: string[] = [];
const only2: string[] = [];
const differ: string[] = [];
for (const k of keys) {
	const a = p1.get(k);
	const b = p2.get(k);
	if (a === undefined) only2.push(k);
	else if (b === undefined) only1.push(k);
	else if (a !== b) differ.push(k);
}

/** 기프트 단위로 모은다 — 검수는 기프트 하나가 한 화면이다 */
const giftOf = (k: string): string => k.split('\t')[0];
const suspect = [...new Set([...only1, ...only2, ...differ].map(giftOf))].sort();

console.log(`능력 열쇠  1판 ${p1.size} · 2판 ${p2.size}`);
console.log(`  1판에만 ${only1.length} · 2판에만 ${only2.length} · 내용이 다름 ${differ.length}`);
console.log(`어긋난 기프트 ${suspect.length}`);

writeFileSync(OUT, `${JSON.stringify(suspect, null, '\t')}\n`, 'utf8');
console.log(`→ ${OUT} (검수 우선순위 — 페이지가 이 순서로 앞에 둔다)`);
