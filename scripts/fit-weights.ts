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
import { keywordLabel } from './rank/fit.js';
import { pairsOf } from './rank/pairs.js';
import { searchWeights, valueOf, agreementOf, type Weights } from './rank/grid.js';
import type { Bucket, DeckSupply, GiftCard, RankRow } from './rank/types.js';

const SAMPLE = 'src/v2/authored/gift-rank.jsonl';

interface DeckJson {
	id: string; name: string;
	// `fieldSize` 는 적합도의 분모다 — 없으면 저울추가 후보 셋과 다른 자로 셈한다
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]>; fieldSize: number };
	cards: GiftCard[];
}

const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
	const i = argv.indexOf(k);
	return i >= 0 ? String(argv[i + 1]) : d;
};

// 후보 셋은 저작 자리에서 읽는다 — `/tmp` 에 두면 판정 줄의 뜻을 정하는 것(덱별
// 공급 · 카드별 fireable)이 재부팅이면 사라져 저울추를 재현할 수 없다
const { decks } = JSON.parse(readFileSync(arg('--in', 'src/v2/authored/gift-rank-candidates.json'), 'utf8')) as { decks: DeckJson[] };

/**
 * 표본을 줄 단위로 읽는다. **어느 줄이 깨졌는지 말해 준다.**
 *
 * 이 파일은 사람이 페이지의 텍스트 상자에서 60줄을 복사해 붙여넣는 것이라,
 * 잘리거나 두 줄이 붙는 일이 실제로 생긴다. 그냥 `JSON.parse` 하면 Node 스택이
 * **이 스크립트**를 가리켜서, 정작 고칠 자리가 표본 몇째 줄인지 안 나온다.
 *
 * `cleanRows` 가 후보 밖·중복에 대해 하는 것과 같은 태도다 — 의심스러우면
 * 멈추되, 어디를 고쳐야 하는지 함께 말한다.
 */
const parseLine = (line: string, n: number): RankRow => {
	try {
		const o = JSON.parse(line) as { deck: string; giftId: string; bucket: number };
		if (typeof o.deck !== 'string' || typeof o.giftId !== 'string') {
			throw new Error('deck 이나 giftId 가 글자가 아니다');
		}
		if (![0, 1, 2, 3].includes(o.bucket)) throw new Error(`bucket 이 ${String(o.bucket)} 이다`);
		return { deck: o.deck, giftId: o.giftId, bucket: o.bucket as Bucket };
	} catch (e) {
		console.error(`표본 ${n}번째 줄을 못 읽었다 — ${(e as Error).message}`);
		console.error(`  ${line.slice(0, 80)}`);
		process.exit(1);
	}
};

// **읽은 자리를 기억해 둔다.** 오류는 상수가 아니라 실제로 읽은 경로를 찍어야
// 한다 — `--sample` 로 딴 파일을 준 사람에게 엉뚱한 자리를 고치라고 하게 된다
const samplePath = arg('--sample', SAMPLE);

const rows: RankRow[] = readFileSync(samplePath, 'utf8')
	.split('\n')
	.map((l, i) => ({ line: l.trim(), n: i + 1 }))
	.filter((x) => x.line !== '')
	.map((x) => parseLine(x.line, x.n));

if (rows.length === 0) {
	console.error(`표본이 비었다 — ${samplePath}`);
	console.error('npm run rank:page 로 페이지를 만들어 판정한 뒤 내보낸 것을 넣어라.');
	process.exit(1);
}

const supplyOf = new Map<string, DeckSupply>(decks.map((d) => [d.id, {
	axis: new Map(d.supply.axis), attackType: new Map(d.supply.attackType),
	fieldSize: d.supply.fieldSize,
}]));
const cardOf = new Map<string, GiftCard>();
for (const d of decks) for (const c of d.cards) cardOf.set(`${d.id}\t${c.giftId}`, c);

