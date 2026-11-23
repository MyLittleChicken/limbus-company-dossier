import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripMedia } from './shape';

test('stripMedia 는 중첩된 image·icon 을 뺀다', () => {
	assert.deepEqual(stripMedia({ id: 1, image: 'x', skills: [{ icon: 'y', name: 'a' }] }), { id: 1, skills: [{ name: 'a' }] });
});

test('stripMedia 는 sprite·art·href 도 빼고 원시값·Date 는 그대로 둔다', () => {
	const at = new Date('2026-11-23T00:00:00Z');
	const input = { sprite: 's', art: { x: 1 }, href: '/ko/gifts/1', at, n: null, list: [1, 'a', { href: 'h', k: true }] };
	const out = stripMedia(input) as any;
	assert.deepEqual(Object.keys(out).sort(), ['at', 'list', 'n']);
	assert.equal(out.at, at);
	assert.deepEqual(out.list, [1, 'a', { k: true }]);
	assert.equal(stripMedia(7), 7);
	assert.equal(stripMedia('image'), 'image');
	assert.equal(input.href, '/ko/gifts/1');
});

test('stripMedia 는 plain object · 배열만 들어가고 Map 등은 그대로 통과시킨다', () => {
	const m = new Map([['k', { image: 'x' }]]);
	class Decimalish { constructor(public image: string) {} }
	const d = new Decimalish('keep');
	const buf = Buffer.from('ab');
	const bare = Object.assign(Object.create(null), { icon: 'i', name: 'n' });
	const out = stripMedia({ m, d, buf, bare }) as any;
	assert.equal(out.m, m);
	assert.equal(out.d, d);
	assert.equal(out.d.image, 'keep');
	assert.equal(out.buf, buf);
	assert.deepEqual({ ...out.bare }, { name: 'n' });
});

test('stripMedia 는 키 이름을 몰라도 애셋 경로 값을 뺀다', () => {
	assert.deepEqual(
		stripMedia({ id: 1, portrait: '/media/identity/10101.webp?v=1', banner: 'x/y.PNG', name: 'a.png 설명 아님 x' }),
		{ id: 1, name: 'a.png 설명 아님 x' },
	);
});

test('stripMedia 는 확장 애셋 키(rarityIcon · frame · bossIcon)를 뺀다', () => {
	assert.deepEqual(stripMedia({ id: 1, rarityIcon: 'r', frame: 'f', bossIcon: 'b', images: ['a'] }), { id: 1 });
});
