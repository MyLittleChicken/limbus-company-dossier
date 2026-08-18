/**
 * 덱 열하나를 짜고 덱마다 기프트 서른 장을 골라 낸다.
 *
 * ```
 *  1~7  화상 · 열상 · 파열 · 호흡 · 진동 · 침잠 · 충전   그 축을 가진 인격으로 채운다
 *  8~10 참격 · 관통 · 타격                              그 타입 스킬을 가진 인격으로 채운다
 *  11   방향이 안 잡힌 편성                             어느 축도 크지 않게 — 1~2층 상태다
 * ```
 *
 * **덱 11 이 「적합도가 없을 때 등급이 얼마나 말하는가」를 답한다.** 나머지 열은
 * 적합도가 살아 있는 자리라 저울추의 다른 쪽 끝을 잡는다.
 *
 * **v1 이 왜 못 쓰게 됐는지가 이 파일의 모양을 정한다.**
 *   ① 편성이 불가능했다 — 수감자당 인격 하나인데 안 지켜 이상이 10명이었다.
 *      이제 `buildSquad` 가 그것을 지키고, 아래 관문이 **세어서** 확인한다.
 *   ② 합성 결과물(진혼·달의 기억)을 「집으라」고 물었다 — 그건 만드는 것이다.
 *      `fusionRolesOf` 의 `madeOnly` 로 후보에서 뺀다.
 *   ③ 고르기가 자명한 것만 냈다 — `pickThirty` 가 세 무더기로 가른다.
 *
 * **관문이 통과해도 표본이 깨져 있을 수 있다는 것이 v1 의 교훈이다.** 그래서
 * 관문은 「스크립트가 끝까지 돌았다」가 아니라 **게임 규칙**을 묻는다: 수감자가
 * 정말 열둘 다른가, 주력 공급이 정말 1위인가, 집을 수 없는 것이 안 섞였는가.
 * 하나라도 어긋나면 파일을 쓰지 않고 죽는다 — 깨진 표본이 커밋되는 것보다
 * 아무것도 안 나오는 편이 낫다.
 *
 * 실행: npm run rank:deck
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import { fitOfKeyword } from './rank/fit.js';
import { fusionRolesOf, roleOf } from './rank/fusion.js';
import type { Recipe } from './rank/fusion.js';
import { pickThirty } from './rank/pick.js';
import type { Picked } from './rank/pick.js';
import { buildSquad, labelOf } from './rank/squad.js';
import type { Identity } from './rank/squad.js';
import type { DeckSupply, GiftCard } from './rank/types.js';

/** 편성 12칸 · 출격 7칸. 나머지 5 는 대기다 — 거울 던전의 규칙이다 */
const ROSTER = 12;
const FIELD = 7;

/** 축 일곱. BULLET 은 수감자가 10 뿐이라 덱으로 세우지 않는다 */
const AXIS_NAME = new Map([
	['COMBUSTION', '화상'], ['LACERATION', '열상'], ['BURST', '파열'],
	['BREATH', '호흡'], ['VIBRATION', '진동'], ['SINKING', '침잠'], ['CHARGE', '충전'],
]);

/** 공격 타입 셋. `canonical.skill.attack_type` 은 소문자다 */
const ATTACK_NAME = new Map([['slash', '참격'], ['pierce', '관통'], ['blunt', '타격']]);

/**
 * `canonical.gift.keyword_id` 가 쓰는 말 열 가지. **공급 표의 말과 다르다**
 * (Hit·Penetrate ↔ blunt·pierce) — 그 다리는 `fit.ts` 가 이미 갖고 있으므로
 * 여기서는 키워드 쪽 말만 그대로 적고 `fitOfKeyword` 에 물어본다.
 */
