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
import { fitOfKeyword, keywordKindOf, tierOf } from './fit.js';
import { roleOf } from './fusion.js';
import type { FusionRole } from './fusion.js';
import type { DeckSupply, GiftCard } from './types.js';

export type Stratum = '확실히 좋다' | '확실히 아니다' | '엇갈린다';

export interface Picked {
	card: GiftCard;
	stratum: Stratum;
	why: string;
	/**
	 * 엇갈림의 어느 갈래인가(0=고등급 축 불일치 · 1=저등급 축 일치 · 2=저등급
	 * 상위 재료 · 3=전용인데 저등급). 엇갈림이 아니면 -1.
	 *
	 * **밖으로 낸다.** 안 내면 호출자가 `why` 문자열을 뜯어 갈래를 되짚게 되는데
	 * (「덱 11 의 엇갈림이 어느 갈래로 갔나」를 보고해야 한다), 그건 문구를
	 * 고칠 때마다 조용히 깨지는 종류의 셈이다.
	 */
	branch: -1 | 0 | 1 | 2 | 3;
}

/**
 * 무더기마다 낼 장수와 엇갈림 네 갈래의 차례 배분.
 *
 * **몫은 덱마다 다를 수 있어도 무더기의 뜻은 안 바뀐다.** 「확실히 좋다」가
 * 원리적으로 0 인 덱(어느 키워드도 적합 0.5 를 못 넘는 방향미정 덱)은 그
 * 자리를 영영 못 채우는데, 그 열 장을 엇갈림에 주면 **그 덱이 답해야 할 물음**
 * (「적합도가 없을 때 등급이 얼마나 말하는가」)을 더 많이 물을 수 있다.
 * 문턱도 갈래 판정도 그대로이므로 덱 간 비교는 안 깨진다 — 표본 수만 다르다.
 */
export interface Quota {
	good: number;
	bad: number;
	tangled: number;
	/**
	 * 엇갈림 갈래 0~3 이 **한 바퀴에 몇 장씩** 내나. 기본은 1·1·1·1(고르게).
	 *
	 * 갈래 0(고등급인데 적합 0)이 곧 「등급만으로 얼마나 가나」를 묻는 자리라,
	 * 그 물음이 덱의 전부인 경우에는 여기를 키운다.
	 */
	turns: [number, number, number, number];
}

/** 무더기마다 열 장, 갈래는 고르게. 모자라면 있는 만큼만 — 다른 무더기로 안 메운다 */
export const DEFAULT_QUOTA: Quota = { good: 10, bad: 10, tangled: 10, turns: [1, 1, 1, 1] };

/** 등급을 사람이 읽는 말로. `null` 은 EX 다 */
function tierLabel(tier: number | null): string {
	return tier === null ? 'EX' : `${tier}등급`;
}

/**
 * 적합도가 **무엇과** 맞는지를 가리키는 말.
 *
 * 「축」으로 고정해 두면 안 된다 — 참격·관통·타격 기프트는 축이 아니고
 * (실측 65장), 키워드가 아예 없는 범용 기프트도 있다(66장). 셈은 맞는데
 * 설명이 어긋나면 사람은 설명을 믿고 판정한다.
 */
function fitNoun(keywordId: string | null): string {
	const kind = keywordKindOf(keywordId);
	if (kind === 'axis') return '이 덱 축';
	if (kind === 'attack') return '이 덱 공격 타입';
	return '이 덱';
}

