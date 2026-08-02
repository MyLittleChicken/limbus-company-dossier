import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSinners, type SinnerInput } from './sinners.js';
import { Meta } from './meta.js';

function input(): SinnerInput {
	return {
		mjIdentities: new Map<string, Record<string, unknown>>([
			['10101', { id: 10101, sinnerId: 1, star: 1, name: 'Yi Sang', nameKo: '이상' }],
			['10102', { id: 10102, sinnerId: 1, star: 2, name: 'Blade Lineage', nameKo: '검계' }],
			['10301', { id: 10301, sinnerId: 3, star: 1, name: 'Don Quixote', nameKo: '돈키호테' }],
		]),
		associations: new Map<string, Record<string, unknown>>([
			['LIMBUS_COMPANY', { name: 'Limbus Company', nameKo: '림버스 컴퍼니' }],
			['ATL', { name: 'Technology Liberation Alliance', nameKo: '기술해방연합' }],
		]),
		unitKeywordJa: new Map<string, Record<string, unknown>>([
			['UnitKeyword_LIMBUS_COMPANY', { id: 'UnitKeyword_LIMBUS_COMPANY', content: 'リンバス' }],
		]),
	};
}

test('수감자가 star=1 인격에서 나온다', () => {
	const t = buildSinners(input(), new Meta());
	assert.deepEqual(t.sinner.map((s) => s.id), [1, 3]);
});

test('수감자 이름이 ko·en 으로 나온다 — 3 은 돈키호테다', () => {
	const t = buildSinners(input(), new Meta());
	const don = t.sinnerText.filter((s) => s.sinnerId === 3);
	assert.deepEqual(
		don.map((s) => [s.locale, s.name]).sort(),
		[
			['en', 'Don Quixote'],
			['ko', '돈키호테'],
		],
	);
});

test('star=1 인격이 없는 수감자는 결손으로 남는다', () => {
	const i = input();
	i.mjIdentities.set('10501', { id: 10501, sinnerId: 5, star: 3, name: 'X', nameKo: 'ㄱ' });
	const meta = new Meta();
	const t = buildSinners(i, meta);
	assert.ok(!t.sinner.some((s) => s.id === 5));
	assert.ok(meta.gaps.some((g) => g.entity === 'sinner' && g.entityId === '5'));
});

test('소속이 코드와 표시명으로 갈린다', () => {
	const t = buildSinners(input(), new Meta());
	assert.deepEqual(t.association.map((a) => a.id).sort(), ['ATL', 'LIMBUS_COMPANY']);
	const atl = t.associationText.filter((a) => a.associationId === 'ATL');
	assert.deepEqual(
		atl.map((a) => [a.locale, a.name]).sort(),
		[
			['en', 'Technology Liberation Alliance'],
			['ko', '기술해방연합'],
		],
	);
});

test('일본어 소속명은 UnitKeyword 계열에서 온다', () => {
	const t = buildSinners(input(), new Meta());
	const ja = t.associationText.find((a) => a.associationId === 'LIMBUS_COMPANY' && a.locale === 'ja');
	assert.equal(ja?.name, 'リンバス');
});

test('일본어가 없으면 행을 만들지 않고 결손으로 남긴다', () => {
	const meta = new Meta();
	const t = buildSinners(input(), meta);
	assert.ok(!t.associationText.some((a) => a.associationId === 'ATL' && a.locale === 'ja'));
	assert.ok(meta.gaps.some((g) => g.entity === 'association' && g.entityId === 'ATL' && g.locale === 'ja'));
});