const KEYWORDS = ['Combustion', 'Laceration', 'Burst', 'Breath', 'Vibration',
	'Sinking', 'Charge', 'Slash', 'Hit', 'Penetrate'];

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
/**
 * 후보 셋은 **저작 자리에 둔다.**
 *
 * 커밋되는 것이 판정 줄뿐이면 그 줄들의 뜻을 정하는 것(덱별 편성·공급·카드별
 * `fireable`)이 재부팅이면 사라지는 `/tmp` 에만 남는다. id 는 그대로인데 공급이
 * 7→6 으로 바뀌면 아무 경고 없이 저울추가 다른 수로 나온다.
 *
 * **이 파일에는 원문이 들어 있다.** 편성·공급·`fireable` 은 우리가 셈한 파생이지만
 * `name`·`desc` 는 `canonical.gift_stage_text` 의 한국어 원문 그대로다. 저작물
 * 스냅샷 훅(`data/` 만 본다)에는 안 걸리고, `gift-ability.jsonl` 이 `sourceText` 를
 * 원문 그대로 커밋해 온 것과 같은 취급이다.
 */
const out = outIdx >= 0 ? String(argv[outIdx + 1]) : 'src/v2/authored/gift-rank-candidates.json';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

/**
 * 인격 못. **`identity_text` 를 함께 읽는 이유는 화면이 라벨을 요구하기 때문이다** —
 * id 만 적힌 편성은 사람이 「무슨 덱인지」를 판단할 수 없고, 그게 v1 이 무너진
 * 자리다. `title` 에 줄바꿈이 있는 것은 `labelOf` 가 처리한다.
 */
const identityRows = await prisma.$queryRaw<Array<{
	id: string; sinnerId: number; name: string; title: string | null;
}>>`
	SELECT i.id, i.sinner_id AS "sinnerId", t.name, t.title
	FROM canonical.identity i
	JOIN canonical.identity_text t ON t.identity_id = i.id
	WHERE t.locale = 'ko'
	ORDER BY i.id
`;
const pool: Identity[] = identityRows.map((r) => ({
	id: r.id, sinnerId: String(r.sinnerId), name: r.name, title: r.title ?? '',
}));

/**
 * 인격이 그 공격 타입 스킬을 **몇 개** 가졌나.
 *
 * `data.supply.attackType` 은 「하나라도 가졌나」만 답한다(집합). 그것만으로
 * `prefer` 를 만들면 참격 스킬 하나에 관통 둘인 인격과 참격 셋인 인격이 같은
 * 값이 되어, 참격 덱에 관통이 함께 실린다 — 실제로 그렇게 짜면 공격 공급이
 * 갈려 「주력이 1위」가 안 선다. 개수까지 세야 타입이 선명한 인격이 앞에 온다.
 */
const skillRows = await prisma.$queryRaw<Array<{ identityId: string; attackType: string; n: bigint }>>`
	SELECT i.identity_id AS "identityId", lower(s.attack_type::text) AS "attackType", count(*) AS n
	FROM canonical.identity_skill i
	JOIN canonical.skill s ON s.id = i.skill_id
	WHERE s.attack_type IS NOT NULL
	GROUP BY 1, 2
`;
const attackCount = new Map<string, Map<string, number>>();
for (const r of skillRows) {
	let m = attackCount.get(r.identityId);
	if (m === undefined) {
		m = new Map<string, number>();
		attackCount.set(r.identityId, m);
	}
	m.set(r.attackType, Number(r.n));
}

/** 기프트 원문. 거울 던전 것만, 강화 0단계 한국어로 */
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

/**
 * 등급표는 **기프트 전체**를 읽는다. 아래 합성 등급 검사가 재료·결과물의 등급을
 * 견주는데, 거울 던전 밖이거나 한국어 원문이 없는 기프트가 레시피에 끼어 있으면
 * `meta` 만으로는 그 짝이 조용히 검사에서 빠진다 — 검사가 무엇을 못 봤는지
 * 모르는 상태가 되는 것이 가장 나쁘다.
 */
const tierRows = await prisma.$queryRaw<Array<{ id: string; tier: number | null }>>`
	SELECT id, tier FROM canonical.gift ORDER BY id
`;
const tierById = new Map(tierRows.map((r) => [r.id, r.tier]));
const nameById = new Map(meta.map((m) => [m.giftId, m.name]));
/** 이름이 없으면 id 라도 보인다 — 「알 수 없음」보다 낫다 */
const nameOf = (giftId: string): string => nameById.get(giftId) ?? giftId;

