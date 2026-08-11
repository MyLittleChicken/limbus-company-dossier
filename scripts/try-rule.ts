/**
 * 제안 규칙을 실측한다. 조사만 한다 — 엔진은 안 고친다.
 *
 * 규칙
 *   게이트가 있는 기프트   게이트만 발동을 막는다. 나머지 참조는 수혜 대상이다
 *   게이트가 없는 기프트   소속·유닛키워드는 적용 범위라 안 막는다
 *                          나머지(axis·attack_type·resonance·deployment)는 막는다
 *
 * 게이트 = 설명문 첫 문단이 「…N인 이상일 때 발동」이고 그 트리거에 min_count 가 있는 것
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

/** 첫 문단이 「…N인 이상일 때 발동」인 (기프트, 트리거) 짝 */
const gateRows = await prisma.$queryRaw<Array<{ giftId: string; triggerId: string }>>`
	SELECT DISTINCT p.gift_id AS "giftId", p.trigger_id AS "triggerId"
	FROM canonical.gift_trigger_param p
	JOIN canonical.gift_stage_text t
	  ON t.gift_id = p.gift_id AND t.locale = 'ko' AND t.level = 0
	WHERE p.kind = 'min_count'
	  AND split_part(replace(t."desc", chr(10), '|'), '|', 1) ~ '[0-9]인 이상.*발동'
`;
const gateOf = new Map<string, Set<string>>();
for (const r of gateRows) {
	const s = gateOf.get(r.giftId);
	if (s === undefined) gateOf.set(r.giftId, new Set([r.triggerId]));
	else s.add(r.triggerId);
}
console.log(`게이트를 가진 기프트 ${gateOf.size}`);

const SCOPE = new Set(['association', 'unit_keyword']);
const blocks = (v: typeof verdicts[number], r: typeof verdicts[number]['reasons'][number]): boolean => {
	if (!(r.verdict === 'unsatisfied' && r.certainty === 'certain')) return false;
	const gates = gateOf.get(v.giftId);
	if (gates !== undefined) return gates.has(r.triggerId);   // 게이트만 막는다
	return !SCOPE.has(r.refKind);                              // 적용 범위는 안 막는다
};

let now = 0, next = 0;
const revived: string[] = [];
const stillDead: string[] = [];
for (const v of verdicts) {
	const nowDead = v.reasons.some((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
	const nextDead = v.reasons.some((r) => blocks(v, r));
	if (nowDead) now += 1;
	if (nextDead) next += 1;
	if (nowDead && !nextDead) revived.push(v.giftId);
	if (nowDead && nextDead) stillDead.push(v.giftId);
}
console.log(`\n죽는 기프트  지금 ${now} → 새 규칙 ${next}   (살아나는 것 ${revived.length})`);
console.log(`기프트 총 ${verdicts.length} · 발동 가능 ${verdicts.length - now} → ${verdicts.length - next}`);

const check = (id: string, want: '산다' | '죽는다', why: string): void => {
	const v = verdicts.find((x) => x.giftId === id);
	const dead = v !== undefined && v.reasons.some((r) => blocks(v, r));
	const got = dead ? '죽는다' : '산다';
	console.log(`  ${got === want ? 'OK ' : '어긋남'}  ${id} ${got}  (기대 ${want})  ${why}`);
};
console.log('\n=== 손으로 판정한 것들과 대조 ===');
check('9140', '산다', '결의 — 시 협회는 적용 범위, 참격으로 발동한다');
check('9194', '산다', '케인 소드 — 세븐 협회는 적용 범위');
check('9005', '죽는다', '상처붙이 — 출혈이 진짜 조건');
check('9023', '죽는다', '벼락가지 — 파열이 진짜 조건');
check('9048', '죽는다', '커터 나이프 — 출혈이 조건, 색욕은 강화');
check('9041', '죽는다', '적색 지령 — 침잠이 조건');
check('9718', '죽는다', '검계 3인 게이트 — 이 덱에 검계가 없다');
check('9717', '죽는다', '흑운회 3인 게이트');
check('9043', '죽는다', '사원증 — 진짜 OR 이지만 이 PR 로는 못 고친다');
check('9052', '죽는다', '전지 소켓 — 우선순위 주석 문제, 이 PR 밖');

await prisma.$disconnect();
process.exit(0);
