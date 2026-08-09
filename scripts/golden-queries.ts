/**
 * 골든 대조 — 층을 옮겨도 화면이 같은 것을 보는가.
 *
 * **바꾸기 전에 뜬다.** 지금 출력을 이름 붙여 파일로 남기고, 바꾼 뒤 다른 이름으로
 * 다시 떠서 맞춘다. 다르면 그것이 조사거리다 — 나아진 것인지 깨진 것인지는 사람이
 * 판정한다(설계 결정 4).
 *
 * **테스트가 아니다.** 산출물은 152,399행에서 뽑은 것이라 커밋에 남길 물건이 아니고,
 * 기준은 그때그때 다시 뜨는 것이 옳다. `build/` 아래라 gitignore 대상이다.
 *
 * 실행:
 *   npm run golden:capture -- before      지금 출력을 뜬다
 *   (코드를 바꾼다)
 *   npm run golden:capture -- after
 *   npm run golden:compare -- before after
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'build', 'golden');

/**
 * 안정된 직렬화.
 *
 * `BigInt` 는 `JSON.stringify` 가 던지고, `Date` 는 실행 시각이 아니라 값이므로
 * ISO 로 굳힌다. `Set` 은 순서가 삽입순이라 정렬해야 대조가 된다 —
 * `listCursedGiftIds` 가 `Set<number>` 를 돌려준다.
 */
function stable(value: unknown): string {
	return JSON.stringify(
		value,
		(_k, v) => {
			if (typeof v === 'bigint') return `${v}n`;
			if (v instanceof Date) return v.toISOString();
			if (v instanceof Set) return [...v].sort();
			return v;
		},
		'\t',
	);
}

interface Case {
	name: string;
	run: () => Promise<unknown>;
}

/**
 * 화면이 쓰는 질의.
 *
 * **한때 `v1`(public)과 짝이었다.** 앱 전환이 끝나 현행 질의 일곱을 지웠으므로
 * 기준을 다시 뜰 수 없다 — 그때 뜬 것과의 대조 결과는 PR 본문과 설계 문서에 남겼다.
 *
 * 도구는 남긴다. 다음 층 이동(M4 의 `recommend`)에서 같은 방식이 필요하다.
 */
async function cases(): Promise<Case[]> {
	const ref = await import('../lib/queries/canonical/reference.js');
	const gifts = await import('../lib/queries/canonical/gifts.js');
	const packs = await import('../lib/queries/canonical/packs.js');
	const detail = await import('../lib/queries/canonical/detail.js');
	const squad = await import('../lib/queries/canonical/squad.js');
	const recommend = await import('../lib/queries/canonical/recommend.js');

	/**
	 * **기프트 목록을 통째로 뜨지 않는다.** 후보 팩 27개에 기프트 1,990건이고
	 * 근거까지 실으면 골든 한 건이 수 MB 가 된다 — 대조할 때 사람이 못 읽는다.
	 * 회귀가 나는 자리는 순위와 점수이므로 그것만 남긴다.
	 */
	const summarize = (r: Awaited<ReturnType<typeof recommend.recommendForDeck>>) => ({
		floor: r.floor,
		difficulty: r.difficulty,
		rankable: r.rankable,
		candidateCount: r.candidateCount,
		deck: r.deck.map((d) => ({ id: d.id, name: d.name, axes: d.axes })),
		supply: r.supply,
		owned: r.owned,
		packs: r.packs.map((p) => ({
			id: p.id,
			name: p.name,
			// 부동소수 꼬리가 판마다 흔들리면 대조가 시끄러워진다. 여섯 자리로 자른다
			score: Number(p.score.toFixed(6)),
			fit: Number(p.fit.toFixed(6)),
			live: Number(p.live.toFixed(6)),
			tally: p.tally,
		})),
	});

	return [
		{ name: 'reference.listFloorPacks', run: () => ref.listFloorPacks('ko') },
		{ name: 'reference.getDungeon', run: () => ref.getDungeon('ko') },
		{ name: 'reference.listStatuses', run: () => ref.listStatuses('ko', ref.readGlossaryFilter({})) },
		{ name: 'reference.listGlossaryAxes', run: () => ref.listGlossaryAxes('ko') },
		{ name: 'reference.getCounts', run: () => ref.getCounts() },
		{ name: 'gifts.listGifts', run: () => gifts.listGifts('ko', gifts.readGiftFilter({})) },
		{ name: 'gifts.listAllGifts', run: () => gifts.listAllGifts('ko') },
		{ name: 'gifts.listCursedGiftIds', run: () => gifts.listCursedGiftIds() },
		{ name: 'gifts.listKeywords', run: () => gifts.listKeywords('ko') },
		{ name: 'gifts.listSins', run: () => gifts.listSins('ko') },
		{ name: 'gifts.getGift.9088', run: () => gifts.getGift(9088, 'ko') },
		{ name: 'gifts.getGift.9090', run: () => gifts.getGift(9090, 'ko') },
		{ name: 'packs.listPacks', run: () => packs.listPacks('ko', packs.readPackFilter({})) },
		{ name: 'packs.getPack.1309', run: () => detail.getPack('1309', 'ko') },
		{ name: 'identities.getIdentity.10208', run: () => detail.getIdentity(10208, 'ko') },
		{ name: 'egos.getEgo.20509', run: () => detail.getEgo(20509, 'ko') },
		{ name: 'squad.listSquad', run: () => squad.listSquad('ko') },
		{ name: 'squad.listSquadAxes', run: () => squad.listSquadAxes('ko') },
		{
			name: 'recommend.floor3.hard',
			run: async () => summarize(await recommend.recommendForDeck('ko', { floor: 3, difficulty: 'hard' })),
		},
		{
			// 보유가 후보를 줄이고 연쇄를 켜는 경로. PR-A 의 빈 배열 버그가 여기 걸린다
			name: 'recommend.floor3.owned',
			run: async () =>
				summarize(
					await recommend.recommendForDeck('ko', {
						floor: 3,
						difficulty: 'hard',
						ownedIds: [9001, 9005, 9009, 9029, 9041, 9052, 9066, 9088, 9090, 9092, 9103, 9110],
					}),
				),
		},
		{ name: 'search.이상', run: () => ref.searchAll('이상', 'ko') },
		{ name: 'search.화상', run: () => ref.searchAll('화상', 'ko') },
	];
}

