/**
 * 기프트 서른 개를 세 무더기로 고른다 — 심리검사처럼, 확실한 것과 애매한 것을
 * 일부러 갈라서 올린다.
 *
 * **엇갈리는 열 장이 이 표본의 전부다.** 「확실히 좋다」·「확실히 아니다」는
 * 방향을 고정해 모형이 뒤집히지 않는지 보는 용도이고, 「적합도가 등급보다
 * 얼마나 무거운가」는 엇갈린 열 장에서만 정해진다. 앞선 회차(`pickTwenty`)가
 * 등급·키워드·전용·켜짐을 고르게 덮어 서른 장을 골랐더니 대부분이 자명한
 * 판정이라 저울추가 안 좁혀졌다 — 그래서 「고르게」 대신 「갈라서」로 바꾼다.
 */
import { fitOfKeyword, tierOf } from './fit.js';
import { roleOf } from './fusion.js';
import type { FusionRole } from './fusion.js';
import type { DeckSupply, GiftCard } from './types.js';

export type Stratum = '확실히 좋다' | '확실히 아니다' | '엇갈린다';

export interface Picked {
	card: GiftCard;
	stratum: Stratum;
	why: string;
}

/** 무더기마다 낼 장수. 모자라면 있는 만큼만 — 다른 무더기로 안 메운다 */
const WANT = 10;

/** 등급을 사람이 읽는 말로. `null` 은 EX 다 */
function tierLabel(tier: number | null): string {
	return tier === null ? 'EX' : `${tier}등급`;
}

/**
 * 분류된 카드 하나. **엇갈린다의 네 갈래 중 어느 것인지도 여기서 못 박는다.**
 *
 * `branch` 는 엇갈린다일 때만 뜻이 있다(0=고등급 축 불일치 · 1=저등급 축 일치 ·
 * 2=저등급 상위 재료 · 3=전용인데 저등급). 라운드 로빈이 이 번호로 갈래를
 * 나눈다 — `why` 문자열을 파싱해서 갈래를 되짚는 것보다 한 번 정한 값을
 * 들고 다니는 편이 덜 깨진다.
 */
interface Classified {
	card: GiftCard;
	stratum: Stratum;
	branch: -1 | 0 | 1 | 2 | 3;
	why: string;
}

/**
 * 카드 하나를 무더기로 분류한다. 어디에도 안 맞으면 `undefined` —
 * 확실히 좋지도 나쁘지도 엇갈리지도 않는 카드는 이 표본에 낄 이유가 없다.
 *
 * **판정 순서가 곧 우선순위다.** 확실히 좋다 → 확실히 아니다 → 엇갈린다(그
 * 안에서 다시 네 갈래 순서대로). 한 카드가 여러 조건에 걸쳐도(예: 등급 낮고
 * 축은 안 맞는데 동시에 상위 재료다 — 확실히 아니다와 갈래 c 가 둘 다 맞는다)
 * 앞선 것 하나로만 넣는다. 브리프의 "갈래가 겹치면 위 순서대로 먼저 맞는 것"을
 * 그대로 코드 순서로 옮긴 것이다.
 *
 * **합성 결과물은 여기서 막는다.** 호출자가 이미 걸렀더라도 두 곳에서 막는
 * 편이 낫다 — 집을 수 없는 것을 두 번 세지 않는 게 아니라, 한 곳이 빠뜨려도
 * 다른 곳이 잡는다.
 */
function classify(
	card: GiftCard,
	supply: DeckSupply,
	roles: Map<string, FusionRole>,
	byId: ReadonlyMap<string, GiftCard>,
): Classified | undefined {
	const role = roleOf(roles, card.giftId);
	if (role.madeOnly) return undefined;

	const fit = fitOfKeyword(card.keywordId, supply);
	const t = tierOf(card.tier);

	if (fit >= 0.5 && t >= 0.75 && card.fireable) {
		return {
			card, stratum: '확실히 좋다', branch: -1,
			why: `${tierLabel(card.tier)}이고 이 덱 축과 맞는다`,
		};
	}
	if (fit === 0 && t <= 0.25) {
		return {
			card, stratum: '확실히 아니다', branch: -1,
			why: `${tierLabel(card.tier)}이고 이 덱 축과도 안 맞는다`,
		};
	}
	if (t >= 0.75 && fit === 0) {
		return {
			card, stratum: '엇갈린다', branch: 0,
			why: `${tierLabel(card.tier)}인데 이 덱 축과 안 맞는다`,
		};
	}
	if (t <= 0.25 && fit >= 0.5) {
		return {
			card, stratum: '엇갈린다', branch: 1,
			why: `${tierLabel(card.tier)}인데 이 덱 축과 맞는다`,
		};
	}
	if (t <= 0.25 && role.makes.length > 0) {
		// 재료가 여러 상위로 가는 길이 있어도 첫 번째만 이름에 쓴다 — 한 줄이라 다
		// 못 담고, 사람은 대표 하나만 알아도 「집을 값어치」를 가늠할 수 있다
		const result = role.makes[0]?.result ?? '';
		const resultName = byId.get(result)?.name ?? result;
		return {
			card, stratum: '엇갈린다', branch: 2,
			why: `${tierLabel(card.tier)}인데 ${resultName}의 재료다`,
		};
	}
	if (card.exclusive && t <= 0.25) {
		return {
			card, stratum: '엇갈린다', branch: 3,
			why: `전용인데 ${tierLabel(card.tier)}이다`,
		};
	}
	return undefined;
}

