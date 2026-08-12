/**
 * 확정된 여섯 분류로 **절 구조**를 뽑는다. 조건은 아직 안 뽑는다.
 *
 * 사용자가 여섯 규칙을 전부 확정했으므로(2026-08-12) 「문단이 절 몇 개가
 * 되는가 · 어느 절이 어느 절의 강화판인가 · 어느 문단이 절이 아니라 머리인가」
 * 는 더 이상 판단이 아니라 계산이다.
 *
 * 남는 것은 **절마다의 조건**(refKind · refId · threshold · scope · supply)이고,
 * 그건 문장을 읽어야 알 수 있어 추출·검수 회차의 몫이다. 여기서는 뼈대를 세우고
 * 조건 자리를 비워 둔다 — `unconditional=false` 에 `conds=[]` 면 굽는 쪽이
 * 결손으로 남긴다.
 *
 * 실행: npm run gift:split -- --out /tmp/clause-skeleton.jsonl
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { classifyGift } from './gift-shapes.js';

const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/clause-skeleton.jsonl';

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id, t.level
`;

const paras = (d: string): string[] =>
	d.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');

/** 이 문단이 앞 절의 강화판인가 */
const isAmp = (p: string): boolean =>
	/효과가 강화되어|효과가 강화된다|효과가 변경되어|효과를 대신하여|효과가 더욱 강화되어|효과가 최대로 강화되어|효과를 대신|효과가 추가되어/.test(p);

/** 이 문단이 「- N인 이상」 티어인가 */
const tierOf = (p: string): number | null => {
	const m = /^-\s*([0-9]+)인 이상/.exec(p.replace(/⏎.*$/s, '').trim());
	return m === null ? null : Number(m[1]);
};

/** 이 문단이 대괄호 머리인가 (자기 자신은 절이 아니고 뒤 절들의 조건이 된다) */
const isBracketHead = (p: string): boolean => /^\[[^\]]*\]/.test(p.trim());

interface Clause {
	giftId: string;
	level: number;
	ordinal: number;
	klass: string;
	/** 이 절의 근거가 된 문단 원문 */
	sourceText: string;
	/** 앞 절의 강화판이면 그 ordinal */
	refines: number | null;
	/** 이 절에 붙는 머리(대괄호·게이트) 원문. 조건 추출의 입력이다 */
	inherits: string[];
	/** 티어면 그 인원수 */
	tier: number | null;
}

const clauses: Clause[] = [];
const stat = new Map<string, number>();

for (const r of rows) {
	const ps = paras(r.desc);
	const { klass } = classifyGift(r.desc);
	stat.set(klass, (stat.get(klass) ?? 0) + 1);

	/** 뒤 절들이 물려받는 조건 — 게이트 문단과 대괄호 머리가 여기 쌓인다 */
	const inherits: string[] = [];
	let ordinal = 0;
	let lastBase: number | null = null;

	for (const [i, p] of ps.entries()) {
		// ① 첫 문단이 게이트면 절이 아니라 물림이다
		if (i === 0 && klass === 'GATE') { inherits.push(p); continue; }
		// ② 대괄호 머리는 절이 아니라 물림이다. 새 대괄호는 앞 대괄호를 밀어낸다
		if (isBracketHead(p)) {
			const body = p.replace(/^\[[^\]]*\]\s*/, '').trim();
			// 대괄호만 있는 문단이면 물림만 갈아끼우고 넘어간다
			const head = /^\[[^\]]*\]/.exec(p.trim())?.[0] ?? '';
			const keep = inherits.filter((x) => !/^\[/.test(x));
			inherits.length = 0;
			inherits.push(...keep, head);
			if (body === '') continue;
			// 대괄호 뒤에 본문이 붙어 있으면 그 본문이 절이다
			clauses.push({ giftId: r.giftId, level: r.level, ordinal, klass,
				sourceText: p, refines: null, inherits: [...inherits], tier: null });
			lastBase = ordinal;
			ordinal += 1;
			continue;
		}
		// ③ 「…에게 효과 적용」 머리(대괄호가 아닌 HEAD)도 물림이다
		if (i === 0 && klass === 'HEAD' && !isBracketHead(p)) { inherits.push(p); continue; }
		// ④ 티어 선언 문단(「수에 따라 기프트 효과 강화」)은 절이 아니다
		if (/기프트 효과 강화/.test(p) && tierOf(p) === null) { inherits.push(p); continue; }

		const tier = tierOf(p);
		// ⑤ 강화판은 앞의 기본 절에 매단다. 티어는 강화판이 아니라 독립이다
		const refines = tier === null && isAmp(p) && lastBase !== null ? lastBase : null;
		clauses.push({ giftId: r.giftId, level: r.level, ordinal, klass,
			sourceText: p, refines, inherits: [...inherits], tier });
		if (refines === null) lastBase = ordinal;
		ordinal += 1;
	}

	// ⑥ 절이 하나도 안 남으면(머리뿐인 기프트) 첫 문단을 절로 되살린다
	if (!clauses.some((c) => c.giftId === r.giftId && c.level === r.level) && ps.length > 0) {
		clauses.push({ giftId: r.giftId, level: r.level, ordinal: 0, klass,
			sourceText: ps[0], refines: null, inherits: [], tier: null });
	}
}

writeFileSync(out, `${clauses.map((c) => JSON.stringify(c)).join('\n')}\n`, 'utf8');

const byGift = new Set(clauses.map((c) => `${c.giftId}/${c.level}`));
console.log(`단계 ${rows.length} · 절 ${clauses.length} (단계당 평균 ${(clauses.length / rows.length).toFixed(1)})`);
console.log(`절이 하나도 없는 단계 ${rows.length - byGift.size}`);
console.log(`강화판 ${clauses.filter((c) => c.refines !== null).length} · 티어 ${clauses.filter((c) => c.tier !== null).length}`);
console.log(`물림이 있는 절 ${clauses.filter((c) => c.inherits.length > 0).length}`);
console.log('\n분류별 단계 수');
for (const [k, v] of [...stat].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(8)} ${v}`);
console.log(`\n→ ${out}`);

await prisma.$disconnect();
process.exit(0);