const fireable = (deck: string, giftId: string): boolean =>
	cardOf.get(`${deck}\t${giftId}`)?.fireable ?? false;

/**
 * 표본을 다듬는다 — **조용히 잃거나 부풀리는 것이 없게.**
 *
 * 둘 다 실제로 겪을 일이다. 사람이 판정을 내보낸 뒤 누군가 `rank:deck` 을 다시
 * 돌리면 후보가 바뀌어 표본이 후보에 없는 기프트를 가리키고, 붙여넣기 실수로
 * 같은 줄이 두 번 들어오기도 한다.
 *
 * 안 막으면 어느 쪽도 티가 안 난다(실측 2026-08-17).
 * 후보 밖 행은 `fireable` 이 `false` 로 떨어져 짝이 통째로 사라지는데 「표본 N
 * 판정」은 그대로 커져 있고, 중복 한 줄은 확인 덱의 짝을 9 → 12 로 33% 부풀렸다.
 *
 * **의심스러우면 멈춘다.** 이 스크립트가 내는 수치가 곧 다음 PR 을 열지 정하는
 * 근거라, 반쯤 맞는 답을 내느니 안 내는 편이 낫다.
 */
function cleanRows(rows: RankRow[]): RankRow[] {
	const outside = rows.filter((r) => !cardOf.has(`${r.deck}\t${r.giftId}`));
	if (outside.length > 0) {
		console.error(`표본에 후보 밖 기프트가 ${outside.length}줄 있다 — 후보가 바뀌었거나 표본이 낡았다`);
		for (const r of outside.slice(0, 10)) console.error(`  덱 ${r.deck} · ${r.giftId}`);
		console.error('rank:deck 을 다시 돌렸다면 표본도 다시 받아야 한다.');
		process.exit(1);
	}

	const seen = new Map<string, RankRow>();
	let dupes = 0;
	for (const r of rows) {
		const k = `${r.deck}\t${r.giftId}`;
		const prev = seen.get(k);
		if (prev === undefined) {
			seen.set(k, r);
			continue;
		}
		// 판정이 서로 다르면 어느 쪽이 참인지 모른다. 골라내면 그것이 지어내기다
		if (prev.bucket !== r.bucket) {
			console.error(`같은 기프트에 판정이 둘이다 — 덱 ${r.deck} · ${r.giftId} · ${prev.bucket} 과 ${r.bucket}`);
			process.exit(1);
		}
		dupes += 1;
	}
	if (dupes > 0) console.log(`중복 ${dupes}줄을 지웠다 — 판정이 같아 뜻은 안 바뀐다`);
	return [...seen.values()];
}
const value = (deck: string, giftId: string, w: Weights): number => {
	const c = cardOf.get(`${deck}\t${giftId}`);
	const s = supplyOf.get(deck);
	if (c === undefined || s === undefined) return 0;
	return valueOf(c, s, w);
};

const clean = cleanRows(rows);
const allPairs = pairsOf(clean, fireable);
const deckIds = [...new Set(clean.map((r) => r.deck))].sort();

// **판정 수와 산 판정 수를 따로 낸다.** 죽은 기프트는 짝을 안 만들므로, 둘이
// 크게 벌어지면 저울추가 생각보다 적은 근거로 정해졌다는 뜻이다
const live = clean.filter((r) => fireable(r.deck, r.giftId)).length;
console.log(`표본 ${clean.length}판정 (그중 켜지는 것 ${live}) · 덱 ${deckIds.join(' ')} · 순서 제약 ${allPairs.length}짝\n`);

const pct = (h: number, t: number): string =>
	t === 0 ? '  —  ' : `${((h / t) * 100).toFixed(1).padStart(5)}%`;

/**
 * 동점 저울추가 무엇을 안 가르는지 말한다.
 *
 * **폭이 곧 표본이 못 정한 것이다.** 「적합이 값의 33~67%」라면 표본은 적합이
 * 등급보다 크다는 것까지만 정했고 얼마나 큰지는 안 정했다는 뜻이다 — 그것을
 * 하나의 수로 찍으면 지어내기가 된다.
 */
