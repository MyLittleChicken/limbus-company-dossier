/**
 * 12덱 검증이 찾은 과소 판정을 한 표로 낸다. 조사만 한다.
 *
 * 각 기프트마다 어느 덱에서 죽었는지, 무엇이 막았는지, 설명문이 뭐라 하는지를
 * 함께 낸다 — 사람이 하나씩 대조할 수 있게.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

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

/** 검증이 과소 판정으로 지목한 기프트 */
const FLAGGED = ['9802', '9803', '9804', '9115', '9239', '9049', '9123', '9261', '9747', '9104', '9043', '9052', '9828'];

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT gift_id AS "giftId", name, "desc" FROM canonical.gift_stage_text
	WHERE locale = 'ko' AND level = 0 AND gift_id = ANY(${FLAGGED}::text[])
`;
const textOf = new Map(texts.map((t) => [t.giftId, t]));

type Hit = { deck: string; blockers: string[] };
const hits = new Map<string, Hit[]>();
const aliveIn = new Map<string, string[]>();

for (const [deckName, ids] of DECKS) {
	const squad: Squad = { roster: ids.map((identityId) => ({ identityId, egoIds: [] })), field: ids };
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		if (!FLAGGED.includes(v.giftId)) continue;
		if (v.fireable) {
			aliveIn.set(v.giftId, [...(aliveIn.get(v.giftId) ?? []), deckName]);
			continue;
		}
		const blockers = v.reasons
			.filter((r) => r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain')
			.map((r) => `${r.refKind}/${r.refId} ${r.have}<${r.need}`);
		hits.set(v.giftId, [...(hits.get(v.giftId) ?? []), { deck: deckName, blockers }]);
	}
}

/** 첫 문단만 — 무조건 절인지 보려는 것이다 */
const firstPara = (d: string): string =>
	(d.split(/\n+/).find((p) => p.trim().length > 0) ?? '').trim();

console.log('# 과소 판정 목록 — 12덱 검증\n');
for (const id of FLAGGED) {
	const t = textOf.get(id);
	const dead = hits.get(id) ?? [];
	const alive = aliveIn.get(id) ?? [];
	console.log(`## ${id} ${t?.name ?? ''}`);
	console.log(`   첫 문단: ${firstPara(t?.desc ?? '').slice(0, 90)}`);
	console.log(`   죽는 덱: ${dead.map((h) => h.deck).join(' · ') || '(없음)'}`);
	if (alive.length > 0) console.log(`   켜지는 덱: ${alive.join(' · ')}`);
	const blockers = [...new Set(dead.flatMap((h) => h.blockers))];
	console.log(`   막는 근거: ${blockers.join(' | ') || '(없음)'}`);
	console.log();
}

await prisma.$disconnect();
process.exit(0);