/**
 * 엔진의 레시피를 이쪽 말로 옮긴다. **필드 이름만 다르다**(`giftId` → `result`) —
 * `scripts/rank/fusion.ts` 는 DB 를 모르는 순수 함수라 엔진 타입을 안 빌려온다.
 */
const recipes: Recipe[] = data.recipes.map((r) => ({
	result: r.giftId,
	slots: r.slots.map((slot) => [...slot]),
}));
const roles = fusionRolesOf(recipes);

/**
 * 집을 수 있는 기프트만 후보다. **합성 결과물은 뺀다** — 진혼·달의 기억은 만드는
 * 것이지 팩에서 뽑는 것이 아니다. v1 은 그 둘을 공통 카드로 물었고, 사용자가
 * 「이건 못 고른다」고 잡았다.
 */
const pickable = meta.filter((m) => !roleOf(roles, m.giftId).madeOnly);

/** 이 인격들이 무엇을 얼마나 공급하나. **출격 7인만 센다** */
function supplyOf(field: string[]): DeckSupply {
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

/**
 * 덱 하나의 뜻. `kind` 는 **관문이 무엇을 물어야 하는지**를 정한다 —
 * 축 덱은 축 공급이, 공격 덱은 공격 공급이 1위여야 하고, 방향미정 덱은
 * 거꾸로 축이 **작아야** 한다.
 */
interface DeckSpec {
	id: string;
	name: string;
	kind: 'axis' | 'attack' | 'none';
	/** 주력 키워드. 방향미정 덱은 없다 */
	key: string | null;
	prefer: (identityId: string) => number;
}

/**
 * 축 덱의 `prefer` — 그 축을 가졌으면 1, 아니면 0.
 *
 * **더 잘게 나눌 이유가 없다.** 축 일곱은 전부 수감자 12명을 채울 수 있어(충전만
 * 11) 출격 7인이 전원 그 축이 되고, 딸려 오는 다른 축은 실측 최대 5(충전 덱의
 * 파열)라 주력을 못 넘는다. 가중치를 더 넣으면 「왜 이 열둘인가」의 설명만
 * 길어지고 답은 안 바뀐다.
 */
const axisPrefer = (axis: string) => (id: string): number =>
	data.supply.axisTag.get(axis)?.has(id) === true ? 1 : 0;

/**
 * 공격 덱의 `prefer` — 그 타입 스킬 수를 10배로 세고 다른 타입 스킬 수를 뺀다.
 *
 * 10배인 것은 인격 하나의 스킬이 서넛뿐이어서, 그 타입 스킬이 **하나라도 더
 * 많은 쪽**이 「다른 타입을 얼마나 덜 가졌나」보다 항상 먼저 오게 하기 위한
 * 것이다. 뒤 항이 없으면 순수 타입 인격과 잡탕 인격이 동점이 되어 공격 공급이
 * 갈린다.
 */
const attackPrefer = (attack: string) => (id: string): number => {
	const m = attackCount.get(id);
	if (m === undefined) return 0;
	const mine = m.get(attack) ?? 0;
	let other = 0;
	for (const [k, n] of m) if (k !== attack) other += n;
	return mine * 10 - other;
};

/**
 * 방향미정 덱의 `prefer` — 축을 **적게** 가진 인격을 앞에 세운다.
 *
 * 축이 아예 없는 인격은 실측 5명(수감자 4명)뿐이라 그것만으로는 12칸이 안 찬다.
 * 축 수를 음수로 쓰면 0축 → 1축 → … 순서가 한 번의 정렬로 서고, 실측 축
 * 최댓값이 1 이 된다. 「어느 축도 크지 않게」를 인위적으로 돌려 뽑는 것보다
 * 이 한 줄이 왜 그런지가 분명하다.
 */
const AXES = [...AXIS_NAME.keys()];
const axisCountOf = (id: string): number =>
	AXES.filter((a) => data.supply.axisTag.get(a)?.has(id) === true).length;

const specs: DeckSpec[] = [
	...AXES.map((axis, i): DeckSpec => ({
		id: String(i + 1),
		name: `${AXIS_NAME.get(axis) ?? axis} 덱`,
		kind: 'axis', key: axis, prefer: axisPrefer(axis),
	})),
	...[...ATTACK_NAME.keys()].map((atk, i): DeckSpec => ({
		id: String(AXES.length + i + 1),
		name: `${ATTACK_NAME.get(atk) ?? atk} 덱`,
		kind: 'attack', key: atk, prefer: attackPrefer(atk),
	})),
	{
		id: String(AXES.length + ATTACK_NAME.size + 1),
		name: '방향이 안 잡힌 덱',
		kind: 'none', key: null, prefer: (id) => -axisCountOf(id),
	},
];

/**
 * 앞 덱들이 이미 쓴 기프트.
 *
 * 이것이 없으면 열한 덱이 거의 같은 서른을 보여 준다 — 무더기 판정은 덱의
 * 적합도를 보긴 하지만 등급·전용은 덱과 무관해서, 같은 카드가 계속 앞에 선다.
 * `pickThirty` 는 이걸 **뒤로 미룰 뿐** 자리가 남으면 그대로 쓴다(자리를
 * 비우느니 겹친다).
 */
const used = new Set<string>();

/** 카드 하나에 붙는 합성 정보. 재료가 아니면 빈 배열이다 */
interface FusionInfo {
	result: string;
	resultName: string;
	resultTier: number | null;
	/** 함께 필요한 다른 **칸**들. 칸 하나가 배열 하나다 — 펴면 뜻이 달라진다 */
	withOthers: string[][];
	withOtherNames: string[][];
	recipeCount: number;
}

interface DeckOut {
	id: string;
	name: string;
	/** 편성 12인의 id. 앞 7 이 출격이다 — 다시 짤 때 같은 답이 나오는지 대조한다 */
	roster: string[];
	field: string[];
	waiting: string[];
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]> };
	cards: Array<Picked & { fusion: FusionInfo[] }>;
}

