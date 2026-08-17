/**
 * 덱 하나에 보여 줄 기프트 20개를 고른다.
 *
 * **네 축을 고르게 덮어야 한다.** 한쪽에 몰리면 그 축의 저울추만 정해지고
 * 나머지는 표본이 말해 주는 것이 없다.
 *
 * ```
 * 등급     1 · 2 · 3 · 4 · 5 · EX
 * 키워드   강(주력 축) · 약(곁다리) · 없음
 * 팩       전용 · 공용
 * 요구     켜짐 · 안 켜짐
 * ```
 *
 * **무작위를 안 쓴다.** 표본을 다시 짤 일이 생겼을 때 같은 기준으로 짜야 하고,
 * 무작위면 「왜 이 스물인가」를 답할 수 없다.
 */
import { fitOfKeyword } from './fit.js';
import type { DeckSupply, GiftCard } from './types.js';

const WANT = 20;

/** 등급 여섯. `null` 은 EX 다 */
const TIERS: ReadonlyArray<number | null> = [1, 2, 3, 4, 5, null];

/**
 * 이 기프트의 키워드가 이 덱에 얼마나 맞나 — **셋으로 나눈다.**
 *
 * 「맞는다 / 안 맞는다」로 가르면 안 된다. 인격은 축을 여럿 갖기 때문에 화상
 * 덱에도 침잠이 한둘 섞이고, 그러면 `fit > 0` 이라 침잠 기프트까지 「일치」가
 * 된다 — 「불일치」 칸이 영영 비어 세 갈래가 둘로 접힌다.
 *
 * 문턱을 두면 「이 덱의 주력 축인가(강)」와 「곁다리인가(약)」가 갈린다.
 */
function keywordClassOf(c: GiftCard, supply: DeckSupply): '강' | '약' | '없음' {
	if (c.keywordId === null || c.keywordId === 'None') return '없음';
	return fitOfKeyword(c.keywordId, supply) >= 0.5 ? '강' : '약';
}

/**
 * 반드시 하나씩은 들어가야 하는 갈래.
 *
 * **칸의 곱집합을 라운드 로빈으로 돌면 안 된다.** 칸 이름을 정렬하면 등급별로
 * 뭉쳐서, 0회차가 1등급 칸을 전부 돌다 스무 자리를 다 써 버린다 — 4·5·EX 는
 * 차례가 안 온다. 갈래마다 「아직 없으면 하나」를 먼저 채우는 쪽이 덮임을
 * 보장한다.
 */
function needsOf(supply: DeckSupply): Array<(c: GiftCard) => boolean> {
	return [
		...TIERS.map((t) => (c: GiftCard) => c.tier === t),
		...(['강', '약', '없음'] as const).map((k) =>
			(c: GiftCard) => keywordClassOf(c, supply) === k),
		(c: GiftCard) => c.exclusive,
		(c: GiftCard) => !c.exclusive,
		(c: GiftCard) => !c.fireable,
	];
}

export function pickTwenty(
	pool: GiftCard[],
	supply: DeckSupply,
	shared: string[],
): GiftCard[] {
	const sorted = [...pool].sort((a, b) => a.giftId.localeCompare(b.giftId));
	const byId = new Map(sorted.map((c) => [c.giftId, c]));
	const picked: GiftCard[] = [];
	const taken = new Set<string>();
	const add = (c: GiftCard): void => {
		picked.push(c);
		taken.add(c.giftId);
	};

	// ① 공통 기프트를 먼저 넣는다 — 겹침이 없으면 덱 간 견줌이 안 된다
	for (const id of shared) {
		if (picked.length >= WANT) break;
		const c = byId.get(id);
		if (c !== undefined && !taken.has(id)) add(c);
	}

	// ② 갈래마다 아직 없으면 하나 채운다
	for (const ok of needsOf(supply)) {
		if (picked.length >= WANT) break;
		if (picked.some(ok)) continue;
		const c = sorted.find((x) => !taken.has(x.giftId) && ok(x));
		if (c !== undefined) add(c);
	}

	// ③ 남은 자리는 등급을 돌아가며 채운다 — 한 등급에 몰리지 않게
	while (picked.length < WANT) {
		let added = false;
		for (const t of TIERS) {
			if (picked.length >= WANT) break;
			const c = sorted.find((x) => !taken.has(x.giftId) && x.tier === t);
			if (c === undefined) continue;
			add(c);
			added = true;
		}
		if (!added) break; // 못이 말랐다
	}
	return picked;
}
