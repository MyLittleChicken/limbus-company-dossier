/**
 * 표본을 읽어 저울추를 찾고 보고한다.
 *
 * **두 덱으로 맞추고 남은 덱으로 확인한다.** 60개에 저울추 셋이면 외워버릴
 * 위험이 크진 않지만, 확인 없이 「맞췄다」고 하면 그것은 증명이 아니다.
 * 세 갈래를 모두 돌려 셋 다 보고한다.
 *
 * 확인 덱의 정확도가 맞춘 덱보다 **크게 낮으면 모양이 틀린 것**이다 —
 * 저울추를 더 늘리지 말고 그 사실을 적는다.
 *
 * 실행: npm run rank:fit
 */
import { readFileSync } from 'node:fs';
import { pairsOf } from './rank/pairs.js';
import { searchWeights, valueOf, agreementOf, type Weights } from './rank/grid.js';
import type { Bucket, DeckSupply, GiftCard, RankRow } from './rank/types.js';

const SAMPLE = 'src/v2/authored/gift-rank.jsonl';

interface DeckJson {
	id: string; name: string;
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]> };
	cards: GiftCard[];
}

const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
	const i = argv.indexOf(k);
	return i >= 0 ? String(argv[i + 1]) : d;
};

const { decks } = JSON.parse(readFileSync(arg('--in', '/tmp/rank-candidates.json'), 'utf8')) as { decks: DeckJson[] };

const rows: RankRow[] = readFileSync(arg('--sample', SAMPLE), 'utf8')
	.split('\n').map((l) => l.trim()).filter((l) => l !== '')
	.map((l) => JSON.parse(l) as { deck: string; giftId: string; bucket: number })
	.map((r) => ({ deck: r.deck, giftId: r.giftId, bucket: r.bucket as Bucket }));

if (rows.length === 0) {
	console.error(`표본이 비었다 — ${SAMPLE}`);
	console.error('npm run rank:page 로 페이지를 만들어 판정한 뒤 내보낸 것을 넣어라.');
	process.exit(1);
}

const supplyOf = new Map<string, DeckSupply>(decks.map((d) => [d.id, {
	axis: new Map(d.supply.axis), attackType: new Map(d.supply.attackType),
}]));
const cardOf = new Map<string, GiftCard>();
for (const d of decks) for (const c of d.cards) cardOf.set(`${d.id}\t${c.giftId}`, c);

const fireable = (deck: string, giftId: string): boolean =>
	cardOf.get(`${deck}\t${giftId}`)?.fireable ?? false;
const value = (deck: string, giftId: string, w: Weights): number => {
	const c = cardOf.get(`${deck}\t${giftId}`);
	const s = supplyOf.get(deck);
	if (c === undefined || s === undefined) return 0;
	return valueOf(c, s, w);
};

const allPairs = pairsOf(rows, fireable);
const deckIds = [...new Set(rows.map((r) => r.deck))].sort();

console.log(`표본 ${rows.length}판정 · 덱 ${deckIds.join(' ')} · 순서 제약 ${allPairs.length}짝\n`);

const pct = (h: number, t: number): string =>
	t === 0 ? '  —  ' : `${((h / t) * 100).toFixed(1).padStart(5)}%`;

console.log('덱 하나를 빼고 맞춘 뒤, 뺀 덱으로 확인한다');
console.log('  확인 덱   맞춘 쪽            확인 쪽            저울추 (적합·등급·전용)');
for (const held of deckIds) {
	const train = allPairs.filter((p) => p.deck !== held);
	const test = allPairs.filter((p) => p.deck === held);
	const r = searchWeights(train, value);
	const t = agreementOf(test, (d, g) => value(d, g, r.best));
	console.log(`  ${held}         ${pct(r.hit, r.total)} (${r.hit}/${r.total})`
		+ `      ${pct(t.hit, t.total)} (${t.hit}/${t.total})`
		+ `      ${r.best.fit} · ${r.best.tier} · ${r.best.exclusive}`);
}

const all = searchWeights(allPairs, value);
console.log(`\n전부로 맞춘 저울추   적합 ${all.best.fit} · 등급 ${all.best.tier} · 전용 ${all.best.exclusive}`);
console.log(`정확도               ${pct(all.hit, all.total)} (${all.hit}/${all.total})`);

/** 어느 갈래를 못 맞히나 — 모양이 틀렸는지 여기서 보인다 */
const missed = allPairs.filter((p) =>
	value(p.deck, p.hi, all.best) <= value(p.deck, p.lo, all.best));
if (missed.length > 0) {
	console.log(`\n못 맞힌 짝 ${missed.length} (앞 12개)`);
	for (const p of missed.slice(0, 12)) {
		const hi = cardOf.get(`${p.deck}\t${p.hi}`);
		const lo = cardOf.get(`${p.deck}\t${p.lo}`);
		console.log(`  ${p.deck}  ${hi?.name ?? p.hi} > ${lo?.name ?? p.lo}`
			+ `   (${hi?.tier ?? 'EX'}등급 ${hi?.keywordId ?? '-'} vs ${lo?.tier ?? 'EX'}등급 ${lo?.keywordId ?? '-'})`);
	}
}
