import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusKeyOf } from './load';

test('기존 축은 그대로 잡힌다', () => {
	assert.equal(statusKeyOf('Combustion'), 'burn');
	assert.equal(statusKeyOf('Laceration'), 'bleed');
	assert.equal(statusKeyOf('Breath'), 'poise');
});

test('탄환을 잡는다', () => {
	// 실측(backlog/04 3절): Bullet(탄환) 이 기본형이고 13명이 공급한다.
	assert.equal(statusKeyOf('Bullet'), 'ammo');
	// 파생도 같은 자원이다 — 호표탄·맹호표탄·가속탄·탄환-고독·산나비·죽은나비.
	assert.equal(statusKeyOf('BulletPropellant'), 'ammo');
	assert.equal(statusKeyOf('BulletPropellantSpecial'), 'ammo');
	assert.equal(statusKeyOf('AccelBullet'), 'ammo');
	assert.equal(statusKeyOf('BulletGodok'), 'ammo');
	assert.equal(statusKeyOf('BulletLament'), 'ammo');
});

test('보호를 잡는다', () => {
	// 실측(backlog/04 4절): Protection(보호) 이 기본형이고 15명이 공급한다.
	assert.equal(statusKeyOf('Protection'), 'protection');
	// 파열 보호(BurstProtection) 도 같은 자원이다 — 이름이 rupture 축 패턴(burst)과 겹치므로
	// STATUS_MATCH 의 판정 순서가 보호를 먼저 잡아야 한다.
	assert.equal(statusKeyOf('BurstProtection'), 'protection');
});

test('탄환·보호와 이름이 비슷해도 다른 기믹은 잡히지 않는다', () => {
	// 탄환 계열 이름을 쓰지만 다른 인격의 별개 기믹이다(backlog/04 대상 밖).
	assert.equal(statusKeyOf('BulletPropellantAlly'), null);
	assert.equal(statusKeyOf('MeursaultSporeBulletLong'), null);
	assert.equal(statusKeyOf('FreishutzOutisEgoBullet_1st'), null);
	// 보호 계열 이름을 쓰지만 다른 기믹이다.
	assert.equal(statusKeyOf('ProtectStance'), null);
	assert.equal(statusKeyOf('SupportProtect'), null);
	assert.equal(statusKeyOf('ShieldManagerCryingToad'), null);
});

test('축에 없는 상태는 null', () => {
	assert.equal(statusKeyOf('Paralysis'), null);
});
