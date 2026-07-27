/**
 * 슬라이스 증명.
 *
 * 각 슬라이스가 무엇을 주장하고 무엇으로 그것을 보이는지 여기 모은다.
 * **통과가 아니라 수치를 낸다.** "됐다"가 아니라 "몇 건 중 몇 건"이어야 다음 사람이 판단할 수 있다.
 *
 *   실행: npm run engine:proof
 */
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

	// ── 슬라이스 0 — 어휘 사전이 원본을 덮는가 ────────────────
	console.log('\n[슬라이스 0] 어휘 — 원본 토큰을 빠짐없이 옮기는가');
	const tokens = await db.giftToken.findMany({ select: { kind: true, token: true } });
	const cov = checkCoverage(
		tokens.filter((t) => t.kind === 'effect').map((t) => t.token),
		tokens.filter((t) => t.kind === 'trigger').map((t) => t.token),
		affiliations,
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

	console.log(`\n${failures === 0 ? '전부 통과' : `실패 ${failures}건`}`);
	await db.$disconnect();
	if (failures > 0) process.exit(1);
}

void main();
