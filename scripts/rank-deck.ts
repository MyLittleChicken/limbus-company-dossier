/**
 * 덱 셋을 짜고 덱마다 기프트 20개를 골라 낸다.
 *
 * ```
 * A 화상   화상 인격 12(출격 7)        축이 선명하다 — 적합도가 살아 있는 덱
 * B 소속   한 소속 중심 12             소속을 요구하는 기프트가 켜지는 덱
 * C 섞임   축이 흩어지게 12            적합도가 대부분 낮다 — 등급만 남는 덱
 * ```
 *
 * **덱 C 가 핵심이다.** `w_등급` 은 저 덱에서만 정해진다.
 *
 * 실행: npm run rank:deck -- --out /tmp/rank-candidates.json
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import { pickTwenty } from './rank/pick.js';
import type { DeckSupply, GiftCard } from './rank/types.js';

const ROSTER = 12;
const FIELD = 7;

/** 세 덱 공통으로 넣을 여섯. 성격이 갈리게 손으로 골랐다 */
const SHARED = [
	'9083', // 달의 기억 — 5등급 · 범용 · 모든 적 내성이 취약
	'9754', // 굴레 — 4등급 · 범용 · 최대 체력 +20%
	'9035', // 저주 인형 — 1등급 · 범용 · 적 전체에 고정 피해
	'9088', // 진혼 — 화상 전용 · 축이 맞을 때만 값이 오른다
	'9262', // 모든 것의 뼈대 — 4등급 · 약지 요구 · 덱 B 에서만 켜진다
	'9021', // 쪽빛 지포라이터 — 1등급 · 범용 · E.G.O 자원
];

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const out = outIdx >= 0 ? String(argv[outIdx + 1]) : '/tmp/rank-candidates.json';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

const meta = await prisma.$queryRaw<Array<{
	giftId: string; name: string; desc: string;
	tier: number | null; keywordId: string | null; exclusive: boolean;
}>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc",
	       g.tier, g.keyword_id AS "keywordId",
	       (x.gift_id IS NOT NULL) AS exclusive
	FROM canonical.gift_stage_text t
	JOIN canonical.gift g ON g.id = t.gift_id
	LEFT JOIN (SELECT DISTINCT gift_id FROM canonical.gift_exclusive_pack) x
	       ON x.gift_id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id
`;

/** 이 인격들이 무엇을 공급하나 */
function supplyOf(roster: string[]): DeckSupply {
	const field = roster.slice(0, FIELD);
	const count = (m: Map<string, Set<string>>): Map<string, number> => {
		const o = new Map<string, number>();
		for (const [k, ids] of m) {
			const n = field.filter((id) => ids.has(id)).length;
			if (n > 0) o.set(k, n);
		}
		return o;
	};
	return { axis: count(data.supply.axisTag), attackType: count(data.supply.attackType) };
}

const sortedIds = (s: Set<string> | undefined): string[] => [...(s ?? [])].sort();
const allIds = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))].sort();

/** 덱 A — 화상 인격으로 채운다 */
const deckA = [...sortedIds(data.supply.axisTag.get('COMBUSTION')),
	...allIds].slice(0, ROSTER);

/** 덱 B — 약지 소속 중심. 모자라면 나머지로 채운다 */
const deckB = [...sortedIds(data.supply.association.get('RING_FINGER')),
	...allIds].slice(0, ROSTER);

/**
 * 덱 C — 축이 흩어지게. 축마다 하나씩 돌아가며 뽑아 어느 축도 크지 않게 한다.
 * **이 덱에서 적합도가 낮아야 `w_등급` 이 정해진다.**
 */
const axes = [...data.supply.axisTag.keys()].sort();
const deckC: string[] = [];
for (let round = 0; deckC.length < ROSTER && round < 12; round += 1) {
	for (const ax of axes) {
		if (deckC.length >= ROSTER) break;
		const id = sortedIds(data.supply.axisTag.get(ax))[round];
		if (id !== undefined && !deckC.includes(id)) deckC.push(id);
	}
}

const specs = [
	{ id: 'A', name: '화상 덱 — 축이 선명하다', roster: deckA },
	{ id: 'B', name: '약지 소속 덱 — 소속 요구가 켜진다', roster: deckB },
	{ id: 'C', name: '섞인 덱 — 축이 흩어져 적합도가 낮다', roster: deckC },
];

const decks = specs.map((s) => {
	const squad = {
		roster: s.roster.map((identityId) => ({ identityId, egoIds: [] })),
		field: s.roster.slice(0, FIELD),
	};
	const fire = new Map(evaluateGifts({
		squad, abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	}).map((v) => [v.giftId, v.fireable]));

	const supply = supplyOf(s.roster);
	const pool: GiftCard[] = meta.map((m) => ({
		giftId: m.giftId, name: m.name, desc: m.desc, tier: m.tier,
		keywordId: m.keywordId, exclusive: m.exclusive,
		fireable: fire.get(m.giftId) ?? true,
	}));
	const cards = pickTwenty(pool, supply, SHARED);
	return {
		id: s.id, name: s.name, roster: s.roster,
		supply: { axis: [...supply.axis], attackType: [...supply.attackType] },
		cards,
	};
});

for (const d of decks) {
	const byTier = new Map<string, number>();
	for (const c of d.cards) {
		const k = c.tier === null ? 'EX' : String(c.tier);
		byTier.set(k, (byTier.get(k) ?? 0) + 1);
	}
	console.log(`덱 ${d.id} ${d.name}`);
	console.log(`  축 공급   ${d.supply.axis.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
	console.log(`  기프트    ${d.cards.length} · 등급 ${[...byTier].sort().map(([k, v]) => `${k}:${v}`).join(' ')}`);
	console.log(`  안 켜짐   ${d.cards.filter((c) => !c.fireable).length}`);
}

writeFileSync(out, JSON.stringify({ decks }, null, '\t'), 'utf8');
console.log(`\n→ ${out}`);
await prisma.$disconnect();
process.exit(0);
