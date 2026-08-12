/**
 * 옛 판정과 새 판정을 163덱으로 나란히 잰다.
 *
 * **`scripts/simulate-ability.ts` 와 결과가 같아야 한다.** 그 파일이 2단계의
 * 명세이고, 여기는 엔진이 실제로 그렇게 판정하는지 보는 자리다.
 *
 * 가장 중요한 수는 **새로 죽는 기프트**다 — 옛 판정에서 살던 것이 새 판정에서
 * 죽으면 거짓 죽음일 수 있고, 거짓 죽음은 과대 판정보다 나쁘다(사용자가 존재를
 * 아예 모르게 된다).
 *
 * 실행: npm run gift:verdict-diff
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts, evaluateGiftsLegacy } from '../lib/engine/v2/evaluate.js';
import type { Squad, TriggerParam } from '../lib/engine/v2/types.js';

const ROSTER = 12;
const FIELD = 7;
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const out = outIdx >= 0 ? String(argv[outIdx + 1]) : 'verdict-diff.md';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

/**
 * **옛 판정만 쓰는 표다.** `load.ts` 는 이제 안 읽는다 — 실서비스가 폐기 표를
 * 하나 덜 보게 하려고 여기로 옮겼다. 이 대조가 끝나면 이 질의도 사라진다.
 */
const params = await prisma.giftTriggerParam.findMany({
	select: { giftId: true, triggerId: true, kind: true, tier: true, value: true, slots: true },
}) as TriggerParam[];

const names = new Map(
	(await prisma.$queryRaw<Array<{ giftId: string; name: string }>>`
		SELECT gift_id AS "giftId", name FROM canonical.gift_stage_text
		WHERE locale = 'ko' AND level = 0
	`).map((r) => [r.giftId, r.name]),
);

const allIds = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))].sort();
const buildSquad = (core: string[]): Squad => {
	const picked = [...new Set(core)].slice(0, ROSTER);
	const roster = [...picked, ...allIds.filter((id) => !picked.includes(id))].slice(0, ROSTER);
	return {
		roster: roster.map((identityId) => ({ identityId, egoIds: [] })),
		field: roster.slice(0, FIELD),
	};
};

/** 축 8 · 소속 64 · 혼합 80 · 순환 — 넓게 훑어야 한 덱의 우연이 안 섞인다 */
const decks: Array<[string, Squad]> = [];
for (const [ax, ids] of [...data.supply.axisTag].sort()) {
	if (ids.size >= FIELD) decks.push([`축:${ax}`, buildSquad([...ids])]);
}
for (const [a, ids] of [...data.supply.association].sort()) {
	if (ids.size >= 1) decks.push([`소속:${a}`, buildSquad([...ids])]);
}
for (const [ax, aids] of [...data.supply.axisTag].sort()) {
	for (const a of ['BLADE_LINEAGE', 'BLACK_CLOUD', 'MIDDLE_FINGER', 'RING_FINGER',
		'LA_MANCHA_LAND', 'PEQUOD_CREW', 'DAWN', 'THUMB_FINGER', 'N_CORP', 'SPIDER_HOUSE']) {
		const asIds = data.supply.association.get(a);
		if (asIds === undefined || aids.size === 0) continue;
		decks.push([`혼합:${ax}+${a}`, buildSquad([...[...aids].slice(0, 6), ...[...asIds].slice(0, 6)])]);
	}
}
for (let off = 0; off < allIds.length; off += 17) {
	decks.push([`순환:${off}`, buildSquad(Array.from({ length: ROSTER },
		(_, i) => String(allIds[(off + i * 7) % allIds.length])))]);
}

const oldAlive = new Map<string, number>();
const newAlive = new Map<string, number>();
for (const [, squad] of decks) {
	for (const v of evaluateGiftsLegacy({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params,
	})) {
		if (v.fireable) oldAlive.set(v.giftId, (oldAlive.get(v.giftId) ?? 0) + 1);
	}
	for (const v of evaluateGifts({
		squad, abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	})) {
		if (v.fireable) newAlive.set(v.giftId, (newAlive.get(v.giftId) ?? 0) + 1);
	}
}

const N = decks.length;
const ids = [...new Set([...oldAlive.keys(), ...newAlive.keys()])].sort();
const row = (id: string) => ({
	id, name: names.get(id) ?? id, o: oldAlive.get(id) ?? 0, n: newAlive.get(id) ?? 0,
});
const rows = ids.map(row);
const moved = rows.filter((r) => r.o !== r.n);
/** 옛 판정에서 늘 살던 것이 새 판정에서 아예 못 사는 것 — 가장 의심스러운 갈래 */
const newlyDead = rows.filter((r) => r.o > 0 && r.n === 0);

console.log(`덱 ${N} · 기프트 ${ids.length}`);
console.log(`전 덱에서 켜진다   옛 ${rows.filter((r) => r.o === N).length}  →  새 ${rows.filter((r) => r.n === N).length}`);
console.log(`전 덱에서 죽는다   옛 ${rows.filter((r) => r.o === 0).length}  →  새 ${rows.filter((r) => r.n === 0).length}`);
console.log(`\n판정이 바뀐 기프트 ${moved.length} — 더 켜짐 ${moved.filter((r) => r.n > r.o).length} · 덜 켜짐 ${moved.filter((r) => r.n < r.o).length}`);
console.log(`\n새로 전 덱에서 죽는다 ${newlyDead.length}`);
for (const r of newlyDead.slice(0, 20)) console.log(`  ${r.id} ${r.name} — 옛 ${r.o}/${N} → 0`);

console.log('\n결손 여섯 (전 덱에서 켜지면 과대 판정)');
for (const id of ['9246', '9778', '9271', '9843', '9262', '9268']) {
	const r = row(id);
	console.log(`  ${id} ${r.name.padEnd(16)} 옛 ${String(r.o).padStart(3)}/${N}  →  새 ${String(r.n).padStart(3)}/${N}`);
}

writeFileSync(out, [
	'# 옛 판정 vs 새 판정', '', `덱 ${N} · 기프트 ${ids.length}`, '',
	`## 새로 전 덱에서 죽는다 — ${newlyDead.length}`, '',
	...newlyDead.map((r) => `- ${r.id} ${r.name} — 옛 ${r.o}/${N} → 0`), '',
	`## 판정이 바뀐 기프트 — ${moved.length}`, '',
	...moved.sort((a, b) => (b.o - b.n) - (a.o - a.n))
		.map((r) => `- ${r.id} ${r.name} — ${r.o} → ${r.n}`),
].join('\n'), 'utf8');
console.log(`\n→ ${out}`);

await prisma.$disconnect();
process.exit(0);
