/**
 * AND → OR 로 바꾸면 뒤집히는 기프트를 표본으로 본다. 조사만 한다.
 *
 * 뒤집히는 수(162)는 「틀린 판정의 수」가 아니다. 어느 쪽이 옳은지는 기프트마다
 * 다르므로, 설명문을 직접 읽고 판단할 근거를 모은다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const IDS = ['10216', '11216', '11009', '10916', '10716', '10512'];
const squad: Squad = { roster: IDS.map((identityId) => ({ identityId, egoIds: [] })), field: IDS };

const verdicts = evaluateGifts({
	squad, profile: new Profile(squad, data.capabilities),
	giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
});

/** AND 로는 죽고 OR 로는 사는 것 */
const flips = verdicts.filter((v) => {
	const bad = v.reasons.filter((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
	return bad.length > 0 && bad.length < v.reasons.length;
});

console.log(`뒤집히는 기프트 ${flips.length}`);

/** 뒤집히는 것들이 어떤 모양인가 — 트리거가 하나인가 여럿인가 */
let oneTrigger = 0;
for (const v of flips) {
	if (new Set(v.reasons.map((r) => r.triggerId)).size === 1) oneTrigger += 1;
}
console.log(`  트리거가 하나뿐인데 참조가 갈린 것 ${oneTrigger}`);
console.log(`  트리거가 여럿인 것 ${flips.length - oneTrigger}\n`);

/** 표본 — 설명문과 함께 */
const assocOnly = flips.filter((v) => {
	const bad = v.reasons.filter((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
	return bad.every((r) => r.refKind === 'association');
});
const sample = assocOnly.slice(0, 6);
const ids = sample.map((v) => v.giftId);
const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT gift_id AS "giftId", name, "desc" FROM canonical.gift_stage_text
	WHERE locale = 'ko' AND level = 0 AND gift_id = ANY(${ids}::text[])
`;
const byId = new Map(texts.map((t) => [t.giftId, t]));

for (const v of sample) {
	const t = byId.get(v.giftId);
	console.log(`── ${v.giftId} ${t?.name ?? ''}`);
	console.log(`   ${(t?.desc ?? '').split('\n').filter((l) => l.trim()).join(' / ').slice(0, 150)}`);
	for (const r of v.reasons) {
		const mark = r.verdict === 'unsatisfied' && r.certainty === 'certain' ? '✗' : ' ';
		console.log(`   ${mark} [${r.triggerId}] ${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict}`);
	}
	console.log();
}

/** 막는 조건(✗)이 어떤 종류인가 — 가려낼 신호가 있나 */
const kindOf = new Map<string, number>();
let allResonance = 0;
let hasAxis = 0;
for (const v of flips) {
	const bad = v.reasons.filter((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
	const kinds = new Set(bad.map((r) => r.refKind));
	kindOf.set([...kinds].sort().join('+'), (kindOf.get([...kinds].sort().join('+')) ?? 0) + 1);
	if (kinds.size === 1 && kinds.has('resonance')) allResonance += 1;
	if (kinds.has('axis')) hasAxis += 1;
}
console.log('=== 뒤집히는 162건에서 막는 조건의 종류 ===');
for (const [k, n] of [...kindOf].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
console.log(`\n  막는 것이 전부 resonance 인 것  ${allResonance}`);
console.log(`  막는 것에 axis 가 낀 것          ${hasAxis}`);

await prisma.$disconnect();
process.exit(0);
