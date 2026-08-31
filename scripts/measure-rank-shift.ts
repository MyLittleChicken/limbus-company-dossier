/**
 * 값 모형이 팩 순위를 어떻게 바꾸는지 **재기만 한다**(설계 §8 의 7).
 *
 * 덱 163개는 `simulate-ability.ts` 와 같은 방식으로 짠다 — 축·소속·혼합·순환.
 * 덱마다 `recommendForDeck` 을 부르고, 옛 점수(최댓값 정규화 적합도 · 전용 곱
 * · 축만)를 반환값에서 되셈해 새 점수와 순위를 견준다.
 *
 * **옛 점수의 되셈이 정확한 이유** — 옛 fit 과 새 fit 은 분모(최댓값 ↔ 출격
 * 인원)와 전용 취급만 다르므로, 새 반환값의 재료(키워드 · 전용 · 공급 막대)로
 * 옛 값을 그대로 다시 만들 수 있다. 합성 항도 같은 배율(출격÷최댓값)이다.
 *
 * 실행: tsx --env-file-if-exists=.env scripts/measure-rank-shift.ts [--out 경로]
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { recommendForDeck } from '../lib/queries/canonical/recommend.js';

const ROSTER_SIZE = 12;
const FIELD_SIZE = 7;
const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] ?? '/tmp/rank-shift.md' : '/tmp/rank-shift.md';

const prisma = new PrismaClient();
const q = <T>(sql: string): Promise<T[]> => prisma.$queryRawUnsafe<T[]>(sql);

// ── 덱 163 — simulate-ability.ts 와 같은 짜임 ───────────────────
const axisTag = await q<{ identityId: string; axisId: string }>(
	`SELECT identity_id AS "identityId", axis_id AS "axisId" FROM canonical.identity_axis
	 WHERE gate_kind='always' AND affects IN ('tag','both')`);
const assocRows = await q<{ identityId: string; associationId: string }>(
	`SELECT identity_id AS "identityId", association_id AS "associationId" FROM canonical.identity_association`);

const axisMembers = new Map<string, string[]>();
for (const r of axisTag) axisMembers.set(r.axisId, [...(axisMembers.get(r.axisId) ?? []), r.identityId]);
const assocMembers = new Map<string, string[]>();
for (const r of assocRows) assocMembers.set(r.associationId, [...(assocMembers.get(r.associationId) ?? []), r.identityId]);
const allIds = [...new Set(assocRows.map((r) => r.identityId))].sort();

const buildDeck = (core: string[]): string[] => {
	const picked = [...new Set(core)].slice(0, ROSTER_SIZE);
	return [...picked, ...allIds.filter((id) => !picked.includes(id))].slice(0, ROSTER_SIZE);
};
const decks: Array<[string, string[]]> = [];
for (const [ax, ids] of [...axisMembers].sort()) if (ids.length >= FIELD_SIZE) decks.push([`축:${ax}`, buildDeck(ids)]);
for (const [a, ids] of [...assocMembers].sort()) if (ids.length >= 1) decks.push([`소속:${a}`, buildDeck(ids)]);
for (const [ax, aids] of [...axisMembers].sort()) {
	for (const a of ['BLADE_LINEAGE', 'BLACK_CLOUD', 'MIDDLE_FINGER', 'RING_FINGER', 'LA_MANCHA_LAND',
		'PEQUOD_CREW', 'DAWN', 'THUMB_FINGER', 'N_CORP', 'SPIDER_HOUSE']) {
		const asIds = assocMembers.get(a) ?? [];
		if (aids.length === 0 || asIds.length === 0) continue;
		decks.push([`혼합:${ax}+${a}`, buildDeck([...aids.slice(0, 6), ...asIds.slice(0, 6)])]);
	}
}
for (let off = 0; off < allIds.length; off += 17) {
	decks.push([`순환:${off}`, buildDeck(Array.from({ length: ROSTER_SIZE },
		(_, i) => allIds[(off + i * 7) % allIds.length] as string))]);
}

// ── 덱마다 옛/새 순위를 견준다 ──────────────────────────────────
const HALF = 0.5;
interface Shift {
	deck: string;
	packs: number;
	/** 옛 모형이 순위를 못 매기던 덱인가 (축 공급 0) */
	oldUnrankable: boolean;
	top1Same: boolean;
	top3Overlap: number;
	spearman: number;
}
const shifts: Shift[] = [];

