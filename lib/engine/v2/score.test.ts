import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisSupplyOf, fitOf, liveOf, scorePack, type ScoreGift } from './score.js';

const SUPPLY = axisSupplyOf([
	{ refKind: 'axis', refId: 'COMBUSTION', count: 7 },
	{ refKind: 'axis', refId: 'VIBRATION', count: 6 },
	{ refKind: 'axis', refId: 'BULLET', count: 3 },
	// 축이 아닌 갈래가 섞여 온다. 분모를 여기서 가져오면 축의 차이가 뭉개진다.
	// **일부러 축 최댓값(7)보다 크게 둔다.** 값이 축과 같으면(예: 7) 분모를
	// `axis` 밖에서 잘못 가져와도 fitOf 검사가 우연히 안 깨진다 — 여기서
	// 크게 두면 배선이 틀리는 순간 `fitOf('Combustion')` 이 1 을 벗어난다
	{ refKind: 'sin', refId: 'wrath', count: 9 },
	{ refKind: 'skill_kind', refId: 'attack', count: 8 },
]);

test('축 공급은 axis 갈래만 본다', () => {
	assert.equal(SUPPLY.max, 7);
	assert.equal(SUPPLY.counts.get('COMBUSTION'), 7);
	assert.equal(SUPPLY.counts.has('wrath'), false);
});

test('적합도는 최대 축 공급으로 나눈 값이다', () => {
	assert.equal(fitOf('Combustion', SUPPLY), 1);
	assert.equal(fitOf('Vibration', SUPPLY), 6 / 7);
	assert.equal(fitOf('Bullet', SUPPLY), 3 / 7);
});

test('덱에 없는 축은 0 이다', () => {
	assert.equal(fitOf('Sinking', SUPPLY), 0);
});

test('축이 아닌 키워드는 0 이다 — 공격 타입 3종과 범용이 키워드 표에 섞여 있다', () => {
	assert.equal(fitOf('None', SUPPLY), 0);
	assert.equal(fitOf('Slash', SUPPLY), 0);
	assert.equal(fitOf('Penetrate', SUPPLY), 0);
	assert.equal(fitOf(null, SUPPLY), 0);
});

test('축 공급이 없는 덱은 적합도가 전부 0 이다 — 나누기 0 을 안 만든다', () => {
	const empty = axisSupplyOf([{ refKind: 'sin', refId: 'wrath', count: 7 }]);
	assert.equal(empty.max, 0);
	assert.equal(fitOf('Combustion', empty), 0);
});

const gift = (over: Partial<ScoreGift> = {}): ScoreGift => ({
	keywordId: null,
	total: 0,
	satisfied: 0,
	reasons: [],
	chainDepth: null,
	owned: false,
	fireable: true,
	...over,
});

test('확정은 1.0 · 가능은 0.5', () => {
	const g = gift({
		total: 2,
		satisfied: 2,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'satisfied', certainty: 'possible' },
		],
	});
	assert.equal(liveOf(g), 1.5);
});

test('미충족과 판정불가는 안 센다', () => {
	const g = gift({
		total: 3,
		satisfied: 1,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'certain' },
			{ verdict: 'unknown', certainty: 'possible' },
		],
	});
	assert.equal(liveOf(g), 1);
});

test('연쇄 1홉은 1.0 · 2홉은 0.5 를 더한다', () => {
	const base = { total: 2, satisfied: 0, reasons: [] };
	assert.equal(liveOf(gift({ ...base, chainDepth: 1 })), 1);
	assert.equal(liveOf(gift({ ...base, chainDepth: 2 })), 0.5);
	assert.equal(liveOf(gift({ ...base, chainDepth: null })), 0);
});

test('연쇄는 미충족 효과 수를 넘지 않는다 — L 이 1 을 넘으면 안 된다', () => {
	// 효과 하나가 이미 확정 충족이다. 켤 것이 남아 있지 않으므로 연쇄가 0 이다
	const g = gift({
		total: 1,
		satisfied: 1,
		reasons: [{ verdict: 'satisfied', certainty: 'certain' }],
		chainDepth: 1,
	});
	assert.equal(liveOf(g), 1);
});

