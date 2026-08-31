/**
 * 순위 표본 골든 — 엔진의 값 모형이 표본을 몇 개나 재현하는지 **수치를 못 박는다.**
 *
 * 「전부 맞힌다」가 아니다(설계 §6). 사람의 판정에도 흔들림이 있고 100% 를
 * 요구하면 저울추를 표본에 억지로 맞추게 된다. 못 박는 것은 **실측값**이다 —
 * 리팩터가 이 수를 움직이면 값 모형이 바뀐 것이고, 골든이 그것을 잡는다.
 *
 * **전체만이 아니라 엇갈린 무더기 안의 수치를 못 박는다.** 짝 대부분은 무더기가
 * 서로 다른 짝이라 후보 고르기가 이미 갈라 놓은 것이고 어떤 저울추로도 맞는다.
 * 이 표본이 실제로 정한 것은 엇갈린 무더기 안의 229/331 이다.
 *
 * DB 를 안 문다 — 후보 셋이 판정 줄의 뜻(편성 · 공급 · fireable · 무더기)을
 * 전부 들고 있다(authored/README).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { axisSupplyOf, valueOf, type AxisSupply } from './score.js';

interface CandidateCard {
	card: {
		giftId: string;
		tier: number | null;
		keywordId: string | null;
		exclusive: boolean;
		fireable: boolean;
	};
	stratum: string;
}
interface CandidateDeck {
	id: string;
	supply: {
		axis: Array<[string, number]>;
		attackType: Array<[string, number]>;
		fieldSize: number;
	};
	cards: CandidateCard[];
}

const { decks } = JSON.parse(
	readFileSync('src/v2/authored/gift-rank-candidates.json', 'utf8'),
) as { decks: CandidateDeck[] };

const rows = readFileSync('src/v2/authored/gift-rank.jsonl', 'utf8')
	.split('\n')
	.filter((l) => l.trim() !== '')
	.map((l) => JSON.parse(l) as { deck: string; giftId: string; bucket: number });

/**
 * 후보 셋의 공급을 엔진의 `AxisSupply` 로. **다리를 다시 놓지 않는다** —
 * 후보 셋이 이미 공급 표의 말(`COMBUSTION` · `blunt`)로 적혀 있다.
 */
const supplyOf = new Map<string, AxisSupply>(
	decks.map((d) => [
		d.id,
		axisSupplyOf(
			[
				...d.supply.axis.map(([refId, count]) => ({ refKind: 'axis', refId, count })),
				...d.supply.attackType.map(([refId, count]) => ({ refKind: 'attack_type', refId, count })),
			],
			d.supply.fieldSize,
		),
	]),
);

const cardOf = new Map<string, CandidateCard>();
for (const d of decks) for (const c of d.cards) cardOf.set(`${d.id}\t${c.card.giftId}`, c);

const value = (deck: string, giftId: string): number => {
	const c = cardOf.get(`${deck}\t${giftId}`);
	const s = supplyOf.get(deck);
	if (c === undefined || s === undefined) return 0;
	return valueOf(
		{ keywordId: c.card.keywordId, tier: c.card.tier, exclusive: c.card.exclusive },
		s,
	);
};

/**
 * 바구니를 순서 제약으로 편다 — `scripts/rank/pairs.ts` 와 같은 규칙이다.
 * 덱 안에서만, `fireable` 만(죽는 기프트를 0점으로 두면 정확도가 오르는
 * 가짜 이득을 막는다), 칸이 다를 때만.
 */
interface Pair {
	deck: string;
	hi: string;
	lo: string;
	tangled: boolean;
}
const pairs: Pair[] = [];
for (const d of decks) {
	const judged = rows
		.filter((r) => r.deck === d.id)
		.filter((r) => cardOf.get(`${r.deck}\t${r.giftId}`)?.card.fireable === true);
	for (const x of judged) {
		for (const y of judged) {
			if (x.bucket > y.bucket) {
				const xs = cardOf.get(`${d.id}\t${x.giftId}`)?.stratum;
				const ys = cardOf.get(`${d.id}\t${y.giftId}`)?.stratum;
				pairs.push({
					deck: d.id,
					hi: x.giftId,
					lo: y.giftId,
					tangled: xs === '엇갈린다' && ys === '엇갈린다',
				});
			}
		}
	}
}

const hits = (ps: Pair[]): number =>
	ps.filter((p) => value(p.deck, p.hi) > value(p.deck, p.lo)).length;

test('표본이 판정 304줄 · 순서 제약 2,437짝이다 — 다르면 표본이 바뀐 것이다', () => {
	assert.equal(rows.length, 304);
	assert.equal(pairs.length, 2437);
});

test('전체 재현 — 1,957/2,437 (80.3%)', () => {
	assert.equal(hits(pairs), 1957);
});

test('엇갈린 무더기 안 재현 — 229/331 (69.2%). 이 수가 이 표본의 값어치다', () => {
	const tangled = pairs.filter((p) => p.tangled);
	assert.equal(tangled.length, 331);
	assert.equal(hits(tangled), 229);
});