const decks: DeckOut[] = [];
/** 관문에 어긋난 것들. 하나라도 있으면 파일을 안 쓴다 */
const broken: string[] = [];

for (const spec of specs) {
	const squad = buildSquad(pool, spec.prefer, ROSTER);
	const rosterIds = squad.map((i) => i.id);
	const fieldIds = rosterIds.slice(0, FIELD);
	const supply = supplyOf(fieldIds);

	const fire = new Map(evaluateGifts({
		squad: {
			roster: rosterIds.map((identityId) => ({ identityId, egoIds: [] })),
			field: fieldIds,
		},
		abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	}).map((v) => [v.giftId, v.fireable]));

	/**
	 * 절이 하나도 없는 기프트는 `evaluateGifts` 가 답하지 않는다 — 켤 조건이
	 * 없다는 뜻이므로 참으로 둔다. 거짓으로 두면 「조건이 없어 늘 켜지는 것」이
	 * 「못 켜는 것」으로 뒤집힌다.
	 */
	const cards: GiftCard[] = pickable.map((m) => ({
		giftId: m.giftId, name: m.name, desc: m.desc, tier: m.tier,
		keywordId: m.keywordId, exclusive: m.exclusive,
		fireable: fire.get(m.giftId) ?? true,
	}));

	const picked = pickThirty(cards, supply, roles, used);
	for (const p of picked) used.add(p.card.giftId);

	decks.push({
		id: spec.id, name: spec.name,
		roster: rosterIds,
		field: squad.slice(0, FIELD).map(labelOf),
		waiting: squad.slice(FIELD).map(labelOf),
		supply: { axis: [...supply.axis], attackType: [...supply.attackType] },
		cards: picked.map((p) => ({
			...p,
			fusion: roleOf(roles, p.card.giftId).makes.map((mk) => ({
				result: mk.result,
				resultName: nameOf(mk.result),
				resultTier: tierById.get(mk.result) ?? null,
				withOthers: mk.withOthers,
				withOtherNames: mk.withOthers.map((slot) => slot.map(nameOf)),
				recipeCount: mk.recipeCount,
			})),
		})),
	});

	// ── 관문. 덱 하나를 낼 때마다 그 자리에서 센다 ──────────────────────────
	const sinners = new Set(squad.map((i) => i.sinnerId));
	const okSinner = squad.length === ROSTER && sinners.size === ROSTER;
	if (!okSinner) broken.push(`덱 ${spec.id} 편성 ${squad.length}인 · 수감자 ${sinners.size}명`);

	const axisMax = Math.max(0, ...supply.axis.values());
	const atkMax = Math.max(0, ...supply.attackType.values());
	let leadLine: string;
	let okLead: boolean;
	if (spec.kind === 'none') {
		// 방향미정 덱은 거꾸로 묻는다 — 축이 **작아야** 「적합도가 없을 때」를 잰다
		okLead = axisMax <= 3;
		leadLine = `축 최댓값 ${axisMax} (≤ 3 이어야 한다)`;
	} else {
		const m = spec.kind === 'axis' ? supply.axis : supply.attackType;
		const mine = m.get(spec.key ?? '') ?? 0;
		const max = spec.kind === 'axis' ? axisMax : atkMax;
		// **단독 1위여야 한다.** 공동 1위면 그 덱이 무엇을 묻는 덱인지 흐려진다
		const ties = [...m].filter(([k, v]) => v === max && k !== spec.key).length;
		okLead = mine === max && ties === 0;
		leadLine = `주력 ${spec.key} ${mine} · 최댓값 ${max}${ties > 0 ? ` · 공동 1위 ${ties}건` : ''}`;
	}
	if (!okLead) broken.push(`덱 ${spec.id} 주력 — ${leadLine}`);

	const strata = ['확실히 좋다', '확실히 아니다', '엇갈린다'] as const;
	const countOf = (s: string): number => picked.filter((p) => p.stratum === s).length;
	const short = strata.filter((s) => countOf(s) < 10);

	const madeIn = picked.filter((p) => roleOf(roles, p.card.giftId).madeOnly).length;
	if (madeIn > 0) broken.push(`덱 ${spec.id} 합성 결과물 ${madeIn}장`);

	/**
	 * **`w_적합` 을 정할 수 있는 카드가 몇 장인가.** 이 수가 0 이나 1 이면 그 덱의
	 * 서른은 적합도에 대해 아무 말도 못 한다 — 등급과 전용만으로 순서가 다
	 * 설명된다. **죽은 카드는 뺀다** — 안 켜지는 기프트로는 짝을 못 만들어
	 * 저울추에 한 글자도 못 보태는데, 그것까지 세면 이 수가 되레 부푼다.
	 */
	const fits = picked.filter((p) => p.card.fireable)
		.map((p) => fitOfKeyword(p.card.keywordId, supply));
	const strong = fits.filter((f) => f >= 0.5).length;
	const partial = fits.filter((f) => f > 0 && f < 0.5).length;

	console.log(`덱 ${spec.id} ${spec.name}`);
	console.log(`  출격      ${squad.slice(0, FIELD).map(labelOf).join(' · ')}`);
	console.log(`  대기      ${squad.slice(FIELD).map(labelOf).join(' · ')}`);
	console.log(`  수감자    ${sinners.size}명 / 편성 ${squad.length}칸 — ${okSinner ? '맞다' : '어긋난다'}`);
	console.log(`  축 공급   ${[...supply.axis].map(([k, v]) => `${k} ${v}`).join(' · ') || '없다'}`);
	console.log(`  공격 공급 ${[...supply.attackType].map(([k, v]) => `${k} ${v}`).join(' · ') || '없다'}`);
	console.log(`  1위       ${leadLine} — ${okLead ? '맞다' : '어긋난다'}`);
	console.log(`  무더기    ${strata.map((s) => `${s} ${countOf(s)}`).join(' · ')}`);
	if (short.length > 0) {
		/**
		 * 「왜 모자랐나」의 답은 하나뿐이다 — `pickThirty` 는 다른 무더기로 메우지도
		 * 않고 `avoid` 때문에 자리를 비우지도 않으므로(피할 것뿐이면 그냥 쓴다),
		 * 낸 수가 곧 **후보에 그 무더기가 그만큼밖에 없었다**는 뜻이다.
		 *
		 * 함께 찍는 「적합 0.5 이상인 키워드」가 그 사실의 까닭이다. 적합도는 그
		 * 덱이 가장 많이 가진 것으로 나눈 값이라, 공급이 한쪽으로 쏠린 덱일수록
		 * 0.5 를 넘는 키워드가 적어지고 「확실히 좋다」의 못 자체가 좁아진다.
		 */
		const strongKeys = KEYWORDS.filter((k) => fitOfKeyword(k, supply) >= 0.5);
		console.log(`            모자람: ${short.map((s) => `${s} ${countOf(s)}장 — 그 무더기 조건을 다 만족하는 카드가 후보 ${pickable.length}장 중 그만큼뿐이다`).join(' / ')}`);
		console.log(`            적합 0.5 이상인 키워드: ${strongKeys.join(' · ') || '없다'}`);
	}
	console.log(`  합성 결과물 ${madeIn}장 — ${madeIn === 0 ? '맞다' : '어긋난다'}`);
	console.log(`  적합 있음 ${strong + partial} (강 ${strong} · 곁다리 ${partial}) — 켜지는 것만`);
	console.log(`  안 켜짐   ${picked.filter((p) => !p.card.fireable).length}`);
}

