/**
 * 적용 범위 규칙을 빼면(A안) 무엇이 달라지는지 잰다. 조사만 한다.
 *
 * 이 PR 은 규칙 둘을 함께 넣었다.
 *   게이트 규칙    첫 문단에 「발동」이 있으면 그 문단의 「N인 이상」이 게이트다.
 *                게이트가 있으면 게이트만 막는다
 *   적용 범위 규칙  게이트가 없으면 association·unit_keyword 는 안 막는다
 *
 * A안은 게이트 규칙만 남긴다. 잃는 것(옳게 살아난 것이 다시 죽음)과
 * 얻는 것(과대 판정이 사라짐)을 덱마다 세어 낸다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const ROSTER_SIZE = 12;
const FIELD_SIZE = 7;
const SCOPE = new Set(['association', 'unit_keyword']);

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
const buildSquad = (core: string[]): Squad => {
	const picked = [...new Set(core)].slice(0, ROSTER_SIZE);
	const roster = [...picked, ...allIds.filter((id) => !picked.includes(id))].slice(0, ROSTER_SIZE);
	return { roster: roster.map((identityId) => ({ identityId, egoIds: [] })), field: roster.slice(0, FIELD_SIZE) };
};
const decks: Array<[string, Squad]> = [];
for (const [axisId, ids] of [...axisMembers].sort()) {
	if (ids.length >= FIELD_SIZE) decks.push([axisId, buildSquad(ids)]);
}
for (const a of ['BLADE_LINEAGE','BLACK_CLOUD','MIDDLE_FINGER','RING_FINGER','INDEX_FINGER',
	'THUMB_FINGER','LITTLE_FINGER','PEQUOD_CREW','DAWN','LA_MANCHA_LAND','LIMBUS_COMPANY',
	'LIU','ZWEI','N_CORP','W_CORP','R_CORP','T_CORP','H_CORP','L_CORP','G_CORP','K_CORP',
	'S_CORP','SPIDER_HOUSE','MOLAR','SHI','CINQ','SEVEN','DIECI','ATL','MULTI_CRACK',
	'WUTHERING_HEIGHTS','BLACK_BEAST_RABBIT','BLACK_BEAST_CHICKEN','TROUBLE_SHOOTER']) {
	const ids = assocMembers.get(a) ?? [];
	if (ids.length > 0) decks.push([a, buildSquad(ids)]);
}

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string }>>`
	SELECT t.gift_id AS "giftId", t.name FROM canonical.gift_stage_text t
	JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale='ko' AND t.level=0 AND g.domain='mirror_dungeon'
`;
const nameOf = new Map(texts.map((t) => [t.giftId, t.name]));

/** 지금 규칙 / 적용 범위 규칙을 뺀 규칙, 둘로 켜지는 덱을 센다 */
const aliveNow = new Map<string, number>();
const aliveGateOnly = new Map<string, number>();
for (const [, squad] of decks) {
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		if (v.fireable) aliveNow.set(v.giftId, (aliveNow.get(v.giftId) ?? 0) + 1);
		/**
		 * A안 재현 — 게이트가 있으면 지금 판정 그대로, 없으면 적용 범위 예외를 되돌린다.
		 * `blocking` 이 false 인데 refKind 가 적용 범위면 그건 이 규칙이 푼 것이므로 다시 막는다.
		 */
		const dies = v.reasons.some((r) =>
			r.verdict === 'unsatisfied' && r.certainty === 'certain' &&
			(r.blocking || SCOPE.has(r.refKind)));
		if (!dies) aliveGateOnly.set(v.giftId, (aliveGateOnly.get(v.giftId) ?? 0) + 1);
	}
}

const N = decks.length;
const changed = [...nameOf.keys()]
	.map((id) => ({ id, now: aliveNow.get(id) ?? 0, gate: aliveGateOnly.get(id) ?? 0 }))
	.filter((r) => r.now !== r.gate)
	.sort((a, b) => (b.now - b.gate) - (a.now - a.gate));

console.log(`덱 ${N}개 · 편성 ${ROSTER_SIZE} / 출격 ${FIELD_SIZE}`);
console.log(`적용 범위 규칙이 판정을 바꾸는 기프트  ${changed.length}\n`);
console.log('기프트                          지금   A안    차이');
for (const c of changed) {
	console.log(`  ${(nameOf.get(c.id) ?? c.id).padEnd(28)} ${String(c.now).padStart(3)}/${N}  ${String(c.gate).padStart(3)}/${N}  ${String(c.now - c.gate).padStart(4)}`);
}

const totalNow = [...aliveNow.values()].reduce((a, b) => a + b, 0);
const totalGate = [...aliveGateOnly.values()].reduce((a, b) => a + b, 0);
console.log(`\n덱-건 합계   지금 ${totalNow}   A안 ${totalGate}   차이 ${totalNow - totalGate}`);

await prisma.$disconnect();
process.exit(0);
