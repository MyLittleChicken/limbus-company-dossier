import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	axisSupplyOf, fitOf, fusionOf, liveOf, scorePack, tierOf, valueOf, type ScoreGift,
} from './score.js';
import { RANK_WEIGHTS, WEIGHT_SUM } from './weights.js';

/** 출격 7. 표본 후보 셋과 같은 자다 */
const FIELD = 7;

const SUPPLY = axisSupplyOf(
	[
		{ refKind: 'axis', refId: 'COMBUSTION', count: 7 },
		{ refKind: 'axis', refId: 'VIBRATION', count: 6 },
		{ refKind: 'axis', refId: 'BULLET', count: 3 },
		{ refKind: 'attack_type', refId: 'slash', count: 5 },
		{ refKind: 'attack_type', refId: 'blunt', count: 2 },
		// 어휘 밖 갈래가 섞여 온다. 죄악은 부여 어휘가 아니다(설계 §2.3)
		{ refKind: 'sin', refId: 'wrath', count: 9 },
		{ refKind: 'skill_kind', refId: 'attack', count: 8 },
	],
	FIELD,
);

test('공급은 axis 와 attack_type 두 갈래를 담고 출격 인원을 든다', () => {
	assert.equal(SUPPLY.max, 7);
	assert.equal(SUPPLY.counts.get('COMBUSTION'), 7);
	assert.equal(SUPPLY.counts.has('wrath'), false);
	assert.equal(SUPPLY.attackType.get('slash'), 5);
	assert.equal(SUPPLY.fieldSize, FIELD);
});

test('적합도의 분모는 출격 인원이다', () => {
	assert.equal(fitOf('Combustion', SUPPLY), 1);
	assert.equal(fitOf('Vibration', SUPPLY), 6 / 7);
});

test('축 어휘는 일곱뿐이다 — BULLET 같은 공급 갈래가 있어도 키워드 어휘 밖이면 0', () => {
	// 부여 어휘는 축 7 + 공격 타입 3 까지만 넓힌다(설계 §2.3). 공급 표에 다른
	// 갈래가 있어도 기프트 키워드가 그 말을 안 쓰면 잴 것이 없다
	assert.equal(fitOf('Bullet', SUPPLY), 0);
});

/**
 * **최댓값 정규화면 회귀다**(설계 §4.3). 공급이 평평한 덱에서 최댓값으로 나누면
 * 한 명짜리 축도 1.0 이 된다 — 방향미정 덱이 `w_등급` 을 정하는 유일한 덱이라
 * 저울추가 통째로 어긋났던 실측이 있다.
 */
test('공급이 평평해도 적합도는 안 부푼다 — 최댓값 정규화 회귀 검사', () => {
	const flat = axisSupplyOf(
		[
			{ refKind: 'axis', refId: 'COMBUSTION', count: 1 },
			{ refKind: 'axis', refId: 'SINKING', count: 1 },
		],
		FIELD,
	);
	assert.equal(fitOf('Combustion', flat), 1 / 7); // 최댓값 정규화였다면 1.0
});

test('공격 타입도 잰다 — 키워드 말과 공급 표 말이 다르다 (Hit → blunt)', () => {
	assert.equal(fitOf('Slash', SUPPLY), 5 / 7);
	assert.equal(fitOf('Hit', SUPPLY), 2 / 7);
	assert.equal(fitOf('Penetrate', SUPPLY), 0); // pierce 공급이 없다
});

test('어휘 밖 키워드는 0 이다 — 범용이고, 등급 항이 값을 낸다', () => {
	assert.equal(fitOf('None', SUPPLY), 0);
	assert.equal(fitOf('Random', SUPPLY), 0);
	assert.equal(fitOf(null, SUPPLY), 0);
});

test('덱에 없는 축은 0 이다', () => {
	assert.equal(fitOf('Sinking', SUPPLY), 0);
});

test('출격이 없으면 적합도가 전부 0 이다 — 나누기 0 을 안 만든다', () => {
	const empty = axisSupplyOf([{ refKind: 'axis', refId: 'COMBUSTION', count: 7 }], 0);
	assert.equal(fitOf('Combustion', empty), 0);
});

