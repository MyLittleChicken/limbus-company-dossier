/**
 * 스펙(2026-08-10-gift-ability-model-design.md)의 실측 주장을 다시 잰다.
 *
 * 조사만 한다. 주장이 틀렸으면 스펙을 고친다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();

/** 골든과 같은 화상·진동 덱 */
const SQUAD: Squad = {
	roster: ['10216', '11216', '11009', '10916', '10716', '10512']
		.map((identityId) => ({ identityId, egoIds: [] })),
	field: ['10216', '11216', '11009', '10916', '10716', '10512'],
};

const data = await loadEngineData(prisma);
const verdicts = evaluateGifts({
	squad: SQUAD,
	profile: new Profile(SQUAD, data.capabilities),
	giftTriggers: data.giftTriggers,
	refsByTrigger: data.refsByTrigger,
	params: data.params,
});
const byId = new Map(verdicts.map((v) => [v.giftId, v]));

console.log('=== 주장 1 · 엔진의 현 판정 (스펙 §1 표) ===');
for (const [id, name, claim] of [
	['9052', '휴대용 전지 소켓', '발동 불가'],
	['9043', '사원증', '발동 불가'],
	['9073', '엔도르핀 키트', '유효'],
] as const) {
	const v = byId.get(id);
	const actual = v === undefined ? '(판정 없음)' : v.fireable ? '유효' : '발동 불가';
	const ok = actual === claim ? 'OK ' : '어긋남';
	console.log(`  ${ok}  ${id} ${name.padEnd(12)} 스펙:${claim.padEnd(8)} 실제:${actual}  등급 ${v?.grade ?? '-'}`);
	for (const r of v?.reasons ?? []) {
		console.log(`         ${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict} ${r.certainty} ${r.denominator ?? ''}`);
	}
}

console.log('\n=== 주장 2 · AND 를 OR 로 바꾸면 몇 건이 뒤집히나 (스펙 §1 층3) ===');
let deadAnd = 0;
let deadOr = 0;
for (const v of verdicts) {
	const certainUnsat = v.reasons.filter((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
	if (certainUnsat.length > 0) deadAnd += 1;
	if (v.reasons.length > 0 && certainUnsat.length === v.reasons.length) deadOr += 1;
}
console.log(`  AND 로 읽어 죽는 기프트  ${deadAnd}`);
console.log(`  OR 로 읽어 죽는 기프트   ${deadOr}`);
console.log(`  차이                     ${deadAnd - deadOr}  (${((1 - deadOr / deadAnd) * 100).toFixed(0)}%)`);
console.log(`  스펙 주장: 174 중 159(91%) — 위와 맞는지 본다`);

console.log('\n=== 주장 3 · 화진 덱에서 호흡을 주는 스킬 (스펙 §7 골든 근거) ===');
const breath = await prisma.$queryRaw<Array<{ identityId: string; skills: bigint; tokens: bigint }>>`
  SELECT i.identity_id AS "identityId",
         count(DISTINCT ct.skill_id) AS skills,
         count(*) AS tokens
  FROM canonical.identity_skill i
  JOIN canonical.coin_token ct ON ct.skill_id = i.skill_id
  JOIN canonical.status s ON s.id = ct.status_id
  WHERE i.identity_id = ANY(${SQUAD.field}::text[])
    AND ct.kind = 'status'
    AND s.id ILIKE '%breath%'
  GROUP BY 1 ORDER BY 1
`;
if (breath.length === 0) console.log('  (한 건도 없다 — 질의나 주장을 다시 봐야 한다)');
for (const b of breath) console.log(`  ${b.identityId}  스킬 ${b.skills}  토큰 ${b.tokens}`);

console.log('\n=== 주장 4 · triggers/effects 짝 안 맞는 비율 (스펙 §1 층1) ===');
const pairing = await prisma.$queryRaw<Array<{ total: bigint; mismatched: bigint }>>`
  WITH n AS (
    SELECT g.id,
           (SELECT count(*) FROM canonical.gift_trigger t WHERE t.gift_id = g.id) AS nt,
           (SELECT count(*) FROM canonical.gift_effect e WHERE e.gift_id = g.id) AS ne
    FROM canonical.gift g
  )
  SELECT count(*) FILTER (WHERE nt > 0 OR ne > 0) AS total,
         count(*) FILTER (WHERE (nt > 0 OR ne > 0) AND nt <> ne) AS mismatched
  FROM n
`;
const p = pairing[0];
console.log(`  트리거나 효과가 있는 기프트 ${p.total} · 수가 어긋나는 것 ${p.mismatched}` +
	`  (${((Number(p.mismatched) / Number(p.total)) * 100).toFixed(0)}%)`);
console.log('  스펙 주장: 451 중 282(63%)');

console.log('\n=== 주장 5 · gift_trigger_param 커버리지 (스펙 §1) ===');
const cov = await prisma.$queryRaw<Array<{ pairs: bigint; covered: bigint }>>`
  SELECT (SELECT count(*) FROM canonical.gift_trigger) AS pairs,
         (SELECT count(DISTINCT (gift_id, trigger_id)) FROM canonical.gift_trigger_param) AS covered
`;
console.log(`  (기프트,트리거) 짝 ${cov[0].pairs} · 파라미터가 있는 짝 ${cov[0].covered}` +
	`  (${((Number(cov[0].covered) / Number(cov[0].pairs)) * 100).toFixed(0)}%)`);
console.log('  스펙 주장: 1,081 중 122(11%)');

console.log('\n=== 주장 6 · gift_stage_text 적재율 (스펙 §1) ===');
const text = await prisma.$queryRaw<Array<{ locale: string; gifts: bigint }>>`
  SELECT t.locale, count(DISTINCT t.gift_id) AS gifts
  FROM canonical.gift_stage_text t
  JOIN canonical.gift g ON g.id = t.gift_id
  WHERE g.domain = 'mirror_dungeon' AND length(t."desc") > 0
  GROUP BY 1 ORDER BY 1
`;
const mdGifts = await prisma.$queryRaw<Array<{ n: bigint }>>`
  SELECT count(*) AS n FROM canonical.gift WHERE domain = 'mirror_dungeon'
`;
console.log(`  거울 던전 기프트 ${mdGifts[0].n}`);
for (const t of text) console.log(`    ${t.locale}  설명문 있는 기프트 ${t.gifts}`);
console.log('  스펙 주장: 456 × ko/en/ja 100%');

console.log('\n=== 주장 7 · Allies have% 문턱값 결손 (스펙 §1 층2) ===');
const allies = await prisma.$queryRaw<Array<{ pairs: bigint; withMin: bigint }>>`
  SELECT count(*) AS pairs,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM canonical.gift_trigger_param p
           WHERE p.gift_id = gt.gift_id AND p.trigger_id = gt.trigger_id AND p.kind = 'min_count'
         )) AS "withMin"
  FROM canonical.gift_trigger gt
  WHERE gt.trigger_id LIKE 'Allies have%'
`;
console.log(`  Allies have% 짝 ${allies[0].pairs} · min_count 있는 것 ${allies[0].withMin}` +
	` · 없는 것 ${Number(allies[0].pairs) - Number(allies[0].withMin)}`);
console.log('  스펙 주장: 118짝 중 76짝에 문턱값 없음');

await prisma.$disconnect();
process.exit(0);
