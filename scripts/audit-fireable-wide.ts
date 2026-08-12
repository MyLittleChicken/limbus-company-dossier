/**
 * 머지된 게이트 규칙을 넓은 덱으로 재검증한다. 조사만 한다.
 *
 * 앞선 42덱 검증은 **순수 덱**만 봤다 — 한 축 12인, 한 소속 12인. 실제 편성은
 * 섞여 있고, 섞인 편성에서만 드러나는 어긋남이 있다(전격부의 「6인 이상」 티어는
 * 충전이 3명쯤일 때만 문제가 보인다). 그래서 혼합 덱과 순환 덱을 더한다.
 *
 * 사람 눈에 기대지 않고 **교차 검증**으로 의심을 뽑는다. 기프트마다
 * 「엔진의 판정」과 「조건이 실제로 서는가」를 따로 구해 어긋나는 자리를 낸다.
 *
 *   S1 과대  켜졌는데 충족된 조건이 하나도 없고 확실한 불충족은 있다
 *   S2 과소  죽었는데 충족된 조건이 있다 (게이트가 막은 것이면 정당하므로 뺀다)
 *   S3 무반응 편성을 보는 조건이 있는데 모든 덱에서 판정이 같다
 *            — 조건이 아무 구실도 못 하고 있다는 뜻이다
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const OUT = process.argv[2] ?? '/tmp/wide-audit';
mkdirSync(OUT, { recursive: true });

const ROSTER_SIZE = 12;
const FIELD_SIZE = 7;

const byAxis = await prisma.$queryRaw<Array<{ axisId: string; identityId: string }>>`
	SELECT axis_id AS "axisId", identity_id AS "identityId" FROM canonical.identity_axis
	WHERE gate_kind = 'always' AND affects IN ('tag','both') ORDER BY 1,2
`;
const byAssoc = await prisma.$queryRaw<Array<{ associationId: string; identityId: string }>>`
	SELECT association_id AS "associationId", identity_id AS "identityId"
	FROM canonical.identity_association ORDER BY 1,2
`;
const allIds = [...new Set(byAssoc.map((r) => r.identityId))].sort();
const group = <T>(rows: T[], k: (r: T) => string, v: (r: T) => string) => {
	const m = new Map<string, string[]>();
	for (const r of rows) m.set(k(r), [...(m.get(k(r)) ?? []), v(r)]);
	return m;
};
const axisMembers = group(byAxis, (r) => r.axisId, (r) => r.identityId);
const assocMembers = group(byAssoc, (r) => r.associationId, (r) => r.identityId);

const squadOf = (roster: string[]): Squad => ({
	roster: roster.slice(0, ROSTER_SIZE).map((identityId) => ({ identityId, egoIds: [] })),
	field: roster.slice(0, FIELD_SIZE),
});
/** 핵심을 앞세우고 12인까지 채운다. 앞 7인이 출격이므로 핵심은 반드시 출격한다 */
const fill = (core: string[]): string[] => {
	const picked = [...new Set(core)].slice(0, ROSTER_SIZE);
	return [...picked, ...allIds.filter((id) => !picked.includes(id))].slice(0, ROSTER_SIZE);
};

type Deck = { name: string; kind: string; squad: Squad };
const decks: Deck[] = [];

/** ① 순수 축 — 12인 전원 그 축 */
const AXES = [...axisMembers.keys()].sort();
for (const ax of AXES) {
	const ids = axisMembers.get(ax) ?? [];
	if (ids.length >= FIELD_SIZE) decks.push({ name: `축:${ax}`, kind: '축', squad: squadOf(fill(ids)) });
}

/** ② 순수 소속 — 그 소속 전원 + 채움 */
const ASSOCS = [...assocMembers.entries()]
	.filter(([, ids]) => ids.length >= 1).map(([a]) => a).sort();
for (const a of ASSOCS) {
	decks.push({ name: `소속:${a}`, kind: '소속', squad: squadOf(fill(assocMembers.get(a) ?? [])) });
}

/**
 * ③ 혼합 — 축 절반 + 소속 절반.
 *
 * 순수 덱은 공급이 0 아니면 12라 「N인 이상」 문턱이 대부분 자명하게 갈린다.
 * 실제 편성처럼 섞으면 문턱 근처가 드러난다.
 */
const MIX_ASSOC = ['BLADE_LINEAGE', 'BLACK_CLOUD', 'MIDDLE_FINGER', 'RING_FINGER',
	'LA_MANCHA_LAND', 'PEQUOD_CREW', 'DAWN', 'THUMB_FINGER', 'N_CORP', 'SPIDER_HOUSE'];
for (const ax of AXES) {
	for (const a of MIX_ASSOC) {
		const axIds = (axisMembers.get(ax) ?? []).slice(0, 6);
		const asIds = (assocMembers.get(a) ?? []).slice(0, 6);
		if (axIds.length === 0 || asIds.length === 0) continue;
		decks.push({ name: `혼합:${ax}+${a}`, kind: '혼합', squad: squadOf(fill([...axIds, ...asIds])) });
	}
}

/**
 * ④ 순환 — 전체 인격 목록을 일정 간격으로 잘라 만든 덱.
 *
 * 무작위 대신 결정적으로 만든다. 다시 돌려도 같은 덱이 나와야 비교가 된다.
 */
