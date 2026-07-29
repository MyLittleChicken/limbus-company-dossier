/**
 * 슬라이스 증명.
 *
 * 각 슬라이스가 무엇을 주장하고 무엇으로 그것을 보이는지 여기 모은다.
 * **통과가 아니라 수치를 낸다.** "됐다"가 아니라 "몇 건 중 몇 건"이어야 다음 사람이 판단할 수 있다.
 *
 *   실행: npm run engine:proof
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
	loadAffiliations,
	loadGifts,
	loadIdentities,
	loadPackCandidates,
	packIdsForFloor,
} from '../lib/engine/load.js';
import { checkCoverage } from '../lib/engine/vocab.js';
import { contextOf, deckFeature, type RunState } from '../lib/engine/state.js';
import { marginalValue, scoreState } from '../lib/engine/score.js';
import { rankPacks } from '../lib/engine/pack.js';

const db = new PrismaClient();

/** 화진 덱 — 새벽 사무소 3 + 엄지 4 = 온필드 정원 7. */
const HWAJIN = [10216, 11009, 11216, 10512, 10716, 10916, 11013];

let failures = 0;
const check = (label: string, ok: boolean, detail: string): void => {
	if (!ok) failures += 1;
	console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(38)} ${detail}`);
};

async function main(): Promise<void> {
	const affiliations = await loadAffiliations();
	// checkCoverage 는 소속 id 존재 여부만 본다(내부적으로 mapTrigger 를 그대로 씀) —
	// load.ts:97 과 같은 이유로 여기서도 이름 맵에서 id 집합만 뽑아 건넨다.
	const affiliationIds = new Set(affiliations.keys());

	// ── 슬라이스 0 — 어휘 사전이 원본을 덮는가 ────────────────
	console.log('\n[슬라이스 0] 어휘 — 원본 토큰을 빠짐없이 옮기는가');
	const tokens = await db.giftToken.findMany({ select: { kind: true, token: true } });
	const cov = checkCoverage(
		tokens.filter((t) => t.kind === 'effect').map((t) => t.token),
		tokens.filter((t) => t.kind === 'trigger').map((t) => t.token),
		affiliationIds,
	);
	check(
		'효과 토큰 커버리지',
		cov.effects.unmapped.length === 0,
		`${cov.effects.mapped}/${cov.effects.total}${cov.effects.unmapped.length ? ' 미분류: ' + cov.effects.unmapped.slice(0, 5).join(', ') : ''}`,
	);
	check(
		'발동 토큰 커버리지',
		cov.triggers.unmapped.length === 0,
		`${cov.triggers.mapped}/${cov.triggers.total}${cov.triggers.unmapped.length ? ' 미분류: ' + cov.triggers.unmapped.slice(0, 20).join(', ') : ''}`,
	);

	// ── 슬라이스 1 — 덱 특성이 실데이터와 맞는가 ──────────────
	console.log('\n[슬라이스 1] 덱 특성 — 화진 덱을 바르게 읽는가');
	const deck = await loadIdentities('ko', HWAJIN);
	check('인격 적재', deck.length === 7, `${deck.length}/7`);

	const { gifts, unmapped } = await loadGifts('ko', affiliations);
	const giftById = new Map(gifts.map((g) => [g.id, g]));
	const state: RunState = { deck, deployed: deck, owned: [], floor: 3 };
	const feature = deckFeature(state);

	check('화상 공급', (feature.statusSupply['burn'] ?? 0) === 7, `${feature.statusSupply['burn'] ?? 0}명`);
	check('진동 공급', (feature.statusSupply['tremor'] ?? 0) === 6, `${feature.statusSupply['tremor'] ?? 0}명`);
	check(
		'새벽 사무소',
		(feature.affiliation.deployed['Dawn Office'] ?? 0) === 3,
		`${feature.affiliation.deployed['Dawn Office'] ?? 0}명 (기프트 9282 조건 3)`,
	);
	check(
		'엄지',
		(feature.affiliation.deployed['The Thumb'] ?? 0) === 4,
		`${feature.affiliation.deployed['The Thumb'] ?? 0}명 (기프트 9283 조건 3)`,
	);
	check(
		'분노 공명 기반',
		(feature.sinSupply['wrath'] ?? 0) === 7,
		`wrath 스킬 ${feature.sinSupply['wrath'] ?? 0}명`,
	);
	check('미분류 잔존', unmapped.effects.size === 0 && unmapped.triggers.size === 0, `효과 ${unmapped.effects.size} · 발동 ${unmapped.triggers.size}`);

	// ── 슬라이스 2 — 조건이 덱에 반응하는가 ───────────────────
	console.log('\n[슬라이스 2] 조건 — 소속·공명 조건이 이 덱에서 켜지는가');
	const ctx = contextOf(state);
	const dawn = giftById.get(9282);
	const thumb = giftById.get(9283);
	check('9282 새벽 사무소 기프트 적재', dawn !== undefined, dawn?.name ?? '없음');
	check('9283 엄지 기프트 적재', thumb !== undefined, thumb?.name ?? '없음');
	if (dawn) {
		const m = marginalValue(state, dawn);
		check('9282 가치 > 0', m.delta > 0, `+${m.delta.toFixed(3)} · ${m.evidence.join(' / ') || '근거 없음'}`);
	}
	if (thumb) {
		const m = marginalValue(state, thumb);
		check('9283 가치 > 0', m.delta > 0, `+${m.delta.toFixed(3)} · ${m.evidence.join(' / ') || '근거 없음'}`);
	}

	// 대조군 — 소속이 없는 덱에서는 같은 기프트가 낮아야 한다
	const offDeck = await loadIdentities('ko', [10101, 10201, 10301, 10401, 10501, 10601, 10701]);
	const offState: RunState = { deck: offDeck, deployed: offDeck, owned: [], floor: 3 };
	if (dawn) {
		const on = marginalValue(state, dawn).delta;
		const off = marginalValue(offState, dawn).delta;
		check('9282 소속 없는 덱에서 낮음', off < on, `화진 ${on.toFixed(3)} vs 대조 ${off.toFixed(3)}`);
	}

	// ── 슬라이스 3 — 한계 효용이 상태에 반응하는가 ────────────
	console.log('\n[슬라이스 3] 한계 효용 — 이미 가진 것의 가치가 떨어지는가');
	const burnGifts = gifts
		.filter((g) => g.keyword === 'burn')
		.map((g) => ({ g, m: marginalValue(state, g).delta }))
		.sort((a, b) => b.m - a.m);
	const topBurn = burnGifts[0];
	check('화상 기프트 존재', topBurn !== undefined, `${burnGifts.length}종`);
	if (topBurn) {
		const owned: RunState = { ...state, owned: [topBurn.g] };
		const again = marginalValue(owned, topBurn.g).delta;
		check('보유 후 같은 기프트 가치 0', again === 0, `${again}`);
		const before = scoreState(state).total;
		const after = scoreState(owned).total;
		check('보유가 상태 점수를 올림', after > before, `${before.toFixed(2)} → ${after.toFixed(2)}`);
	}

	// **이것이 이 슬라이스의 진짜 주장이다.** 개별 기프트 한 종이 아니라 축 단위로 봐야
	// 엔진이 덱을 읽고 있는지 알 수 있다. 화진 덱이면 화상·진동이 위, 침잠이 아래여야 한다.
	const avgByKeyword = new Map<string, { n: number; sum: number }>();
	for (const g of gifts) {
		const k = g.keyword ?? 'none';
		const cur = avgByKeyword.get(k) ?? { n: 0, sum: 0 };
		cur.n += 1;
		cur.sum += marginalValue(state, g).delta;
		avgByKeyword.set(k, cur);
	}
	const avg = (k: string) => {
		const v = avgByKeyword.get(k);
		return v ? v.sum / v.n : 0;
	};
	const ordered = [...avgByKeyword.entries()]
		.map(([k, v]) => ({ k, a: v.sum / v.n }))
		.sort((x, y) => y.a - x.a);
	console.log(
		`     축 순위: ${ordered.slice(0, 4).map((o) => `${o.k} ${o.a.toFixed(3)}`).join(' · ')} … 최하 ${ordered[ordered.length - 1]?.k} ${ordered[ordered.length - 1]?.a.toFixed(3)}`,
	);
	check('화상이 축 1위', ordered[0]?.k === 'burn', `${ordered[0]?.k} ${ordered[0]?.a.toFixed(3)}`);
	check(
		'진동 > 침잠',
		avg('tremor') > avg('sinking'),
		`tremor ${avg('tremor').toFixed(3)} vs sinking ${avg('sinking').toFixed(3)}`,
	);
	check(
		'덱 축이 비축의 2배 이상',
		avg('burn') > avg('sinking') * 2,
		`burn ${avg('burn').toFixed(3)} vs sinking ${avg('sinking').toFixed(3)}`,
	);

	// 대조 덱에서는 화상이 1위가 아니어야 한다 — 축 판정이 덱에서 나온다는 증거다.
	const offAvg = new Map<string, { n: number; sum: number }>();
	for (const g of gifts) {
		const k = g.keyword ?? 'none';
		const cur = offAvg.get(k) ?? { n: 0, sum: 0 };
		cur.n += 1;
		cur.sum += marginalValue(offState, g).delta;
		offAvg.set(k, cur);
	}
	const offOrdered = [...offAvg.entries()]
		.map(([k, v]) => ({ k, a: v.sum / v.n }))
		.sort((x, y) => y.a - x.a);
	check(
		'대조 덱은 축 순위가 다름',
		offOrdered[0]?.k !== 'burn',
		`대조 축 1위 ${offOrdered[0]?.k} ${offOrdered[0]?.a.toFixed(3)}`,
	);

	// ── 슬라이스 4 — 팩 순위가 덱에 반응하는가 ────────────────
	console.log('\n[슬라이스 4] 팩 순위 — 화진 덱에 맞는 팩이 위로 오는가');
	const ids = await packIdsForFloor('hard', 3);
	const candidates = await loadPackCandidates('ko', giftById, ids);
	check('후보 팩', candidates.length > 0, `${candidates.length}종 (hard 3층)`);

	const { ranked, dropped } = rankPacks(state, candidates, { limit: 3 });
	for (const [i, r] of ranked.entries()) {
		console.log(`     ${i + 1}. ${r.name}  ${r.score.toFixed(2)}`);
		for (const reason of r.reasons.slice(0, 2)) console.log(`        · ${reason}`);
	}
	check('순위 산출', ranked.length > 0, `${ranked.length}종`);
	check(
		'접근 불가 팩 제외',
		dropped.some((d) => d.reason === 'hidden'),
		dropped.map((d) => `${d.name}(${d.reason})`).join(', ') || '없음',
	);

	const offRanked = rankPacks(offState, candidates, { limit: 3 }).ranked;
	check(
		'덱이 바뀌면 순위가 바뀜',
		ranked[0]?.packId !== offRanked[0]?.packId || ranked[0]!.score !== offRanked[0]!.score,
		`화진 1위 ${ranked[0]?.name}(${ranked[0]?.score.toFixed(2)}) vs 대조 ${offRanked[0]?.name}(${offRanked[0]?.score.toFixed(2)})`,
	);

	// ── 기준선 ────────────────────────────────────────────────
	//
	// **방향 검사만으로는 부족하다.** "화상이 축 1위"는 가중치를 몇 배로 흔들어도 참일 수 있다.
	// 실제로 INFLICT_COUNT 를 1.1 에서 5.0 으로 바꿔도 25건이 전부 통과하면서 3위 팩이 바뀌었다.
	//
	// 그래서 순위와 점수를 파일로 고정한다. 의도적으로 바꿀 때는 `-- --update` 로 갱신하며
	// 그 차이가 커밋 diff 에 드러나 리뷰 대상이 된다. 의도하지 않은 변화는 여기서 걸린다.
	console.log('');
	console.log('[기준선] 회귀 — 순위와 점수가 말없이 바뀌지 않는가');
	const snapshot = {
		deck: HWAJIN,
		floor: 3,
		difficulty: 'hard',
		ranked: ranked.map((r) => ({ packId: r.packId, score: Number(r.score.toFixed(3)) })),
		axis: ordered.slice(0, 3).map((o) => ({ key: o.k, avg: Number(o.a.toFixed(3)) })),
	};
	const baselinePath = fileURLToPath(new URL('./engine-golden.json', import.meta.url));

	if (process.argv.includes('--update')) {
		writeFileSync(baselinePath, JSON.stringify(snapshot, null, '\t') + '\n');
		console.log('  기준선을 갱신했다. diff 를 확인하고 커밋한다.');
	} else if (!existsSync(baselinePath)) {
		check('기준선 파일', false, '없다. `npm run engine:proof -- --update` 로 만든다');
	} else {
		const base = JSON.parse(readFileSync(baselinePath, 'utf8')) as typeof snapshot;
		if (JSON.stringify(base) === JSON.stringify(snapshot)) {
			check('순위·점수 기준선', true, `팩 ${base.ranked.length}종 · 축 ${base.axis.length}종 일치`);
		} else {
			const diffs: string[] = [];
			base.ranked.forEach((b, i) => {
				const now = snapshot.ranked[i];
				if (!now) diffs.push(`${i + 1}위 사라짐(${b.packId})`);
				else if (b.packId !== now.packId) diffs.push(`${i + 1}위 ${b.packId}→${now.packId}`);
				else if (b.score !== now.score) diffs.push(`${b.packId} ${b.score}→${now.score}`);
			});
			base.axis.forEach((b, i) => {
				const now = snapshot.axis[i];
				if (now && (b.key !== now.key || b.avg !== now.avg)) {
					diffs.push(`축${i + 1} ${b.key} ${b.avg}→${now.key} ${now.avg}`);
				}
			});
			check('순위·점수 기준선', false, diffs.slice(0, 4).join(' · ') || '구조가 달라졌다');
		}
	}

	console.log(`\n${failures === 0 ? '전부 통과' : `실패 ${failures}건`}`);
	await db.$disconnect();
	if (failures > 0) process.exit(1);
}

void main();
