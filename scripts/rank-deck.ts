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
 * 실행: npm run rank:deck
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import { fitOfKeyword } from './rank/fit.js';
import { pickTwenty } from './rank/pick.js';
import type { DeckSupply, GiftCard } from './rank/types.js';

const ROSTER = 12;
const FIELD = 7;

/** 세 덱 공통으로 넣을 일곱. 성격이 갈리게 손으로 골랐다 */
const SHARED = [
	'9083', // 달의 기억 — 5등급 · 범용 · 모든 적 내성이 취약
	'9754', // 굴레 — 4등급 · 범용 · 최대 체력 +20%
	'9035', // 저주 인형 — 1등급 · 범용 · 적 전체에 고정 피해
	'9088', // 진혼 — 화상 전용 · 축이 맞을 때만 값이 오른다
	// 모든 것의 뼈대 — 4등급 · 약지 요구. **덱 B 에서만 켜지는 것은 아니다** —
	// 이 기프트의 조건은 scope='roster' 라 대기 인원까지 세고, 덱 C 도 약지
	// 인격 하나를 대기에 얹게 되어 함께 켜진다. 그래도 덱 A 에서는 죽으므로
	// 「소속을 요구하는 기프트」의 자리는 여전히 보인다
	'9262',
	'9021', // 쪽빛 지포라이터 — 1등급 · 범용 · E.G.O 자원
	// 부화하지 않은 불씨 — 4등급 · 화상 · **무조건 절이라 어느 덱에서도 안 죽는다.**
	// 위 넷은 전부 fit 0 인 범용이고 진혼·뼈대는 어딘가에서 죽어 짝에서 빠지므로,
	// 이것이 없으면 「적합도가 실재하나」를 물을 카드가 표본에 하나도 없다
	'9756',
];

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
/**
 * 후보 셋은 **저작 자리에 둔다.**
 *
 * 커밋되는 것이 판정 60줄뿐이면 그 줄들의 뜻을 정하는 것(덱별 축 공급 · 카드별
 * `fireable`)이 재부팅이면 사라지는 `/tmp` 에만 남는다. `cleanRows` 는 giftId 가
 * 후보 밖일 때만 막으므로, id 는 그대로인데 공급이 7→6 으로 바뀌면 아무 경고 없이
 * 저울추가 다른 수로 나온다. 우리가 만든 파생이라 저작물 스냅샷 훅에 안 걸린다.
 */
const out = outIdx >= 0 ? String(argv[outIdx + 1]) : 'src/v2/authored/gift-rank-candidates.json';

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

/**
 * 핵심 인격으로 채우고 모자라면 나머지로 메운다.
 *
 * **중복을 거른다.** `allIds` 는 핵심 집단을 이미 품고 있어서, 안 거르면 같은
 * 인격이 편성에 두 번 들어가 12인이 실질 11인이 된다. 지금 데이터로는 안
 * 겹치지만 id 범위가 바뀌면 조용히 어긋난다.
 */
const rosterOf = (core: string[]): string[] =>
	[...new Set([...core, ...allIds])].slice(0, ROSTER);

/** 덱 A — 화상 인격으로 채운다 */
const deckA = rosterOf(sortedIds(data.supply.axisTag.get('COMBUSTION')));

/** 덱 B — 약지 소속 중심 */
const deckB = rosterOf(sortedIds(data.supply.association.get('RING_FINGER')));

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

/**
 * 앞 덱들이 이미 쓴 기프트. **공통 일곱은 안 넣는다** — 그건 일부러 겹친다.
 *
 * 이것이 없으면 세 덱이 거의 같은 스물을 보여 준다. 갈래 채우기 조건 대부분이
 * 덱을 안 보기 때문에 `find` 가 매번 같은 카드를 집는다(실측: 덱 A 와 B 가
 * 통째로 같았고 서로 다른 기프트가 21개뿐이었다).
 */
const used = new Set<string>();

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
	const cards = pickTwenty(pool, supply, SHARED, used);
	for (const c of cards) {
		if (!SHARED.includes(c.giftId)) used.add(c.giftId);
	}
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

	/**
	 * **`w_적합` 을 정할 수 있는 카드가 몇 장인가.**
	 *
	 * 이 수가 0 이나 1 이면 그 덱의 판정 스물은 적합도에 대해 아무 말도 못 한다 —
	 * 등급과 전용만으로 순서가 다 설명되어 저울추가 갈리지 않는다. 손으로 세 보게
	 * 두면 아무도 안 세므로 여기서 찍는다.
	 */
	const supply = { axis: new Map(d.supply.axis), attackType: new Map(d.supply.attackType) };
	const fits = d.cards.map((c) => fitOfKeyword(c.keywordId, supply));
	const strong = fits.filter((f) => f >= 0.5).length;
	const partial = fits.filter((f) => f > 0 && f < 0.5).length;

	console.log(`덱 ${d.id} ${d.name}`);
	console.log(`  축 공급   ${d.supply.axis.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
	console.log(`  기프트    ${d.cards.length} · 등급 ${[...byTier].sort().map(([k, v]) => `${k}:${v}`).join(' ')}`);
	console.log(`  적합 있음 ${strong + partial} (강 ${strong} · 곁다리 ${partial})`);
	console.log(`  안 켜짐   ${d.cards.filter((c) => !c.fireable).length}`);
}

const all = new Set(decks.flatMap((d) => d.cards.map((c) => c.giftId)));
console.log(`\n서로 다른 기프트 ${all.size} (덱 ${decks.length} × ${decks[0]?.cards.length ?? 0})`);
for (let i = 0; i < decks.length; i += 1) {
	for (let j = i + 1; j < decks.length; j += 1) {
		const a = decks[i] as { id: string; cards: GiftCard[] };
		const b = decks[j] as { id: string; cards: GiftCard[] };
		const bIds = new Set(b.cards.map((c) => c.giftId));
		const both = a.cards.filter((c) => bIds.has(c.giftId)).length;
		console.log(`  ${a.id}∩${b.id} ${both} (공통 ${SHARED.length} 이어야 한다)`);
	}
}

writeFileSync(out, JSON.stringify({ decks }, null, '\t'), 'utf8');
console.log(`\n→ ${out}`);
await prisma.$disconnect();
process.exit(0);