test('등급은 0~1 로 편다 · EX(null)는 1.0 이다', () => {
	assert.equal(tierOf(1), 0);
	assert.equal(tierOf(3), 0.5);
	assert.equal(tierOf(5), 1);
	assert.equal(tierOf(null), 1);
});

/** 저울추 합은 항 셋의 합이다 — 값을 0~1 로 펴는 분모 */
test('WEIGHT_SUM 은 항 셋의 합이다', () => {
	assert.equal(WEIGHT_SUM, RANK_WEIGHTS.fit + RANK_WEIGHTS.tier + RANK_WEIGHTS.exclusive);
});

/**
 * **값은 곱이 아니라 합이다**(설계 §2.4). 사용자 제약이 이 모양을 강제한다 —
 * 「달의 기억(5등급 · 범용)이 화상 2등급 전용보다 위일 수 있다」. 곱이면
 * 적합도 0 에서 등급이 무엇이든 0 이라 원리적으로 불가능하다.
 */
test('값은 합이다 — 적합도 0 인 5등급 범용이 축 일치 2등급을 이길 수 있다', () => {
	const moon = valueOf({ keywordId: null, tier: 5, exclusive: false }, SUPPLY);
	const burn2 = valueOf({ keywordId: 'Combustion', tier: 2, exclusive: false }, SUPPLY);
	assert.ok(moon > 0); // 곱이었다면 0 이다
	assert.ok(moon > burn2);
});

test('전용은 fit 에 곱하지 않고 따로 뗀다 — 키워드 없는 전용도 전용이 보인다', () => {
	const a = valueOf({ keywordId: null, tier: 1, exclusive: true }, SUPPLY);
	const b = valueOf({ keywordId: null, tier: 1, exclusive: false }, SUPPLY);
	assert.ok(a > b); // 옛 모형(fit × 전용)에서는 둘 다 0 이었다
	assert.equal(a, RANK_WEIGHTS.exclusive / WEIGHT_SUM);
});

test('값은 저울추대로 섞이고 0~1 로 펴진다', () => {
	const v = valueOf({ keywordId: 'Vibration', tier: 3, exclusive: true }, SUPPLY);
	const raw = RANK_WEIGHTS.fit * (6 / 7) + RANK_WEIGHTS.tier * 0.5 + RANK_WEIGHTS.exclusive * 1;
	assert.equal(v, raw / WEIGHT_SUM);
	assert.ok(v > 0 && v <= 1);
});

const gift = (over: Partial<ScoreGift> = {}): ScoreGift => ({
	keywordId: null,
	// 1등급이 기본이다 — tierOf(1) = 0 이라 검사의 산수가 항으로 안 흐려진다
	tier: 1,
	total: 0,
	satisfied: 0,
	reasons: [],
	chainDepth: null,
	owned: false,
	fireable: true,
	exclusive: false,
	...over,
});

/** 검사가 기대값을 코드와 같은 식으로 셈한다 */
const valueExpr = (fit: number, tier: number, exclusive: boolean): number =>
	(RANK_WEIGHTS.fit * fit + RANK_WEIGHTS.tier * tier + RANK_WEIGHTS.exclusive * (exclusive ? 1 : 0)) /
	WEIGHT_SUM;

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