const spearmanOf = (a: string[], b: string[]): number => {
	const rank = (xs: string[]): Map<string, number> => new Map(xs.map((x, i) => [x, i]));
	const ra = rank(a); const rb = rank(b);
	const n = a.length;
	if (n < 2) return 1;
	let d2 = 0;
	for (const [id, r] of ra) d2 += ((rb.get(id) ?? 0) - r) ** 2;
	return 1 - (6 * d2) / (n * (n ** 2 - 1));
};

for (const [name, roster] of decks) {
	const rec = await recommendForDeck('ko', {
		identityIds: roster.map(Number),
		deployedIds: roster.slice(0, FIELD_SIZE).map(Number),
		floor: 3,
		difficulty: 'hard',
	});

	const axisCounts = new Map<string, number>();
	for (const s of rec.supply) {
		if (s.refKind === 'axis') axisCounts.set(s.refId, Math.max(axisCounts.get(s.refId) ?? 0, s.count));
	}
	const max = Math.max(0, ...axisCounts.values());

	const oldScoreOf = (p: (typeof rec.packs)[number]): number => {
		if (max === 0) return 0;
		const pool = p.gifts.filter((g) => !g.owned && g.fireable);
		if (pool.length === 0) return 0;
		const fitOld = pool.reduce((sum, g) => {
			const axis = g.keywordId === null ? 0 : (axisCounts.get(g.keywordId.toUpperCase()) ?? 0) / max;
			return sum + axis * (g.exclusive ? 1 : HALF);
		}, 0) / pool.length;
		// 새 합성 항의 결과물 fit 은 분모만 다르다(출격 ↔ 최댓값) — 배율로 되돌린다
		const fusionOld = p.fusion * (FIELD_SIZE / max);
		return (fitOld + fusionOld) * p.live;
	};

	const byOld = [...rec.packs].sort((a, b) => oldScoreOf(b) - oldScoreOf(a) || a.id.localeCompare(b.id));
	const byNew = [...rec.packs].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
	const top3 = (xs: typeof rec.packs) => new Set(xs.slice(0, 3).map((p) => p.id));
	const inter = [...top3(byOld)].filter((id) => top3(byNew).has(id)).length;

	shifts.push({
		deck: name,
		packs: rec.packs.length,
		oldUnrankable: max === 0,
		top1Same: byOld[0]?.id === byNew[0]?.id,
		top3Overlap: inter,
		spearman: spearmanOf(byOld.map((p) => p.id), byNew.map((p) => p.id)),
	});
	process.stderr.write('.');
}
process.stderr.write('\n');

// ── 보고 ────────────────────────────────────────────────────────
const rankableShifts = shifts.filter((s) => !s.oldUnrankable);
const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const lines = [
	'# 값 모형이 팩 순위를 어떻게 바꿨나 (163덱 실측)',
	'',
	`덱 ${shifts.length} · 층 3 · hard · 팩 ${shifts[0]?.packs ?? 0}개씩`,
	'',
	`| 항목 | 값 |`,
	`| --- | --- |`,
	`| 옛 모형이 순위를 못 매기던 덱 (축 공급 0) | ${shifts.filter((s) => s.oldUnrankable).length} — 이제 전부 순위가 생겼다 |`,
	`| 1위가 그대로인 덱 | ${rankableShifts.filter((s) => s.top1Same).length}/${rankableShifts.length} |`,
	`| 상위 3 겹침 (평균) | ${mean(rankableShifts.map((s) => s.top3Overlap)).toFixed(2)}/3 |`,
	`| 순위 상관 (Spearman 평균) | ${mean(rankableShifts.map((s) => s.spearman)).toFixed(3)} |`,
	'',
	'1위가 바뀐 덱:',
	'',
	...rankableShifts.filter((s) => !s.top1Same).map((s) => `- ${s.deck} (상위3 겹침 ${s.top3Overlap})`),
	'',
];
writeFileSync(out, lines.join('\n'));
console.log(lines.slice(0, 12).join('\n'));
console.log(`→ ${out}`);
await prisma.$disconnect();