// ── 덱을 통틀어 보는 관문 ────────────────────────────────────────────────
const all = new Set(decks.flatMap((d) => d.cards.map((c) => c.card.giftId)));
const total = decks.reduce((s, d) => s + d.cards.length, 0);
console.log(`\n집을 수 있는 기프트 ${pickable.length} (원문 ${meta.length} 중 합성 결과물 ${meta.length - pickable.length} 제외)`);
console.log(`서로 다른 기프트 ${all.size} / 판정 ${total} (덱 ${decks.length} × 30)`);

let maxOverlap = 0;
let maxPair = '';
for (let i = 0; i < decks.length; i += 1) {
	for (let j = i + 1; j < decks.length; j += 1) {
		const a = decks[i]!;
		const b = decks[j]!;
		const bIds = new Set(b.cards.map((c) => c.card.giftId));
		const both = a.cards.filter((c) => bIds.has(c.card.giftId)).length;
		if (both > maxOverlap) {
			maxOverlap = both;
			maxPair = `${a.id}∩${b.id}`;
		}
	}
}
console.log(`덱쌍 겹침 최댓값 ${maxOverlap} (${maxPair})`);

/**
 * **`pick.ts` 가 기대는 것을 실제 레시피에 대고 확인한다.**
 *
 * 갈래 c(「저등급인데 상위 재료다」)는 `makes.length > 0` 만 보고 결과물 등급을
 * 안 본다 — 재료가 늘 결과물보다 낮다는 가정 위에 서 있다. 그 가정이 데이터에서
 * 깨지면 「상위로 가는 길」이라는 말이 거짓이 되므로, 고치지는 않되 **몇 건인지는
 * 알고 있어야 한다.** EX(등급 없음)는 5등급 위로 본다.
 */
