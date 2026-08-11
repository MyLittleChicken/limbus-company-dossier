/**
 * 과소 판정 13건과 과대 판정 9건을 사람이 읽을 수 있게 낸다. 조사만 한다.
 *
 * 각 기프트마다 설명문 전문 · 엔진이 붙인 근거 전부 · 덱별 판정을 함께 낸다.
 * 목적은 사람이 「이 기프트는 게임에서 실제로 이렇게 돈다」고 답할 수 있게 하는 것이다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const OUT = process.argv[2] ?? '/tmp/misjudged';
mkdirSync(OUT, { recursive: true });

const DECKS: Array<[string, string[]]> = [
	['출혈', ['10107', '10109', '10113', '10204', '10208', '10213']],
	['파열', ['10102', '10106', '10111', '10114', '10116', '10203']],
	['호흡', ['10103', '10107', '10113', '10115', '10203', '10208']],
	['진동', ['10105', '10114', '10207', '10216', '10304', '10309']],
	['침잠', ['10101', '10104', '10108', '10110', '10115', '10209']],
	['화상', ['10112', '10211', '10216', '10311', '10407', '10415']],
	['충전', ['10106', '10116', '10202', '10210', '10215', '10302']],
	['가속', ['10110', '10406', '10414', '10512', '10514', '10611']],
	['검계', ['10103', '10208', '10308', '10508', '10815', '11002']],
	['흑운회', ['10403', '10602', '10712', '10811', '10902', '11208']],
	['중지', ['10306', '10507', '10715', '10814', '11012', '11115']],
	['약지', ['10109', '10215', '10515', '10614', '10915', '11109']],
];

const UNDER = ['9802', '9803', '9804', '9104', '9043', '9052', '9747', '9115', '9828', '9239', '9049', '9123', '9261'];
const OVER_SCOPE = ['9246', '9271', '9420', '9737', '9778', '9842', '9843'];
const OVER_TAG = ['9796', '9819'];
const ALL = [...UNDER, ...OVER_SCOPE, ...OVER_TAG];

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT gift_id AS "giftId", name, "desc" FROM canonical.gift_stage_text
	WHERE locale = 'ko' AND level = 0 AND gift_id = ANY(${ALL}::text[])
`;
const textOf = new Map(texts.map((t) => [t.giftId, t]));

/** 기프트가 붙들고 있는 트리거·파라미터 원본 */
const trigRows = await prisma.$queryRaw<Array<{ giftId: string; triggerId: string; kind: string; refKind: string | null; refId: string | null; value: string | null }>>`
	SELECT p.gift_id AS "giftId", p.trigger_id AS "triggerId", p.kind, NULL AS "refKind", NULL AS "refId", p.value
	FROM canonical.gift_trigger_param p WHERE p.gift_id = ANY(${ALL}::text[])
	ORDER BY 1, 2, 3
`;

type Snap = { alive: string[]; dead: string[]; reasons: Map<string, string[]> };
const snap = new Map<string, Snap>(ALL.map((id) => [id, { alive: [], dead: [], reasons: new Map() }]));

for (const [deckName, ids] of DECKS) {
	const squad: Squad = { roster: ids.map((identityId) => ({ identityId, egoIds: [] })), field: ids };
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		const s = snap.get(v.giftId);
		if (s === undefined) continue;
		(v.fireable ? s.alive : s.dead).push(deckName);
		s.reasons.set(deckName, v.reasons.map((r) =>
			`${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict}` +
			`${r.certainty === 'certain' ? '' : `(${r.certainty})`} · ${r.blocking ? '막음' : '안막음'}`));
	}
}

const render = (id: string): string[] => {
	const t = textOf.get(id);
	const s = snap.get(id);
	const out: string[] = [];
	out.push(`### ${t?.name ?? '?'}  (${id})`, '');
	out.push(`**켜지는 덱 ${s?.alive.length ?? 0} / 12**` +
		(s?.alive.length ? ` — ${s.alive.join(' · ')}` : ''), '');
	out.push('**설명문 전문**', '', '```');
	out.push(t?.desc ?? '(없음)');
	out.push('```', '');
	// 근거는 덱마다 have 만 달라지므로 대표 둘만 보인다
	const shown = [s?.alive[0], s?.dead[0]].filter((d): d is string => d !== undefined);
	out.push('**엔진이 붙인 근거**', '');
	for (const deck of shown) {
		out.push(`- \`${deck}\` 덱 — ${s?.alive.includes(deck) ? '켜진다' : '죽는다'}`);
		for (const r of s?.reasons.get(deck) ?? []) out.push(`  - ${r}`);
	}
	const params = trigRows.filter((r) => r.giftId === id);
	if (params.length > 0) {
		out.push('', '**트리거 파라미터**', '');
		for (const p of params) out.push(`  - ${p.triggerId} · ${p.kind}${p.value === null ? '' : ` = ${p.value}`}`);
	}
	out.push('', '---', '');
	return out;
};

const md: string[] = [
	'# 과소·과대 판정 전량 보고',
	'',
	'12덱 × 451기프트 검증에서 나온 22건. 설명문 전문과 엔진 근거를 나란히 둔다.',
	'',
	'## 과소 판정 — 켜져야 하는데 죽는다 (13건)',
	'',
	...UNDER.flatMap(render),
	'## 과대 판정 · 이번 회차의 규칙이 만든 것 (7건)',
	'',
	...OVER_SCOPE.flatMap(render),
	'## 과대 판정 · 태그 결손 (2건)',
	'',
	...OVER_TAG.flatMap(render),
];
writeFileSync(`${OUT}/MISJUDGED.md`, md.join('\n'), 'utf8');
console.log(`→ ${OUT}/MISJUDGED.md  (${md.length} 줄)`);

await prisma.$disconnect();
process.exit(0);
