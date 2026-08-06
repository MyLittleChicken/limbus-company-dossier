/**
 * 골든 대조 — 층을 옮겨도 화면이 같은 것을 보는가.
 *
 * **옮기기 전에 뜬다.** 현행 질의(`public`)의 출력을 파일로 남기고, 옮긴 뒤 새
 * 질의(`canonical`)의 출력과 맞춘다. 다르면 그것이 조사거리다 — 나아진 것인지
 * 깨진 것인지는 사람이 판정한다(설계 결정 4).
 *
 * **테스트가 아니다.** 화면 13개의 산출물은 152,399행에서 뽑은 것이라 커밋에
 * 남길 물건이 아니고, 기준은 그때그때 현행에서 다시 뜨는 것이 옳다. 산출물은
 * `build/` 아래라 gitignore 대상이다.
 *
 * 실행:
 *   npm run golden:capture -- v1     현행 질의를 뜬다
 *   npm run golden:capture -- v2     새 질의를 뜬다
 *   npm run golden:compare           둘을 맞춘다
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

/** 현행 질의(public). Task 7 이 파일을 지울 때 함께 사라진다. */
async function casesV1(): Promise<Case[]> {
	const ref = await import('../lib/queries/reference.js');
	const search = await import('../lib/queries/search.js');
	const gifts = await import('../lib/queries/gifts.js');
	const packs = await import('../lib/queries/packs.js');
	const ids = await import('../lib/queries/identities.js');
	const egos = await import('../lib/queries/egos.js');
	const squad = await import('../lib/queries/squad.js');

	return [
		{ name: 'reference.listFloorPacks', run: () => ref.listFloorPacks('ko') },
		{ name: 'reference.getDungeon', run: () => ref.getDungeon('ko') },
		{ name: 'reference.listStatuses', run: () => ref.listStatuses('ko', ref.readGlossaryFilter({})) },
		{ name: 'reference.listGlossaryAxes', run: () => ref.listGlossaryAxes('ko') },
		{ name: 'reference.getDataset', run: () => ref.getDataset() },
		{ name: 'reference.getCounts', run: () => ref.getCounts() },
		{ name: 'search.이상', run: () => search.searchAll('이상', 'ko') },
		{ name: 'search.화상', run: () => search.searchAll('화상', 'ko') },
		{ name: 'gifts.listGifts', run: () => gifts.listGifts('ko', gifts.readGiftFilter({})) },
		{ name: 'gifts.listAllGifts', run: () => gifts.listAllGifts('ko') },
		{ name: 'gifts.listCursedGiftIds', run: () => gifts.listCursedGiftIds() },
		{ name: 'gifts.listKeywords', run: () => gifts.listKeywords('ko') },
		{ name: 'gifts.listSins', run: () => gifts.listSins('ko') },
		{ name: 'gifts.getGift.9088', run: () => gifts.getGift(9088, 'ko') },
		{ name: 'gifts.getGift.9090', run: () => gifts.getGift(9090, 'ko') },
		{ name: 'packs.listPacks', run: () => packs.listPacks('ko', packs.readPackFilter({})) },
		{ name: 'packs.getPack.1309', run: () => packs.getPack('1309', 'ko') },
		{ name: 'identities.listSinners', run: () => ids.listSinners('ko') },
		{ name: 'identities.listAffiliations', run: () => ids.listAffiliations('ko') },
		{ name: 'identities.listIdentities', run: () => ids.listIdentities('ko', ids.readIdentityFilter({})) },
		{ name: 'identities.getIdentity.10208', run: () => ids.getIdentity(10208, 'ko') },
		{ name: 'egos.listEgos', run: () => egos.listEgos('ko', egos.readEgoFilter({})) },
		{ name: 'egos.getEgo.20509', run: () => egos.getEgo(20509, 'ko') },
		{ name: 'squad.listSquad', run: () => squad.listSquad('ko') },
		{ name: 'squad.listSquadAxes', run: () => squad.listSquadAxes('ko') },
	];
}

/**
 * 새 질의(canonical). **Task 를 진행하며 여기에 한 줄씩 는다.**
 *
 * 아직 안 옮긴 것은 목록에 없으므로 `compare` 가 「한쪽만」으로 보고한다 —
 * 그것이 진행 상황 표시가 된다.
 */
async function casesV2(): Promise<Case[]> {
	const ref = await import('../lib/queries/canonical/reference.js');
	const gifts = await import('../lib/queries/canonical/gifts.js');
	const packs = await import('../lib/queries/canonical/packs.js');
	const detail = await import('../lib/queries/canonical/detail.js');

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
	];
}

async function capture(which: 'v1' | 'v2'): Promise<void> {
	mkdirSync(join(OUT, which), { recursive: true });
	const cases = which === 'v1' ? await casesV1() : await casesV2();
	for (const c of cases) {
		const value = await c.run();
		writeFileSync(join(OUT, which, `${c.name}.json`), stable(value));
		console.log(`  ${c.name}`);
	}
	console.log('');
	console.log(`${which} — ${cases.length}건 떴다. ${join(OUT, which)}`);
}

function compare(): void {
	const v1 = join(OUT, 'v1');
	const v2 = join(OUT, 'v2');
	if (!existsSync(v1)) {
		console.error('v1 골든이 없다. npm run golden:capture -- v1 을 먼저 돌린다.');
		process.exitCode = 1;
		return;
	}

	const names = new Set<string>();
	for (const dir of [v1, v2]) {
		if (!existsSync(dir)) continue;
		for (const f of readdirSync(dir)) names.add(f);
	}

	let same = 0;
	const oneSided: string[] = [];
	const differing: string[] = [];

	for (const f of [...names].sort()) {
		const a = existsSync(join(v1, f)) ? readFileSync(join(v1, f), 'utf8') : null;
		const b = existsSync(join(v2, f)) ? readFileSync(join(v2, f), 'utf8') : null;
		const name = f.replace(/\.json$/, '');
		if (a === null || b === null) { oneSided.push(name); continue; }
		if (a === b) { same++; continue; }
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

const mode = process.argv[2];
if (mode === 'compare') {
	compare();
} else if (mode === 'v1' || mode === 'v2') {
	await capture(mode);
} else {
	console.error('쓰임: golden-queries.ts <v1|v2|compare>');
	process.exitCode = 1;
}