/** 이름 하나에 한 벌을 뜬다. 층을 바꾸기 전후로 다른 이름을 주고 대조한다. */
async function capture(label: string): Promise<void> {
	mkdirSync(join(OUT, label), { recursive: true });
	const rows = await cases();
	for (const c of rows) {
		const value = await c.run();
		writeFileSync(join(OUT, label, `${c.name}.json`), stable(value));
		console.log(`  ${c.name}`);
	}
	console.log('');
	console.log(`${label} — ${rows.length}건 떴다. ${join(OUT, label)}`);
}

function compare(a: string, b: string): void {
	const v1 = join(OUT, a);
	const v2 = join(OUT, b);
	for (const [label, dir] of [[a, v1], [b, v2]] as const) {
		if (existsSync(dir)) continue;
		console.error(`${label} 골든이 없다. npm run golden:capture -- ${label} 을 먼저 돌린다.`);
		process.exitCode = 1;
		return;
	}

	const names = new Set<string>();
	for (const dir of [v1, v2]) {
		for (const f of readdirSync(dir)) names.add(f);
	}

	let same = 0;
	const oneSided: string[] = [];
	const differing: string[] = [];

	for (const f of [...names].sort()) {
		const left = existsSync(join(v1, f)) ? readFileSync(join(v1, f), 'utf8') : null;
		const right = existsSync(join(v2, f)) ? readFileSync(join(v2, f), 'utf8') : null;
		const name = f.replace(/\.json$/, '');
		if (left === null || right === null) { oneSided.push(name); continue; }
		if (left === right) { same++; continue; }
		differing.push(name);
	}

	console.log(`같다 ${same}건 · 다르다 ${differing.length}건 · 한쪽만 ${oneSided.length}건`);

	if (differing.length > 0) {
		console.log('');
		console.log('다른 것 — 나아진 것인지 깨진 것인지 사람이 판정한다:');
		for (const n of differing) console.log(`  ${n}`);
		console.log('');
		console.log(`  diff ${join(v1, '<이름>.json')} ${join(v2, '<이름>.json')}`);
	}

	if (oneSided.length > 0) {
		console.log('');
		console.log('한쪽만 뜬 것 — 아직 안 옮겼거나 대체되는 자리다:');
		for (const n of oneSided) console.log(`  ${n}`);
	}
}

const [, , mode, first, second] = process.argv;
if (mode === 'compare') {
	if (first === undefined || second === undefined) {
		console.error('쓰임: golden-queries.ts compare <이름1> <이름2>');
		process.exitCode = 1;
	} else {
		compare(first, second);
	}
} else if (mode === 'capture') {
	if (first === undefined) {
		console.error('쓰임: golden-queries.ts capture <이름>');
		process.exitCode = 1;
	} else {
		await capture(first);
	}
} else {
	console.error('쓰임: golden-queries.ts capture <이름> | compare <이름1> <이름2>');
	process.exitCode = 1;
}
