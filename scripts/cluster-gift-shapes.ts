/**
 * 설명문을 **문형으로 묶는다**. 456건을 하나씩 판단하지 않기 위해서다.
 *
 * 같은 문형이면 같은 규칙으로 절을 나눌 수 있다. 그러면 검수가 「이 그룹의
 * 규칙이 맞나」 한 번으로 끝나고, 그룹에서 벗어나는 것만 개별로 본다.
 *
 * **판단하지 않는다 — 세기만 한다.** 어떤 문형이 어떤 절 구조가 되는지는
 * 사람이 정하고, 이 도구는 그 사람이 무엇을 봐야 하는지를 좁혀 준다.
 *
 * 실행: npm run gift:shapes
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { SHAPES, shapeKeysOf } from './gift-shapes.js';

const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/gift-shapes.md';

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id
`;

/** 문단 수 — 절이 몇 개쯤 될지의 밑그림이다 */
const paraCount = (d: string): number =>
	d.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '').length;

interface Row { giftId: string; name: string; keys: string[]; paras: number; desc: string }
const analyzed: Row[] = rows.map((r) => ({
	giftId: r.giftId,
	name: r.name,
	keys: shapeKeysOf(r.desc),
	paras: paraCount(r.desc),
	desc: r.desc,
}));

// ── 표지별 개수 ─────────────────────────────────────────────
console.log(`기프트 ${analyzed.length} (level 0 · ko)\n`);
console.log('문형 표지별 개수');
for (const s of SHAPES) {
	const n = analyzed.filter((a) => a.keys.includes(s.key)).length;
	console.log(`  ${s.key.padEnd(10)} ${String(n).padStart(3)}  ${s.label}`);
}

// ── 표지 조합(=문형)별 묶음 ──────────────────────────────────
const byCombo = new Map<string, Row[]>();
for (const a of analyzed) {
	const k = a.keys.length === 0 ? '(표지 없음)' : a.keys.join('+');
	byCombo.set(k, [...(byCombo.get(k) ?? []), a]);
}
const combos = [...byCombo.entries()].sort((x, y) => y[1].length - x[1].length);

console.log(`\n문형 조합 ${combos.length}가지`);
console.log('  상위 15');
for (const [k, list] of combos.slice(0, 15)) {
	console.log(`  ${String(list.length).padStart(3)}건  ${k}`);
}
const big = combos.filter(([, l]) => l.length >= 5);
const covered = big.reduce((s, [, l]) => s + l.length, 0);
console.log(`\n5건 이상인 조합 ${big.length}가지가 ${covered}건 (${Math.round(covered / analyzed.length * 100)}%) 을 덮는다`);
console.log(`1건짜리 조합 ${combos.filter(([, l]) => l.length === 1).length}가지 — 개별로 봐야 한다`);

// ── 보고서 ──────────────────────────────────────────────────
const md: string[] = [
	'# 기프트 문형 묶음',
	'',
	'같은 문형이면 같은 규칙으로 절을 나눌 수 있다. 검수를 「이 그룹의 규칙이 맞나」로',
	'묶고, 그룹에서 벗어나는 것만 개별로 본다.',
	'',
	`기프트 ${analyzed.length} · 문형 조합 ${combos.length}가지`,
	'',
	'## 표지',
	'',
	'```',
	...SHAPES.map((s) => `${s.key.padEnd(10)} ${String(analyzed.filter((a) => a.keys.includes(s.key)).length).padStart(3)}  ${s.label}`),
	'```',
	'',
	'## 조합별',
	'',
];
for (const [k, list] of combos) {
	md.push(`### ${k}  —  ${list.length}건`, '');
	md.push(...list.slice(0, 40).map((a) => `- ${a.name} (${a.giftId}) · 문단 ${a.paras}`));
	if (list.length > 40) md.push(`- … 그 밖 ${list.length - 40}건`);
	md.push('');
	// 그룹의 규칙을 정하려면 실물을 봐야 한다 — 대표 하나를 전문으로 보인다
	const sample = list[0];
	md.push('대표 설명문', '', '```', sample.desc, '```', '', '---', '');
}
writeFileSync(out, md.join('\n'), 'utf8');
console.log(`\n→ ${out}`);

await prisma.$disconnect();
process.exit(0);
