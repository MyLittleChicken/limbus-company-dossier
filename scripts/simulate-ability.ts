/**
 * 새 절 데이터로 판정하면 어떻게 되는지 **재기만 한다**. 엔진은 안 바꾼다.
 *
 * 1단계는 데이터만 만든다. 판정을 옮기는 것은 2단계 PR 이라 지금 엔진은 아직
 * 옛 표를 읽는다 — 그러면 「이 작업이 무엇을 고쳤나」가 안 보인 채 머지된다.
 * 그래서 사양 §3 의 판정 규칙을 여기서 그대로 흉내 내 옛 판정과 나란히 잰다.
 *
 * **여기 있는 규칙이 2단계의 명세다.** 옮길 때 이 파일과 결과가 같아야 한다.
 *
 * 실행: npm run gift:sim
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGiftsLegacy } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const ROSTER_SIZE = 12;
const FIELD_SIZE = 7;
const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/sim.md';
/** 새 판은 wip 에 있다 — 승격 전에도 재려면 스키마를 골라야 한다 */
const schema = argv.indexOf('--schema') >= 0 ? argv[argv.indexOf('--schema') + 1] : 'wip';

const prisma = new PrismaClient();

// ── 공급 표 — refKind 마다 세는 자리가 다르다 ───────────────────
const q = <T>(sql: string): Promise<T[]> => prisma.$queryRawUnsafe<T[]>(sql);

const axisTag = await q<{ identityId: string; axisId: string }>(
	`SELECT identity_id AS "identityId", axis_id AS "axisId" FROM canonical.identity_axis
	 WHERE gate_kind='always' AND affects IN ('tag','both')`);
const axisSkill = await q<{ identityId: string; axisId: string }>(
	`SELECT DISTINCT i.identity_id AS "identityId", upper(c.token) AS "axisId"
	 FROM canonical.identity_skill i JOIN canonical.coin_token c ON c.skill_id=i.skill_id
	 WHERE upper(c.token) IN ('COMBUSTION','LACERATION','BURST','BREATH','VIBRATION','SINKING','CHARGE','BULLET')`);
const assocRows = await q<{ identityId: string; associationId: string }>(
	`SELECT identity_id AS "identityId", association_id AS "associationId" FROM canonical.identity_association`);
const unitRows = await q<{ identityId: string; keyword: string }>(
	`SELECT identity_id AS "identityId", keyword FROM canonical.identity_unit_keyword`);
const sinRows = await q<{ identityId: string; sin: string }>(
	`SELECT DISTINCT i.identity_id AS "identityId", lower(s.sin::text) AS sin
	 FROM canonical.identity_skill i JOIN canonical.skill s ON s.id=i.skill_id WHERE s.sin IS NOT NULL`);
const atkRows = await q<{ identityId: string; t: string }>(
	`SELECT DISTINCT i.identity_id AS "identityId", lower(s.attack_type::text) AS t
	 FROM canonical.identity_skill i JOIN canonical.skill s ON s.id=i.skill_id WHERE s.attack_type IS NOT NULL`);
const kindRows = await q<{ identityId: string; k: string }>(
	`SELECT DISTINCT i.identity_id AS "identityId", lower(s.kind::text) AS k
	 FROM canonical.identity_skill i JOIN canonical.skill s ON s.id=i.skill_id WHERE s.kind IS NOT NULL`);
const minusRows = await q<{ identityId: string }>(
	`SELECT DISTINCT i.identity_id AS "identityId"
	 FROM canonical.identity_skill i JOIN canonical.skill_stage s ON s.skill_id=i.skill_id
	 WHERE s.coin_value < 0`);

const set = <T>(rows: T[], k: (r: T) => string, v: (r: T) => string): Map<string, Set<string>> => {
	const m = new Map<string, Set<string>>();
	for (const r of rows) {
		const key = k(r);
		if (!m.has(key)) m.set(key, new Set());
		m.get(key)?.add(v(r));
	}
	return m;
};
const AXIS_TAG = set(axisTag, (r) => r.axisId, (r) => r.identityId);
const AXIS_SKILL = set(axisSkill, (r) => r.axisId, (r) => r.identityId);
const ASSOC = set(assocRows, (r) => r.associationId, (r) => r.identityId);
const UNIT = set(unitRows, (r) => r.keyword, (r) => r.identityId);
const SIN = set(sinRows, (r) => r.sin, (r) => r.identityId);
const ATK = set(atkRows, (r) => r.t, (r) => r.identityId);
const KIND = set(kindRows, (r) => r.k, (r) => r.identityId);
const MINUS = new Set(minusRows.map((r) => r.identityId));

/** 절 데이터 */
const abilities = await q<{
	giftId: string; level: number; ordinal: number;
	unconditional: boolean; refines: number | null;
}>(`SELECT gift_id AS "giftId", level, ordinal, unconditional, refines
    FROM ${schema}.gift_ability WHERE level = 0`);