function spread(tied: Weights[]): string[] {
	const shares = tied
		.map((w) => ({ w, s: w.fit + w.tier + w.exclusive }))
		.filter((x) => x.s > 0);
	if (shares.length === 0) return ['  (전부 0 인 저울추뿐이다 — 표본이 아무것도 안 갈랐다)'];
	const pct = (pick: (w: Weights) => number): string => {
		const vs = shares.map((x) => (pick(x.w) / x.s) * 100);
		return `${Math.min(...vs).toFixed(0)}% ~ ${Math.max(...vs).toFixed(0)}%`;
	};
	return [
		`  적합이 차지하는 몫   ${pct((w) => w.fit)}`,
		`  등급이 차지하는 몫   ${pct((w) => w.tier)}`,
		`  전용이 차지하는 몫   ${pct((w) => w.exclusive)}`,
	];
}

/**
 * 갈래마다도 동점을 밝힌다 — **여기가 가장 잘못 읽히는 자리다.**
 *
 * 확인 쪽 수치는 대표 저울추 하나로 잰 것이고, 대표는 항을 적게 쓰는 쪽이라
 * 체계적으로 `w_적합 = 0` 을 고른다. 맞춘 덱이 등급만으로 갈리고 뺀 덱이 적합도를
 * 들고 있으면 화면에는 「확인 0%」가 찍히는데, 같은 점수를 내는 다른 저울추로는
 * 100% 인 일이 실제로 생긴다 — 그것을 「모형이 틀렸다」로 읽으면 정반대다.
 * 그래서 확인 쪽도 동점 전부로 재서 폭을 함께 찍는다.
 */
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

	const hits = r.tied.map((w) => agreementOf(test, (d, g) => value(d, g, w)).hit);
	const lo = Math.min(...hits);
	const hi = Math.max(...hits);
	console.log(`    같은 점수를 내는 저울추 ${r.tied.length}가지 — 위 저울추는 그중 대표 하나다`);
	console.log(`    그 저울추들의 확인 쪽  ${pct(lo, test.length)} ~ ${pct(hi, test.length)}`);
	for (const line of spread(r.tied)) console.log(`  ${line}`);
}

const all = searchWeights(allPairs, value);
console.log(`\n전부로 맞춘 저울추   적합 ${all.best.fit} · 등급 ${all.best.tier} · 전용 ${all.best.exclusive}`);
console.log(`정확도               ${pct(all.hit, all.total)} (${all.hit}/${all.total})`);

console.log(`\n같은 점수를 내는 저울추 ${all.tied.length}가지 — 표본이 하나로 못 좁혔다`);
for (const line of spread(all.tied)) console.log(line);

/** 어느 갈래를 못 맞히나 — 모양이 틀렸는지 여기서 보인다 */
const missed = allPairs.filter((p) =>
	value(p.deck, p.hi, all.best) <= value(p.deck, p.lo, all.best));
if (missed.length > 0) {
	console.log(`\n못 맞힌 짝 ${missed.length} (앞 12개)`);
	for (const p of missed.slice(0, 12)) {
		const hi = cardOf.get(`${p.deck}\t${p.hi}`);
		const lo = cardOf.get(`${p.deck}\t${p.lo}`);
		// 키워드는 `keywordLabel` 을 거친다 — 날것으로 찍으면 글자 'None' 이 그대로 샌다
		console.log(`  ${p.deck}  ${hi?.name ?? p.hi} > ${lo?.name ?? p.lo}`
			+ `   (${hi?.tier ?? 'EX'}등급 ${keywordLabel(hi?.keywordId ?? null)}`
			+ ` vs ${lo?.tier ?? 'EX'}등급 ${keywordLabel(lo?.keywordId ?? null)})`);
	}
}
