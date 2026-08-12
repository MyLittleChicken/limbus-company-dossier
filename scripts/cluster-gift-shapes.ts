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

const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/gift-shapes.md';

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id
`;

/**
 * 문형 표지. **절을 어떻게 나눌지가 갈리는 것만 본다** — 효과가 무엇인지는
 * 안 본다(그건 크기이고 이 스펙의 비목표다).
 */
interface Shape { key: string; label: string; test: (d: string) => boolean }
const SHAPES: Shape[] = [
	{
		key: 'GATE', label: '첫 문단이 「…이면 발동」 — 소속·인원 게이트',
		test: (d) => /발동/.test((d.split(/\n\s*\n/)[0] ?? '')) && /이상|이면|일 때/.test(d.split(/\n\s*\n/)[0] ?? ''),
	},
	{
		key: 'TIER', label: '「…수에 따라 기프트 효과 강화」 + 「- N인 이상」 티어',
		test: (d) => /기프트 효과 강화/.test(d),
	},
	{
		key: 'SLOT', label: '「[편성 N번 인격 전용 효과]」 자리 한정',
		test: (d) => /\[편성[^\]]*번[^\]]*전용/.test(d),
	},
	{
		key: 'ONLY', label: '「[… 전용 효과]」 — 자리가 아닌 다른 한정',
		test: (d) => /\[[^\]]*전용[^\]]*\]/.test(d) && !/\[편성[^\]]*번[^\]]*전용/.test(d),
	},
	{
		key: 'OR', label: '「…거나」·「또는」 — 조건이 OR 다',
		test: (d) => /하였거나|하거나|이거나|또는/.test(d),
	},
	{
		key: 'AMPLIFY', label: '「효과가 강화되어」 — 앞 절에 딸린 강화판',
		test: (d) => /효과가 강화되어|효과가 강화된다/.test(d),
	},
	{
		key: 'REPLACE', label: '「효과가 변경되어」 — 조건은 같고 효과만 갈린다',
		test: (d) => /효과가 변경되어/.test(d),
	},
	{
		key: 'SUBBULLET', label: '「- 」 하위 불릿 — 앞 문장을 키우는 항목',
		test: (d) => /\n\s*-\s/.test(d),
	},
	{
		key: 'ASSOC', label: '「… 소속 인격」 — 소속 조건이 있다',
		test: (d) => /소속 인격|소속의 인격|소속이면/.test(d),
	},
	{
		key: 'COUNT', label: '「N인 이상」·「N명 이상」 — 인원 문턱',
		test: (d) => /[0-9]+인 이상|[0-9]+명 이상/.test(d),
	},
	{
		key: 'DENOM', label: '분모를 직접 말한다 — 편성·출격·대기',
		test: (d) => /대기 인원|편성 인원|출격 인원/.test(d),
	},
	{
		key: 'RESO', label: '공명 조건',
		test: (d) => /공명/.test(d),
	},
	{
		key: 'SCALE', label: '크기가 편성 수에 비례한다',
		test: (d) => /편성된 수|편성 인원 수|편성된 인격 수/.test(d),
	},
	{
		key: 'PRIORITY', label: '「(… 우선으로 지정)」 — 조건이 아니라 우선순위 주석',
		test: (d) => /우선으로 지정|우선하여 지정/.test(d),
	},
	{
		key: 'RUNTIME', label: '전투 중 상태를 본다 — 적 상태·정신력·보유 효과',
		test: (d) => /적이 보유한|보유한 적|정신력이|상태[이라면]|흐트러짐|보유하고 있/.test(d),
	},
];

/** 문단 수 — 절이 몇 개쯤 될지의 밑그림이다 */
const paraCount = (d: string): number =>
	d.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '').length;

interface Row { giftId: string; name: string; keys: string[]; paras: number; desc: string }
const analyzed: Row[] = rows.map((r) => ({
	giftId: r.giftId,
	name: r.name,
	keys: SHAPES.filter((s) => s.test(r.desc)).map((s) => s.key),
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