const conds = await q<{
	giftId: string; level: number; ordinal: number; grp: number;
	refKind: string; refId: string; op: string; threshold: number | null;
	scope: string; supply: string; slot: number | null; runtime: boolean;
}>(`SELECT gift_id AS "giftId", level, ordinal, "group" AS grp, ref_kind AS "refKind",
      ref_id AS "refId", op, threshold, scope, supply, slot, runtime
    FROM ${schema}.gift_ability_cond WHERE level = 0`);

const condsOf = new Map<string, typeof conds>();
for (const c of conds) {
	const k = `${c.giftId}\t${c.ordinal}`;
	condsOf.set(k, [...(condsOf.get(k) ?? []), c]);
}
const abilOf = new Map<string, typeof abilities>();
for (const a of abilities) abilOf.set(a.giftId, [...(abilOf.get(a.giftId) ?? []), a]);

// ── 덱 ─────────────────────────────────────────────────────────
const allIds = [...new Set(assocRows.map((r) => r.identityId))].sort();
const group = <T>(rows: T[], k: (r: T) => string, v: (r: T) => string) => {
	const m = new Map<string, string[]>();
	for (const r of rows) m.set(k(r), [...(m.get(k(r)) ?? []), v(r)]);
	return m;
};
const axisMembers = group(axisTag, (r) => r.axisId, (r) => r.identityId);
const assocMembers = group(assocRows, (r) => r.associationId, (r) => r.identityId);
const buildSquad = (core: string[]): Squad => {
	const picked = [...new Set(core)].slice(0, ROSTER_SIZE);
	const roster = [...picked, ...allIds.filter((id) => !picked.includes(id))].slice(0, ROSTER_SIZE);
	return { roster: roster.map((identityId) => ({ identityId, egoIds: [] })), field: roster.slice(0, FIELD_SIZE) };
};
const decks: Array<[string, Squad]> = [];
for (const [ax, ids] of [...axisMembers].sort()) if (ids.length >= FIELD_SIZE) decks.push([`축:${ax}`, buildSquad(ids)]);
for (const [a, ids] of [...assocMembers].sort()) if (ids.length >= 1) decks.push([`소속:${a}`, buildSquad(ids)]);
for (const [ax, aids] of [...axisMembers].sort()) {
	for (const a of ['BLADE_LINEAGE', 'BLACK_CLOUD', 'MIDDLE_FINGER', 'RING_FINGER', 'LA_MANCHA_LAND',
		'PEQUOD_CREW', 'DAWN', 'THUMB_FINGER', 'N_CORP', 'SPIDER_HOUSE']) {
		const asIds = assocMembers.get(a) ?? [];
		if (aids.length === 0 || asIds.length === 0) continue;
		decks.push([`혼합:${ax}+${a}`, buildSquad([...aids.slice(0, 6), ...asIds.slice(0, 6)])]);
	}
}
for (let off = 0; off < allIds.length; off += 17) {
	decks.push([`순환:${off}`, buildSquad(Array.from({ length: ROSTER_SIZE },
		(_, i) => allIds[(off + i * 7) % allIds.length]))]);
}

/** 이 편성에서 그 참조를 몇이 공급하나 */
function supplyOf(squad: Squad, c: typeof conds[number]): number {
	const roster = squad.roster.map((r) => r.identityId);
	const field = squad.field;
	const waiting = roster.filter((id) => !field.includes(id));
	const pool = c.scope === 'roster' ? roster : c.scope === 'waiting' ? waiting : field;

	if (c.refKind === 'deployment') {
		const n = c.slot ?? Number((/[0-9]+/.exec(c.refId) ?? ['0'])[0]);
		return field.length >= n ? 1 : 0;
	}
	let members: Set<string> | undefined;
	if (c.refKind === 'axis') members = c.supply === 'skill' ? AXIS_SKILL.get(c.refId) : AXIS_TAG.get(c.refId);
	else if (c.refKind === 'association') members = ASSOC.get(c.refId);
	else if (c.refKind === 'unit_keyword') members = UNIT.get(c.refId);
	else if (c.refKind === 'sin' || c.refKind === 'resonance') members = SIN.get(c.refId);
	else if (c.refKind === 'attack_type') members = ATK.get(c.refId);
	else if (c.refKind === 'skill_kind') members = KIND.get(c.refId);
	else if (c.refKind === 'coin') members = c.refId === 'minus' ? MINUS : undefined;
	if (members === undefined) return -1; // 셀 방법이 없다 — 배제 안 한다
	return pool.filter((id) => members.has(id)).length;
}