test('적합도는 후보의 평균이고 켜짐은 효과 비율이다', () => {
	const s = scorePack(
		[
			// 화상 · 효과 2개 다 확정 충족
			gift({
				keywordId: 'Combustion',
				total: 2,
				satisfied: 2,
				reasons: [
					{ verdict: 'satisfied', certainty: 'certain' },
					{ verdict: 'satisfied', certainty: 'certain' },
				],
			}),
			// 범용 · 효과 2개 중 하나도 안 켜짐
			gift({
				keywordId: 'None',
				total: 2,
				satisfied: 0,
				reasons: [
					{ verdict: 'unsatisfied', certainty: 'certain' },
					{ verdict: 'unsatisfied', certainty: 'certain' },
				],
			}),
		],
		SUPPLY,
	);
	assert.equal(s.candidates, 2);
	assert.equal(s.fit, 0.5); // (1 + 0) / 2
	assert.equal(s.live, 0.5); // 2 / 4
	assert.equal(s.score, 0.25);
	assert.equal(s.rankable, true);
});

test('보유한 기프트는 후보에서 뺀다 — 다시 얻을 수 없다', () => {
	const owned = gift({
		keywordId: 'Combustion',
		total: 2,
		satisfied: 2,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'satisfied', certainty: 'certain' },
		],
		owned: true,
	});
	const fresh = gift({
		keywordId: 'None',
		total: 2,
		satisfied: 0,
		reasons: [
			{ verdict: 'unsatisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'certain' },
		],
	});
	const s = scorePack([owned, fresh], SUPPLY);
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, 0);
	assert.equal(s.live, 0);
});

test('후보가 0 이면 점수가 0 이다 — 나누기 0 을 안 만든다', () => {
	const s = scorePack([gift({ owned: true })], SUPPLY);
	assert.equal(s.candidates, 0);
	assert.equal(s.fit, 0);
	assert.equal(s.live, 0);
	assert.equal(s.score, 0);
});

test('효과가 하나도 없는 팩은 켜짐이 0 이다 — 0 으로 세지 않고 분모에서 뺀다', () => {
	const s = scorePack([gift({ keywordId: 'Combustion', total: 0 })], SUPPLY);
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, 1);
	assert.equal(s.live, 0);
	assert.equal(s.score, 0);
});

test('축 공급이 없는 덱은 순위를 매길 수 없다', () => {
	const empty = axisSupplyOf([{ refKind: 'sin', refId: 'wrath', count: 7 }]);
	const s = scorePack([gift({ keywordId: 'Combustion', total: 1, satisfied: 1, reasons: [{ verdict: 'satisfied', certainty: 'certain' }] })], empty);
	assert.equal(s.rankable, false);
	assert.equal(s.score, 0);
});

test('켜짐은 1 을 안 넘는다 — 연쇄가 붙어도', () => {
	const s = scorePack(
		[
			gift({
				keywordId: 'Combustion',
				total: 1,
				satisfied: 1,
				reasons: [{ verdict: 'satisfied', certainty: 'certain' }],
				chainDepth: 1,
			}),
		],
		SUPPLY,
	);
	assert.equal(s.live, 1);
});

test('켜질 수 없는 기프트는 후보에서 빠진다', () => {
	const dead = gift({
		keywordId: 'Combustion',
		total: 2,
		satisfied: 1,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'certain' },
		],
		fireable: false,
	});
	const alive = gift({
		keywordId: 'Vibration',
		total: 1,
		satisfied: 1,
		reasons: [{ verdict: 'satisfied', certainty: 'certain' }],
	});
	const s = scorePack([dead, alive], SUPPLY);
	// 후보는 살아있는 하나뿐이다
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, 6 / 7);
	assert.equal(s.live, 1);
});

test('전부 켜질 수 없으면 점수가 0 이다', () => {
	const s = scorePack([gift({ keywordId: 'Combustion', total: 1, fireable: false })], SUPPLY);
	assert.equal(s.candidates, 0);
	assert.equal(s.score, 0);
});
