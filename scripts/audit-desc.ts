const db = await import('../lib/db-canonical.js');

/**
 * 기프트 설명문이 얼마나 규칙적인가 — 조건 문형을 분류한다.
 *
 * 조사만 한다. 파싱기를 만드는 것이 아니라 「만들 수 있는가」를 재는 것이다.
 */
type Row = { id: string; desc: string };

const rows = await db.canonical.$queryRaw<Row[]>`
  SELECT r.id, r.payload->>'desc' AS desc
  FROM raw.raw_object r
  WHERE r.source = 'loc-en' AND r.entity = 'gifts'
    AND r.payload ? 'desc' AND length(r.payload->>'desc') > 0
    AND EXISTS (SELECT 1 FROM canonical.gift g WHERE g.id = r.id AND g.domain = 'mirror_dungeon')
`;

console.log(`거울 던전 기프트 중 loc-en 설명문이 있는 것: ${rows.length}`);

/** 문단 하나를 「조건 : 효과」로 가를 수 있나 */
const PATTERNS: Array<[string, RegExp]> = [
	['머리표 (Turn Start: · Combat Start: 등)', /^[A-Z][A-Za-z '\-]{2,40}:\s/],
	['When …, / When …:', /^When\b[^,:]{3,80}[,:]/i],
	['If …, / If …:', /^If\b[^,:]{3,80}[,:]/i],
	['On …, / Upon …,', /^(On|Upon)\b[^,:]{3,80},/i],
	['Every … / Each …', /^(Every|Each)\b[^,:]{3,80},/i],
	['At … ,', /^At\b[^,:]{3,80},/i],
	['괄호 주석만 (Prioritizes · max 등)', /^\(/],
];

const counts = new Map<string, number>();
const unmatchedSamples: string[] = [];
let paras = 0;

for (const r of rows) {
	for (const raw of r.desc.split(/\n+/)) {
		const p = raw.trim();
		if (p.length === 0) continue;
		paras += 1;
		const hit = PATTERNS.find(([, re]) => re.test(p));
		const key = hit ? hit[0] : '(안 걸림)';
		counts.set(key, (counts.get(key) ?? 0) + 1);
		if (!hit && unmatchedSamples.length < 12) unmatchedSamples.push(`${r.id}  ${p.slice(0, 110)}`);
	}
}

console.log(`문단 총 ${paras}\n`);
for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(v).padStart(5)}  ${((v / paras) * 100).toFixed(1).padStart(5)}%  ${k}`);
}
const matched = paras - (counts.get('(안 걸림)') ?? 0);
console.log(`\n문형이 잡히는 문단 ${matched} / ${paras} = ${((matched / paras) * 100).toFixed(1)}%`);

console.log('\n=== 안 걸린 표본 ===');
for (const s of unmatchedSamples) console.log('  ' + s);
process.exit(0);