const rankOf = (t: number | null): number => (t === null ? 6 : t);
const violations: string[] = [];
for (const r of recipes) {
	const rt = rankOf(tierById.get(r.result) ?? null);
	for (const slot of r.slots) {
		for (const mat of slot) {
			if (rt <= rankOf(tierById.get(mat) ?? null)) {
				violations.push(`${nameOf(r.result)}(${tierById.get(r.result) ?? 'EX'}) ← ${nameOf(mat)}(${tierById.get(mat) ?? 'EX'})`);
			}
		}
	}
}
console.log(`\n합성 등급 역전 ${violations.length}건 — 결과물이 재료보다 높지 않은 (결과물, 재료) 짝`);
for (const v of violations.slice(0, 5)) console.log(`  ${v}`);

if (broken.length > 0) {
	// **문턱을 낮추지 않는다.** 깨진 표본을 파일로 남기면 그것이 그대로 판정에
	// 쓰여, 관문이 있으나 마나가 된다 — v1 이 정확히 그렇게 무너졌다
	console.log(`\n관문 어긋남 ${broken.length}건 — 파일을 쓰지 않는다`);
	for (const b of broken) console.log(`  ${b}`);
	await prisma.$disconnect();
	process.exit(1);
}

writeFileSync(out, JSON.stringify({ decks }, null, '\t'), 'utf8');
console.log(`\n관문 전부 맞다 → ${out}`);
await prisma.$disconnect();
process.exit(0);