/** giftId 오름차순 — 동점 처리는 이 하나로 통일한다 */
const byGiftId = (a: Classified, b: Classified): number =>
	a.card.giftId.localeCompare(b.card.giftId);

/**
 * 갈래(큐)들을 한 번의 라운드 로빈으로 `want` 장까지 채운다.
 *
 * **큐 하나가 이번 라운드에 낼 게 있으면 반드시 낸다.** 큐 안의 순서(어떤
 * 것이 avoid 인지)는 여기서 안 따진다 — 그건 호출자가 큐를 만들 때 이미
 * 정한 것이다. 그래서 "그 갈래에 뭐가 남았나"만 보고, "그 갈래에 avoid
 * 아닌 게 남았나"는 보지 않는다 — 이 구분이 다른 갈래의 차례를 지킨다.
 */
function roundRobinFill(branches: Classified[][], want: number): Classified[] {
	const idx = branches.map(() => 0);
	const picked: Classified[] = [];
	let progressed = true;
	while (picked.length < want && progressed) {
		progressed = false;
		for (let b = 0; b < branches.length; b++) {
			if (picked.length >= want) break;
			if (idx[b]! < branches[b]!.length) {
				picked.push(branches[b]![idx[b]!]!);
				idx[b]! += 1;
				progressed = true;
			}
		}
	}
	return picked;
}

/**
 * 갈래 하나 안에서 avoid 를 뒤로 미룬 순서. **피할 것뿐이면 그냥 쓴다** —
 * `roundRobinFill` 이 avoid 목록도 넘겨받아 자리가 남으면 거기서 채운다.
 */
function orderedByAvoid(cards: Classified[], avoid: ReadonlySet<string>): {
	preferred: Classified[]; fallback: Classified[];
} {
	const sorted = [...cards].sort(byGiftId);
	return {
		preferred: sorted.filter((c) => !avoid.has(c.card.giftId)),
		fallback: sorted.filter((c) => avoid.has(c.card.giftId)),
	};
}

/**
 * 무더기(엇갈린다가 아닌 것) 하나를 채운다 — avoid 없는 것 먼저, 모자라면
 * avoid 로 채운다. 둘 다로도 `want` 에 못 미치면 있는 만큼만 낸다.
 */
function pickPlain(cards: Classified[], avoid: ReadonlySet<string>, want: number): Classified[] {
	const { preferred, fallback } = orderedByAvoid(cards, avoid);
	return [...preferred, ...fallback].slice(0, want);
}

/**
 * 엇갈린다 무더기를 채운다 — 네 갈래를 **한 번에** 라운드 로빈으로 돈다.
 *
 * **avoid 를 별도 패스로 나누면 안 된다.** 처음엔 "avoid 아닌 패를 통째로
 * 먼저 돈 뒤에야 avoid 패로 넘어간다"로 짰는데, 그러면 한 갈래가 avoid
 * 없이 넉넉할 때 그 갈래만의 패스에서 `want` 를 혼자 다 채워 버리고, avoid
 * 뿐인 다른 세 갈래는 자기 차례를 통째로 잃는다 — 실측(리뷰어 재현):
 * branchA 15(avoid 없음) · branchB/C/D 15(전부 avoid)에서 10/0/0/0 이 나왔다.
 * 이건 엇갈린다가 존재하는 이유(네 갈래를 다 보여준다)를 정확히 깬다.
 *
 * 고침: 갈래마다 **자기 차례에서 가장 나은 것 하나**(avoid 아닌 것 우선,
 * 없으면 avoid 라도)를 내는 라운드 로빈 하나로 돈다. 갈래가 차례를 건너뛰는
 * 경우는 그 갈래에 정말 아무것도 안 남았을 때뿐이다 — avoid 유무로는 절대
 * 안 건너뛴다. 「자리를 비우느니 겹친다」는 그대로 지키되, 그것이 다른
 * 갈래의 차례를 뺏는 대가로 오면 안 된다.
 */
function pickTangled(cards: Classified[], avoid: ReadonlySet<string>, want: number): Classified[] {
	const byBranch: Classified[][] = [[], [], [], []];
	for (const c of cards) byBranch[c.branch]!.push(c);

	// 갈래 하나의 큐: avoid 아닌 것을 앞에, avoid 를 뒤에 — 같은 갈래 **안**의
	// 순서일 뿐, 갈래끼리를 가르는 패스가 아니다
	const queues = byBranch.map((b) => {
		const { preferred, fallback } = orderedByAvoid(b, avoid);
		return [...preferred, ...fallback];
	});
	return roundRobinFill(queues, want);
}

/**
 * 세 무더기를 고른다. **무작위 없음** — 같은 입력이면 같은 답, 동점은
 * giftId 오름차순.
 */
export function pickThirty(
	pool: GiftCard[],
	supply: DeckSupply,
	roles: Map<string, FusionRole>,
	avoid: ReadonlySet<string>,
): Picked[] {
	const byId = new Map(pool.map((c) => [c.giftId, c]));
	const classified = pool
		.map((card) => classify(card, supply, roles, byId))
		.filter((c): c is Classified => c !== undefined);

	const good = classified.filter((c) => c.stratum === '확실히 좋다');
	const bad = classified.filter((c) => c.stratum === '확실히 아니다');
	const tangled = classified.filter((c) => c.stratum === '엇갈린다');

	const result = [
		...pickPlain(good, avoid, WANT),
		...pickPlain(bad, avoid, WANT),
		...pickTangled(tangled, avoid, WANT),
	];

	return result.map(({ card, stratum, why }) => ({ card, stratum, why }));
}
