/**
 * 「…수에 따라 기프트 효과 강화」 6건이 지금 어떻게 판정되는지 잰다. 조사만 한다.
 *
 * 사용자 확정(2026-08-11)으로 절의 종류가 갈렸다.
 *   기본 효과   조건 없음                      거울 속의 꽃 1문단
 *   조건 효과   기본이나 공급 조건이 붙음        전격부 1문단(충전 소모 인격 필요)
 *   추가 효과   「- N인 이상」 티어              미달이어도 앞 절은 돈다
 *   배수 효과   크기가 (편성 수 × k)            발동은 하되 0이면 무의미
 * 발동 판정은 「절 하나라도 서면 켜진다」이고, 티어는 발동 조건이 아니다.
 *
 * 각 기프트마다 「지금 켜지는 덱」과 「공급 조건이 서는 덱」을 나란히 내
 * 둘이 어긋나는 곳을 보인다.
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

/** 여섯 건과, 사용자가 확정한 「기본 절이 서기 위한 공급 조건」 */
const SIX: Array<{ id: string; name: string; need: string }> = [
	{ id: '9803', name: '거울 속의 꽃', need: '없음 — 매 턴 파열 3은 무조건' },
	{ id: '9802', name: '전격부', need: '충전 소모 인격 1명 이상' },
	{ id: '9804', name: '물 속의 달', need: '파열 공급 1명 이상' },
	{ id: '9235', name: '데스페라도', need: '탄환 인격 2명 이상 — 기본 절이 없다' },
	{ id: '9842', name: '피로 된 살점', need: '없음 — 출혈 3은 고정값' },
	{ id: '9843', name: '경혈식 글레이브', need: '없음 — 발동하되 크기 0' },
];

const alive = new Map<string, string[]>();
for (const [deckName, squad] of decks) {
	const p = new Profile(squad, data.capabilities);
	const verdicts = evaluateGifts({
		squad, profile: p, giftTriggers: data.giftTriggers,
		refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		if (!SIX.some((s) => s.id === v.giftId)) continue;
		if (v.fireable) alive.set(v.giftId, [...(alive.get(v.giftId) ?? []), deckName]);
	}
}

/** 축별 공급량 — 「이 덱에 그 축 인격이 몇이나 있나」를 곁들여 본다 */
const supply = (axis: string): string[] =>
	decks.filter(([, s]) => new Profile(s, data.capabilities).count('axis', axis, 'roster') > 0)
		.map(([n]) => n);

console.log(`덱 ${decks.length}개 · 편성 ${ROSTER_SIZE} / 출격 ${FIELD_SIZE}\n`);
for (const s of SIX) {
	const a = alive.get(s.id) ?? [];
	console.log(`${s.name}  (${s.id})`);
	console.log(`  있어야 할 조건  ${s.need}`);
	console.log(`  지금 켜지는 덱  ${a.length} / ${decks.length}   ${a.slice(0, 8).join(' · ')}${a.length > 8 ? ' …' : ''}`);
	console.log();
}

console.log('참고 — 축 공급이 있는 덱 수');
for (const ax of ['CHARGE', 'BURST', 'BULLET', 'BREATH']) {
	console.log(`  ${ax.padEnd(11)} ${supply(ax).length} / ${decks.length} 덱`);
}

await prisma.$disconnect();
process.exit(0);