test('팩의 fit 은 후보 값의 평균이고 켜짐은 효과 비율이다', () => {
	const s = scorePack(
		[
			// 화상 7/7 · 전용 · 효과 2개 다 확정 충족
			gift({
				keywordId: 'Combustion',
				total: 2,
				satisfied: 2,
				reasons: [
					{ verdict: 'satisfied', certainty: 'certain' },
					{ verdict: 'satisfied', certainty: 'certain' },
				],
				exclusive: true,
			}),
			// 범용 1등급 · 효과 2개 중 하나도 안 켜짐 — 값이 0 이다
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
	assert.equal(s.fit, (valueExpr(1, 0, true) + valueExpr(0, 0, false)) / 2);
	assert.equal(s.live, 0.5); // 2 / 4
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
	const s = scorePack([gift({ keywordId: 'Combustion', total: 0, exclusive: true })], SUPPLY);
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, valueExpr(1, 0, true));
	assert.equal(s.live, 0);
	assert.equal(s.score, 0);
});

/**
 * 옛 조건(축 공급 없음 → 순위 불가)은 값 모형에서 죽는다. 등급·전용 항이 축
 * 없이도 순서를 만들고, 그 순서는 표본이 검증했다 — 방향미정 덱(모든 축이
 * 1~2명)이 `w_등급` 을 정한 유일한 덱이다.
 */
test('축 공급이 없어도 출격이 있으면 순위를 매긴다 — 등급이 순서를 만든다', () => {
	const noAxis = axisSupplyOf([{ refKind: 'sin', refId: 'wrath', count: 7 }], FIELD);
	const four = gift({ keywordId: 'None', tier: 4, total: 1, satisfied: 1, reasons: [{ verdict: 'satisfied', certainty: 'certain' }] });
	const one = gift({ keywordId: 'None', tier: 1, total: 1, satisfied: 1, reasons: [{ verdict: 'satisfied', certainty: 'certain' }] });
	const hi = scorePack([four], noAxis);
	const lo = scorePack([one], noAxis);
	assert.equal(hi.rankable, true);
	assert.ok(hi.score > lo.score);
});

test('출격이 없으면 순위를 매길 수 없다', () => {
	const empty = axisSupplyOf([], 0);
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
		exclusive: true,
	});
	const s = scorePack([dead, alive], SUPPLY);
	// 후보는 살아있는 하나뿐이다
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, valueExpr(6 / 7, 0, true));
	assert.equal(s.live, 1);
});

test('전부 켜질 수 없으면 점수가 0 이다', () => {
	const s = scorePack([gift({ keywordId: 'Combustion', total: 1, fireable: false })], SUPPLY);
	assert.equal(s.candidates, 0);
	assert.equal(s.score, 0);
});

test('합성 항은 도달과 결과물 적합도의 곱이다', () => {
	const recipes = [{ giftId: 'R', slots: [['a'], ['b']] }];
	// 결과물 R 은 화상이라 fit 1.0
	const resultFit = new Map([['R', 1]]);
	// 이 팩에 a 가 있고 보유에 b 가 있다 → 완성
	const c = fusionOf({
		recipes,
		resultFit,
		have: new Set(['a', 'b']),
		owned: new Set<string>(),
		candidates: 2,
	});
	assert.equal(c, 0.5); // (1.0 도달 × 1.0 fit) / 후보 2
});

test('절반만 모이면 절반만 친다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 1]]),
		have: new Set(['a']),
		owned: new Set<string>(),
		candidates: 1,
	});
	assert.equal(c, 0.5);
});

test('이미 보유한 결과물은 안 센다 — 다시 만들 이유가 없다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 1]]),
		have: new Set(['a', 'b']),
		owned: new Set(['R']),
		candidates: 1,
	});
	assert.equal(c, 0);
});

test('결과물이 덱과 안 맞으면 도달해도 작다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 0]]),
		have: new Set(['a', 'b']),
		owned: new Set<string>(),
		candidates: 1,
	});
	assert.equal(c, 0);
});

test('후보가 0 이면 0 이다 — 나누기 0 을 안 만든다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 1]]),
		have: new Set(['a', 'b']),
		owned: new Set<string>(),
		candidates: 0,
	});
	assert.equal(c, 0);
});

test('점수는 (값 + 합성) × 켜짐이다', () => {
	const g = gift({
		keywordId: 'Combustion',
		total: 2,
		satisfied: 1,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'possible' },
		],
		exclusive: true,
	});
	const s = scorePack([g], SUPPLY, 0.25);
	const v = valueExpr(1, 0, true);
	assert.equal(s.fit, v);
	assert.equal(s.live, 0.5);
	assert.equal(s.fusion, 0.25);
	assert.equal(s.score, (v + 0.25) * 0.5);
});
