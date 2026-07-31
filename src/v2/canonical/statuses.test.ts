import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatuses, type StatusInput } from './statuses.js';
import { Meta } from './meta.js';

function input(): StatusInput {
	return {
		assets: new Map<string, Record<string, unknown>>([
			['Sinking', { buffType: 'Negative', name: 'Sinking', desc: 'sink', srcPath: 'Sinking', categoryKeywordList: ['Gimmick'] }],
			['Orphan', { buffType: 'Neutral', name: 'Orphan' }],
		]),
		bufsKo: new Map<string, Record<string, unknown>>([
			['Sinking', { id: 'Sinking', name: '침잠(Bufs)', desc: '설명', summary: '요약' }],
		]),
		bufsEn: new Map<string, Record<string, unknown>>(),
		bufsJa: new Map<string, Record<string, unknown>>([
			['Sinking', { id: 'Sinking', name: '沈潜' }],
		]),
		bkKo: new Map<string, Record<string, unknown>>([
			['Sinking', { id: 'Sinking', name: '침잠(BK)' }],
			['Orphan', { id: 'Orphan', name: '고아(BK)' }],
		]),
		bkEn: new Map<string, Record<string, unknown>>(),
		bkJa: new Map<string, Record<string, unknown>>(),
		terms: new Map<string, Record<string, unknown>>([
			['Sinking', { name: 'Sinking', nameKo: '침잠(terms)' }],
			['AccelBullet', { name: 'Acceleration Round', nameKo: '가속탄' }],
		]),
		sins: new Map<string, Record<string, unknown>>([
			['wrath', { name: 'Wrath', nameKo: '분노', attribute: 'CRIMSON', order: 0 }],
		]),
	};
}

test('status 본체가 assets 에서 나온다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.deepEqual(t.status.map((s) => [s.id, s.buffType, s.sprite]).sort(), [
		['Orphan', 'Neutral', null],
		['Sinking', 'Negative', 'Sinking'],
	]);
});

test('한국어는 Bufs 가 이긴다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.equal(t.statusText.find((x) => x.statusId === 'Sinking' && x.locale === 'ko')?.name, '침잠(Bufs)');
});

test('Bufs 에 없으면 BattleKeywords 로 폴백한다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.equal(t.statusText.find((x) => x.statusId === 'Orphan' && x.locale === 'ko')?.name, '고아(BK)');
});

test('둘 다 없으면 terms.json 이 최종 폴백이다', () => {
	const i = input();
	i.bufsKo.clear();
	i.bkKo.delete('Sinking');
	const t = buildStatuses(i, new Meta());
	assert.equal(t.statusText.find((x) => x.statusId === 'Sinking' && x.locale === 'ko')?.name, '침잠(terms)');
});

test('영문은 assets name 이 정본이다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.equal(t.statusText.find((x) => x.statusId === 'Sinking' && x.locale === 'en')?.name, 'Sinking');
});

test('한국어를 어디서도 못 얻으면 행을 안 만들고 결손으로 남긴다', () => {
	const i = input();
	i.bufsKo.clear();
	i.bkKo.clear();
	i.terms.delete('Sinking');
	const meta = new Meta();
	const t = buildStatuses(i, meta);
	assert.equal(t.statusText.filter((x) => x.statusId === 'Sinking' && x.locale === 'ko').length, 0);
	assert.ok(meta.gaps.some((g) => g.entity === 'status' && g.entityId === 'Sinking' && g.locale === 'ko'));
});

test('분류가 행으로 펴진다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.deepEqual(t.statusCategory, [{ statusId: 'Sinking', category: 'Gimmick' }]);
});

test('죄악이 색 토큰과 함께 나온다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.deepEqual(t.sinInfo, [{ sin: 'wrath', attribute: 'CRIMSON', order: 0 }]);
	assert.deepEqual(
		t.sinText.map((s) => [s.locale, s.name]).sort(),
		[
			['en', 'Wrath'],
			['ko', '분노'],
		],
	);
});

test('치환 어휘가 전량 담긴다', () => {
	const t = buildStatuses(input(), new Meta());
	assert.deepEqual(t.term.map((x) => x.id).sort(), ['AccelBullet', 'Sinking']);
	assert.equal(t.termText.find((x) => x.termId === 'AccelBullet' && x.locale === 'ko')?.name, '가속탄');
});