/** 사양 §3 의 판정 규칙 */
function fireable(giftId: string, squad: Squad): boolean {
	const abils = (abilOf.get(giftId) ?? []).filter((a) => a.refines === null);
	if (abils.length === 0) return true; // 절이 없으면 판정 보류 — 죽이지 않는다
	return abils.some((a) => {
		if (a.unconditional) return true;
		const cs = condsOf.get(`${giftId}\t${a.ordinal}`) ?? [];
		if (cs.length === 0) return true; // 결손 — 모른다를 아니다로 쓰지 않는다
		const groups = new Map<number, typeof cs>();
		for (const c of cs) groups.set(c.grp, [...(groups.get(c.grp) ?? []), c]);
		// group 끼리 AND · group 안은 OR
		return [...groups.values()].every((g) => g.some((c) => {
			if (c.runtime) return true;
			const have = supplyOf(squad, c);
			if (have < 0) return true;
			if (c.op === 'has') return have >= 1;
			if (c.threshold === null) return true; // 문턱을 모른다 — 배제 안 한다
			return have >= c.threshold;
		}));
	});
}

// ── 옛 판정과 나란히 ────────────────────────────────────────────
const data = await loadEngineData(prisma);
// `load.ts` 는 이 표를 더 안 읽는다 — 옛 판정만 쓰므로 여기서 직접 읽는다
const params = await prisma.giftTriggerParam.findMany({
	select: { giftId: true, triggerId: true, kind: true, tier: true, value: true, slots: true },
});
const giftIds = [...new Set(abilities.map((a) => a.giftId))];
const oldAlive = new Map<string, number>();
const newAlive = new Map<string, number>();

for (const [, squad] of decks) {
	// **옛 판정**과 견준다. 이 스크립트가 2단계의 명세였고, 엔진이 옮겨간
	// 지금은 `scripts/verdict-diff.ts` 가 같은 대조를 엔진 자체로 한다
	const verdicts = evaluateGiftsLegacy({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params,
	});
	for (const v of verdicts) if (v.fireable) oldAlive.set(v.giftId, (oldAlive.get(v.giftId) ?? 0) + 1);
	for (const id of giftIds) if (fireable(id, squad)) newAlive.set(id, (newAlive.get(id) ?? 0) + 1);
}

const N = decks.length;
const evaluated = giftIds.filter((id) => oldAlive.has(id) || newAlive.has(id));
const alwaysOld = evaluated.filter((id) => (oldAlive.get(id) ?? 0) === N).length;
const alwaysNew = evaluated.filter((id) => (newAlive.get(id) ?? 0) === N).length;
const deadOld = evaluated.filter((id) => (oldAlive.get(id) ?? 0) === 0).length;
const deadNew = evaluated.filter((id) => (newAlive.get(id) ?? 0) === 0).length;

console.log(`덱 ${N} · 기프트 ${evaluated.length}\n`);
console.log('                      옛 판정   새 판정');
console.log(`전 덱에서 켜진다       ${String(alwaysOld).padStart(6)}   ${String(alwaysNew).padStart(6)}`);
console.log(`전 덱에서 죽는다       ${String(deadOld).padStart(6)}   ${String(deadNew).padStart(6)}`);

const KNOWN = ['9246', '9778', '9271', '9843', '9262', '9268'];
console.log('\n게이트 PR 이 결손으로 넘긴 여섯 (전 덱에서 켜지면 과대 판정)');
for (const id of KNOWN) {
	console.log(`  ${id}  옛 ${String(oldAlive.get(id) ?? 0).padStart(3)}/${N}  →  새 ${String(newAlive.get(id) ?? 0).padStart(3)}/${N}`);
}

const moved = evaluated
	.map((id) => ({ id, o: oldAlive.get(id) ?? 0, n: newAlive.get(id) ?? 0 }))
	.filter((r) => r.o !== r.n);
console.log(`\n판정이 바뀐 기프트 ${moved.length}`);
console.log(`  더 많이 켜짐 ${moved.filter((r) => r.n > r.o).length} · 더 적게 켜짐 ${moved.filter((r) => r.n < r.o).length}`);

const md = [
	'# 새 절 데이터로 판정하면',
	'', `덱 ${N} · 기프트 ${evaluated.length}`, '',
	'| | 옛 판정 | 새 판정 |', '|---|---|---|',
	`| 전 덱에서 켜진다 | ${alwaysOld} | ${alwaysNew} |`,
	`| 전 덱에서 죽는다 | ${deadOld} | ${deadNew} |`,
	'', '## 결손 여섯', '',
	...KNOWN.map((id) => `- ${id} — 옛 ${oldAlive.get(id) ?? 0}/${N} → 새 ${newAlive.get(id) ?? 0}/${N}`),
	'', `## 판정이 바뀐 ${moved.length}건`, '',
	...moved.sort((a, b) => (b.o - b.n) - (a.o - a.n)).slice(0, 60)
		.map((r) => `- ${r.id} — ${r.o} → ${r.n}`),
];
writeFileSync(out, md.join('\n'), 'utf8');
console.log(`\n→ ${out}`);

await prisma.$disconnect();
process.exit(0);