/** 키워드가 없는 카드는 「안 맞는다」가 아니라 **맞출 것이 없다** */
function noFitWhy(card: GiftCard): string | null {
	return keywordKindOf(card.keywordId) === 'none'
		? `${tierLabel(card.tier)}이고 키워드가 없어 이 덱과 맞출 것이 없다`
		: null;
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
	nameOf: (giftId: string) => string,
): Classified | undefined {
	const role = roleOf(roles, card.giftId);
	if (role.madeOnly) return undefined;

	const fit = fitOfKeyword(card.keywordId, supply);
	const t = tierOf(card.tier);

	if (fit >= 0.5 && t >= 0.75 && card.fireable) {
		return {
			card, stratum: '확실히 좋다', branch: -1,
			why: `${tierLabel(card.tier)}이고 ${fitNoun(card.keywordId)}과 맞는다`,
		};
	}
	if (fit === 0 && t <= 0.25) {
		return {
			card, stratum: '확실히 아니다', branch: -1,
			why: noFitWhy(card) ?? `${tierLabel(card.tier)}이고 ${fitNoun(card.keywordId)}과도 안 맞는다`,
		};
	}
	if (t >= 0.75 && fit === 0) {
		return {
			card, stratum: '엇갈린다', branch: 0,
			why: noFitWhy(card) ?? `${tierLabel(card.tier)}인데 ${fitNoun(card.keywordId)}과 안 맞는다`,
		};
	}
	if (t <= 0.25 && fit >= 0.5) {
		return {
			card, stratum: '엇갈린다', branch: 1,
			why: `${tierLabel(card.tier)}인데 ${fitNoun(card.keywordId)}과 맞는다`,
		};
	}
	if (t <= 0.25 && role.makes.length > 0) {
		// 재료가 여러 상위로 가는 길이 있어도 첫 번째만 이름에 쓴다 — 한 줄이라 다
		// 못 담고, 사람은 대표 하나만 알아도 「집을 값어치」를 가늠할 수 있다
		const result = role.makes[0]?.result ?? '';
		const resultName = nameOf(result);
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
function roundRobinFill(
	branches: Classified[][],
	want: number,
	/** 갈래가 한 바퀴에 낼 장수. 전부 1 이면 예전과 같은 고른 배분이다 */
	turns: readonly number[],
): Classified[] {
	const idx = branches.map(() => 0);
	const picked: Classified[] = [];
	let progressed = true;
	while (picked.length < want && progressed) {
		progressed = false;
		for (let b = 0; b < branches.length; b++) {
			// 이 갈래의 차례 — 몇 장을 몰아 낼지는 호출자가 정한다. 차례가 여러
			// 장이어도 **한 바퀴 안에서** 끝나므로 다른 갈래의 차례를 뺏지 않는다
			for (let t = 0; t < (turns[b] ?? 1); t++) {
				if (picked.length >= want) break;
				if (idx[b]! >= branches[b]!.length) break;
				picked.push(branches[b]![idx[b]!]!);
				idx[b]! += 1;
				progressed = true;
			}
			if (picked.length >= want) break;
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
function pickTangled(
	cards: Classified[], avoid: ReadonlySet<string>, want: number,
	turns: readonly number[],
): Classified[] {
	const byBranch: Classified[][] = [[], [], [], []];
	for (const c of cards) byBranch[c.branch]!.push(c);

	// 갈래 하나의 큐: avoid 아닌 것을 앞에, avoid 를 뒤에 — 같은 갈래 **안**의
	// 순서일 뿐, 갈래끼리를 가르는 패스가 아니다
	const queues = byBranch.map((b) => {
		const { preferred, fallback } = orderedByAvoid(b, avoid);
		return [...preferred, ...fallback];
	});
	return roundRobinFill(queues, want, turns);
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
	/**
	 * 기프트 id → 이름. **못(`pool`)에서 찾으면 안 된다.**
	 *
	 * 갈래 c 의 `why` 가 부르는 이름은 **합성 결과물**의 이름인데, 못은 그
	 * 결과물이 이미 빠진 목록이다(집을 수 없으니까). 못에서 찾으면 폴백이
	 * 100% 발동해 「1등급인데 9170의 재료다」가 되고, 「저등급인데 집을 값어치가
	 * 있나」를 묻는 **유일한** 갈래의 신호가 통째로 사라진다(실측 21장 전부).
	 * 그래서 기프트 **전체**를 아는 호출자에게 물어본다.
	 */
	nameOf: (giftId: string) => string,
	/** 무더기별 몫. 기본은 10·10·10 에 갈래 고르게 — 덱마다 다르게 줄 수 있다 */
	quota: Quota = DEFAULT_QUOTA,
): Picked[] {
	const classified = pool
		.map((card) => classify(card, supply, roles, nameOf))
		.filter((c): c is Classified => c !== undefined);

	const good = classified.filter((c) => c.stratum === '확실히 좋다');
	const bad = classified.filter((c) => c.stratum === '확실히 아니다');
	const tangled = classified.filter((c) => c.stratum === '엇갈린다');

	const result = [
		...pickPlain(good, avoid, quota.good),
		...pickPlain(bad, avoid, quota.bad),
		...pickTangled(tangled, avoid, quota.tangled, quota.turns),
	];

	return result.map(({ card, stratum, why, branch }) => ({ card, stratum, why, branch }));
}
