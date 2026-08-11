/**
 * 이 회차의 규칙이 과대 판정을 몇 건 만들었나. 조사만 한다.
 *
 * 규칙: 게이트가 없는 기프트에서 association·unit_keyword 는 적용 범위라 안 막는다.
 *
 * 근거는 9140 결의였다 — 「무조건 본 효과 + 소속 전용 추가」 구조라 소속이 없어도
 * 본 효과가 돈다. 그런데 **절이 전부 소속에 묶인** 기프트도 있다(9246 · 9271).
 * 그런 기프트는 소속이 없으면 아무 일도 안 일어나므로 죽는 것이 옳다.
 *
 * 가르는 것은 「무조건 절이 있는가」이고, 그것은 절 구조 없이는 정확히 못 안다.
 * 여기서는 설명문 문형으로 근사해 규모만 잰다.
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

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
`;
const textOf = new Map(texts.map((t) => [t.giftId, t]));

/** 조건을 여는 표지. 하나도 안 걸리면 그 절은 무조건이다 */
const COND = [
	/할 경우|한 경우|일 경우|인 경우/, /할 때|했을 때|일 때|였을 때|때마다/,
	/하였다면|한다면|이라면|있다면|없다면|이면|면,/, /적중 시|승리 시|처치 시|사용 시|사용할/,
	/이상|이하|초과|미만/, /보유하고 있|보유 시|걸린 적/, /소속 인격|^-/,
];
const TIMING_ONLY = /^(턴 시작 시|턴 종료 시|전투 시작 시|스테이지 시작 시|스테이지 첫 턴)/;
const hasUnconditional = (desc: string): boolean =>
	desc.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0).some((p) => {
		const body = TIMING_ONLY.test(p) ? p.replace(TIMING_ONLY, '') : p;
		return !COND.some((re) => re.test(body));
	});

const SCOPE = new Set(['association', 'unit_keyword']);
/** 지금 규칙으로 살았지만 옛 규칙으로는 죽었을 기프트 */
const revived = new Map<string, Set<string>>();

for (const [deckName, ids] of DECKS) {
	const squad: Squad = { roster: ids.map((identityId) => ({ identityId, egoIds: [] })), field: ids };
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		if (!v.fireable) continue;
		// 옛 규칙 = 모든 근거가 막는다
		const wouldDie = v.reasons.some((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
		if (!wouldDie) continue;
		// 살아난 이유가 적용 범위 규칙인가
		const byScope = v.reasons.some(
			(r) => !r.blocking && SCOPE.has(r.refKind) && r.verdict === 'unsatisfied' && r.certainty === 'certain',
		);
		if (byScope) revived.set(v.giftId, new Set([...(revived.get(v.giftId) ?? []), deckName]));
	}
}

/** 게이트 규칙만 남기고 적용 범위 규칙을 뺀다면 — 덱별 죽는 수 */
const gateOnlyDead = new Map<string, number>();
const bothDead = new Map<string, number>();
for (const [deckName, ids2] of DECKS) {
	const squad: Squad = { roster: ids2.map((identityId) => ({ identityId, egoIds: [] })), field: ids2 };
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	let g = 0, b = 0;
	for (const v of verdicts) {
		if (!v.fireable) b += 1;
		// 게이트만 남긴 규칙: 게이트가 있으면 게이트만, 없으면 전부 막는다
		const hasGate = v.reasons.some((r) => r.blocking && v.reasons.some((x) => x.triggerId === r.triggerId));
		const anyGate = v.reasons.some((r) => r.blocking) && v.reasons.some((r) => !r.blocking && SCOPE.has(r.refKind)) === false;
		const dieGateOnly = v.reasons.some((r) =>
			r.verdict === 'unsatisfied' && r.certainty === 'certain' &&
			(r.blocking || SCOPE.has(r.refKind)));
		if (dieGateOnly) g += 1;
		void hasGate; void anyGate;
	}
	gateOnlyDead.set(deckName, g);
	bothDead.set(deckName, b);
}
console.log('덱별 죽는 기프트 — 지금 규칙 vs 적용범위 규칙을 뺀 경우');
for (const [d] of DECKS) console.log(`  ${d.padEnd(4)} 지금 ${String(bothDead.get(d)).padStart(3)}  ·  적용범위 뺌 ${String(gateOnlyDead.get(d)).padStart(3)}`);
console.log();

const ids = [...revived.keys()].sort();
const safe = ids.filter((id) => hasUnconditional(textOf.get(id)?.desc ?? ''));
const risky = ids.filter((id) => !hasUnconditional(textOf.get(id)?.desc ?? ''));

console.log(`적용 범위 규칙으로 살아난 기프트 ${ids.length} (12덱 합집합)`);
console.log(`  무조건 절이 있다 — 살아나는 것이 옳다      ${safe.length}`);
console.log(`  무조건 절이 없다 — **과대 판정 후보**       ${risky.length}\n`);
console.log('과대 판정 후보');
for (const id of risky) {
	const t = textOf.get(id);
	console.log(`  ${id} ${(t?.name ?? '').padEnd(18)} 살아나는 덱 ${revived.get(id)?.size}/12`);
	console.log(`     ${(t?.desc ?? '').split('\n').filter((l) => l.trim())[0]?.slice(0, 76) ?? ''}`);
}

await prisma.$disconnect();
process.exit(0);
