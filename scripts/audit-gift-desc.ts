const db = await import('../lib/db-canonical.js');

/**
 * 기프트 설명문이 구조화 가능한가 — `canonical.gift_stage_text` 를 잰다.
 *
 * 조사만 한다. 파싱기를 만드는 것이 아니라 「만들 수 있는가」를 재는 것이다.
 * 재는 것 넷:
 *   1. 조건 표지가 붙은 문장이 얼마나 되나
 *   2. 강화 단계별로 문장이 달라지는 기프트가 얼마나 되나 (수치만 vs 조건까지)
 *   3. 조건 표지가 없는 문장은 무엇인가 (무조건 효과인가, 다른 문형인가)
 *   4. 조건 안에 수치가 붙은 것이 얼마나 되나
 */
type Row = { giftId: string; level: number; desc: string };

const rows = await db.canonical.$queryRaw<Row[]>`
  SELECT t.gift_id AS "giftId", t.level, t."desc"
  FROM canonical.gift_stage_text t
  JOIN canonical.gift g ON g.id = t.gift_id
  WHERE t.locale = 'en' AND g.domain = 'mirror_dungeon'
    AND length(t."desc") > 0
  ORDER BY t.gift_id, t.level
`;

const gifts = new Set(rows.map((r) => r.giftId));
console.log(`거울 던전 기프트 ${gifts.size} · 단계 문장 ${rows.length}`);

/**
 * 조건이 나타나는 자리 — 앞에서부터 먼저 걸리는 것으로 센다.
 *
 * 조건은 문두 절에만 있지 않다. 주어 한정(`Allies with X deal …`)과
 * 대상 한정(`… to Staggered enemies`)도 발동 조건이다. 자리가 다를 뿐
 * 어느 것이나 구조로 굳힐 수 있다 — 그것이 이 조사가 재려는 것이다.
 */
const CONDITION: Array<[string, RegExp]> = [
	['① 선행 조건절 When …', /^When\b[^,:]{3,120}[,:]/i],
	['① 선행 조건절 If …', /^If\b[^,:]{3,120}[,:]/i],
	['① 선행 조건절 On/Upon/After/Before …', /^(On|Upon|After|Before)\b[^,:]{3,120}[,:]/i],
	['① 선행 조건절 Every/Each/Whenever …', /^(Every|Each|Whenever)\b[^,:]{3,120}[,:]/i],
	['① 선행 조건절 At/During …', /^(At|During)\b[^,:]{3,120}[,:]/i],
	['② 머리표 (Turn Start: 등)', /^[A-Z][A-Za-z '\-]{2,40}:(\s|$)/],
	['③ 주어 한정 (Allies/Skills with …)', /^(Allies|Skills|Identities|Units)\b[^.]{0,60}\bwith\b/i],
	['③ 주어 한정 (… with less/more than)', /^[A-Z][^.]{0,60}\b(less|more|greater|fewer) than\b/i],
	['④ 대상 한정 (… to/against … with/affected by)', /\b(to|against|on)\b[^.]{0,60}\b(with|affected by|that|who)\b/i],
	['④ 대상 한정 (… enemies/allies with)', /\b(enemies|allies|targets)\s+(with|affected|that)\b/i],
	['⑤ 우선순위 주석 (Prioritizes …)', /^\(?Prioritiz/i],
	['⑥ 괄호 주석만', /^\(/],
];

const counts = new Map<string, number>();
const unmatched: string[] = [];
let paras = 0;
let withNumber = 0;

for (const r of rows) {
	for (const raw of r.desc.split(/\n+/)) {
		const p = raw.trim();
		if (p.length === 0) continue;
		paras += 1;
		const hit = CONDITION.find(([, re]) => re.test(p));
		const key = hit ? hit[0] : '(조건 표지 없음)';
		counts.set(key, (counts.get(key) ?? 0) + 1);
		if (hit && /\b\d+\b/.test(p.slice(0, p.indexOf(',') + 1))) withNumber += 1;
		if (!hit && unmatched.length < 15) unmatched.push(`${r.giftId}/${r.level}  ${p.slice(0, 120)}`);
	}
}

console.log(`문단 총 ${paras}\n`);
for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(v).padStart(5)}  ${((v / paras) * 100).toFixed(1).padStart(5)}%  ${k}`);
}
const matched = paras - (counts.get('(조건 표지 없음)') ?? 0);
console.log(`\n조건 표지가 붙은 문단 ${matched} / ${paras} = ${((matched / paras) * 100).toFixed(1)}%`);
console.log(`그중 조건절 안에 수치가 있는 것 ${withNumber}`);

/** 강화 단계별로 문장이 달라지나 — 수치만 달라지는가, 조건까지 달라지는가 */
const byGift = new Map<string, Map<number, string>>();
for (const r of rows) {
	if (!byGift.has(r.giftId)) byGift.set(r.giftId, new Map());
	byGift.get(r.giftId)!.set(r.level, r.desc);
}
let multiLevel = 0;
let identical = 0;
let numberOnly = 0;
let wordingChanged = 0;
const wordingSamples: string[] = [];

for (const [giftId, levels] of byGift) {
	if (levels.size < 2) continue;
	multiLevel += 1;
	const texts = [...levels.values()];
	if (new Set(texts).size === 1) {
		identical += 1;
		continue;
	}
	// 숫자를 전부 지웠을 때 같아지면 「수치만 다름」이다
	const skeletons = new Set(texts.map((t) => t.replace(/\d+/g, '#')));
	if (skeletons.size === 1) numberOnly += 1;
	else {
		wordingChanged += 1;
		if (wordingSamples.length < 8) wordingSamples.push(giftId);
	}
}

console.log(`\n=== 강화 단계 ===`);
console.log(`  단계가 둘 이상인 기프트 ${multiLevel}`);
console.log(`    전 단계 문장 동일       ${identical}`);
console.log(`    수치만 달라짐           ${numberOnly}`);
console.log(`    문장(조건)까지 달라짐   ${wordingChanged}`);
console.log(`      표본: ${wordingSamples.join(' ')}`);

console.log('\n=== 조건 표지 없는 문단 표본 ===');
for (const s of unmatched) console.log('  ' + s);
process.exit(0);
