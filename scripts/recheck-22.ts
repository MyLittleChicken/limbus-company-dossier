/**
 * 앞서 오판정으로 지목한 22건이 올바른 편성 모형에서 어떻게 되는지 다시 잰다.
 *
 * 앞 검증은 편성 6인 · 출격 6인 · 대기 0인이었다. 실제는 편성 12 · 출격 7 · 대기 5다.
 * 분모가 셋 다 달라졌으므로 판정도 달라진다. 조사만 한다.
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

const UNDER = ['9802','9803','9804','9104','9043','9052','9747','9115','9828','9239','9049','9123','9261'];
const OVER = ['9246','9271','9420','9737','9778','9842','9843','9796','9819'];
const FIVE = ['9212','9282','9283','9795','9759'];
const ALL = [...UNDER, ...OVER, ...FIVE];

const names = await prisma.$queryRaw<Array<{ giftId: string; name: string }>>`
	SELECT gift_id AS "giftId", name FROM canonical.gift_stage_text
	WHERE locale='ko' AND level=0 AND gift_id = ANY(${ALL}::text[])
`;
const nameOf = new Map(names.map((n) => [n.giftId, n.name]));

const alive = new Map<string, string[]>();
const blockedBy = new Map<string, Set<string>>();
for (const [deckName, squad] of decks) {
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		if (!ALL.includes(v.giftId)) continue;
		if (v.fireable) alive.set(v.giftId, [...(alive.get(v.giftId) ?? []), deckName]);
		else for (const r of v.reasons) {
			if (r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain') {
				const s = blockedBy.get(v.giftId) ?? new Set();
				s.add(`${r.refKind}/${r.refId} ${r.have}<${r.need}`);
				blockedBy.set(v.giftId, s);
			}
		}
	}
}

const N = decks.length;
const show = (title: string, ids: string[]) => {
	console.log(`\n=== ${title} ===`);
	for (const id of ids) {
		const a = alive.get(id) ?? [];
		const mark = a.length === 0 ? '전멸' : a.length === N ? '전덱' : `${a.length}/${N}`;
		console.log(`  ${(nameOf.get(id) ?? id).padEnd(24)} ${mark.padStart(6)}  ${a.length > 0 && a.length < N ? a.slice(0, 5).join(' · ') : ''}`);
		if (a.length === 0) console.log(`      막음: ${[...(blockedBy.get(id) ?? [])].join(' | ')}`);
	}
};
console.log(`덱 ${N}개 · 편성 ${ROSTER_SIZE} / 출격 ${FIELD_SIZE} / 대기 ${ROSTER_SIZE - FIELD_SIZE}`);
show('과소 판정으로 지목했던 13건', UNDER);
show('과대 판정으로 지목했던 9건 — 전덱이면 여전히 과대 의심', OVER);
show('「정당하게 죽는다」고 했던 5건', FIVE);

await prisma.$disconnect();
process.exit(0);