for (let off = 0; off < allIds.length; off += 17) {
	const ids = Array.from({ length: ROSTER_SIZE }, (_, i) => allIds[(off + i * 7) % allIds.length]);
	decks.push({ name: `순환:${String(off).padStart(3, '0')}`, kind: '순환', squad: squadOf(fill(ids)) });
}

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
`;
const textOf = new Map(texts.map((t) => [t.giftId, t]));

type Acc = {
	alive: string[];
	s1: string[];              // 과대 의심 덱
	s2: Array<[string, string]>; // 과소 의심 덱 + 무엇이 막았나
	refKinds: Set<string>;
};
const acc = new Map<string, Acc>();
const get = (id: string): Acc => {
	let a = acc.get(id);
	if (a === undefined) { a = { alive: [], s1: [], s2: [], refKinds: new Set() }; acc.set(id, a); }
	return a;
};

for (const d of decks) {
	const verdicts = evaluateGifts({
		squad: d.squad, profile: new Profile(d.squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		const a = get(v.giftId);
		for (const r of v.reasons) a.refKinds.add(r.refKind);
		const satisfied = v.reasons.filter((r) => r.verdict === 'satisfied');
		const hardUnsat = v.reasons.filter((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');

		if (v.fireable) {
			a.alive.push(d.name);
			// S1 — 충족된 조건이 하나도 없는데 켜졌고, 확실히 안 선 조건은 있다
			if (satisfied.length === 0 && hardUnsat.length > 0) a.s1.push(d.name);
		} else {
			// S2 — 죽었는데 선 조건이 있다. 막은 것이 게이트면 정당하므로 뺀다
			const killers = v.reasons.filter((r) => r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain');
			const byGate = killers.some((r) => v.reasons.filter((x) => x.triggerId === r.triggerId).length === 1);
			if (satisfied.length > 0 && !byGate) {
				a.s2.push([d.name, killers.map((r) => `${r.refKind}/${r.refId} ${r.have}<${r.need}`).join(' | ')]);
			}
		}
	}
}

/** 편성을 보는 참조 — 이게 있으면 덱에 따라 판정이 갈려야 정상이다 */
const ROSTER_KINDS = new Set(['axis', 'association', 'unit_keyword', 'attack_type', 'sin', 'resonance', 'coin', 'skill_kind']);
const N = decks.length;

const rows = [...acc.entries()].map(([id, a]) => ({
	id,
	name: textOf.get(id)?.name ?? id,
	alive: a.alive.length,
	s1: a.s1.length,
	s2: a.s2.length,
	// S3 — 편성 참조가 있는데 모든 덱에서 판정이 같다
	s3: [...a.refKinds].some((k) => ROSTER_KINDS.has(k)) && (a.alive.length === 0 || a.alive.length === N),
	a,
}));

console.log(`덱 ${N}개  (축 ${decks.filter((d) => d.kind === '축').length} · 소속 ${decks.filter((d) => d.kind === '소속').length} · 혼합 ${decks.filter((d) => d.kind === '혼합').length} · 순환 ${decks.filter((d) => d.kind === '순환').length})`);
console.log(`기프트 ${rows.length}  편성 ${ROSTER_SIZE} / 출격 ${FIELD_SIZE}\n`);

const s1 = rows.filter((r) => r.s1 > 0).sort((x, y) => y.s1 - x.s1);
const s2 = rows.filter((r) => r.s2 > 0).sort((x, y) => y.s2 - x.s2);
const s3 = rows.filter((r) => r.s3).sort((x, y) => y.alive - x.alive);

console.log(`S1 과대 의심 — 충족된 조건 없이 켜진다     ${s1.length}`);
console.log(`S2 과소 의심 — 선 조건이 있는데 죽는다     ${s2.length}`);
console.log(`S3 무반응   — 편성 참조가 있는데 전덱 동일  ${s3.length}`);

const md: string[] = [
	'# 넓은 덱 재검증 — 게이트 규칙 머지 후',
	'',
	`덱 ${N}개 · 기프트 ${rows.length} · 편성 ${ROSTER_SIZE} / 출격 ${FIELD_SIZE}`,
	'',
	`- S1 과대 의심 ${s1.length}`,
	`- S2 과소 의심 ${s2.length}`,
	`- S3 무반응 ${s3.length}`,
	'',
];
const dump = (title: string, list: typeof rows, detail: (r: typeof rows[0]) => string[]) => {
	md.push(`## ${title}`, '');
	for (const r of list) {
		md.push(`### ${r.name} (${r.id})  —  켜지는 덱 ${r.alive}/${N}`, '');
		md.push(...detail(r), '');
		md.push('```', (textOf.get(r.id)?.desc ?? '').slice(0, 700), '```', '', '---', '');
	}
};
dump('S1 과대 의심', s1, (r) => [`충족 조건 없이 켜진 덱 ${r.s1}개 — ${r.a.s1.slice(0, 6).join(' · ')}`]);
dump('S2 과소 의심', s2, (r) => [
	`선 조건이 있는데 죽은 덱 ${r.s2}개`,
	...r.a.s2.slice(0, 4).map(([d, k]) => `  - ${d} — 막음: ${k}`),
]);
dump('S3 무반응', s3, (r) => [`편성 참조 ${[...r.a.refKinds].join(' · ')} 인데 ${r.alive === 0 ? '전 덱에서 죽는다' : '전 덱에서 켜진다'}`]);

writeFileSync(`${OUT}/WIDE-AUDIT.md`, md.join('\n'), 'utf8');
console.log(`\n→ ${OUT}/WIDE-AUDIT.md`);

await prisma.$disconnect();
process.exit(0);
