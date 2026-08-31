/**
 * 편성 12인 짜기 — 「수감자 하나당 인격 하나」가 이 태스크의 전부다.
 *
 * v1 은 이 규칙을 빠뜨려 이상이 12명보다 많은 편성을 냈다. 그 결함을 다시
 * 재현하지 않으려면 고정물부터 「한 수감자에 인격이 여럿」이어야 한다 —
 * 그렇지 않으면 규칙이 우연히 통과한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSquad, labelOf } from './squad.js';
import type { Identity } from './squad.js';

/**
 * 수감자 넷 × 인격 하나~셋.
 *
 * s1 은 셋, s2 는 둘을 둔다 — 「수감자 안에서 가장 센 인격을 고른다」와
 * 「수감자 밖에서는 최댓값끼리 겨룬다」를 한 못으로 함께 검사하려면 한
 * 수감자만으로는 모자라다.
 */
function makePool(): Identity[] {
	return [
		{ id: 'i101', sinnerId: 's1', name: '이상', title: '검계\n살수' },
		{ id: 'i102', sinnerId: 's1', name: '이상', title: '나부낀\n그림자' },
		{ id: 'i103', sinnerId: 's1', name: '이상', title: '숨은\n칼날' },
		{ id: 'i201', sinnerId: 's2', name: '뫼르소', title: '검계\n우두머리' },
		{ id: 'i202', sinnerId: 's2', name: '뫼르소', title: '흐린\n오후' },
		{ id: 'i301', sinnerId: 's3', name: '파우스트', title: '이드\n모형' },
		{ id: 'i401', sinnerId: 's4', name: '돈키호테', title: '길 잃은\n기사' },
	];
}

/**
 * s1 최댓값은 i102(7), s2 최댓값은 i201(5), s4 는 4, s3 는 0 —
 * 「prefer 가 0 이어도 메운다」를 검사하려고 s3 를 일부러 0 으로 둔다.
 */
const PREFER: Record<string, number> = {
	i101: 3, i102: 7, i103: 1,
	i201: 5, i202: 2,
	i301: 0,
	i401: 4,
};
const prefer = (id: string): number => PREFER[id] ?? 0;

test('같은 수감자를 두 번 안 넣는다 — 편성의 존재 이유다', () => {
	const squad = buildSquad(makePool(), prefer);
	const sinnerIds = squad.map((i) => i.sinnerId);
	assert.equal(new Set(sinnerIds).size, sinnerIds.length, `중복: ${sinnerIds.join(' ')}`);
});

test('prefer 가 큰 인격을 먼저 집는다 — 수감자 안에서도, 수감자끼리도', () => {
	const squad = buildSquad(makePool(), prefer);
	const bySinner = new Map(squad.map((i) => [i.sinnerId, i.id]));
	// 수감자 안: 각 수감자에서 prefer 최댓값 인격이 뽑혔는가
	assert.equal(bySinner.get('s1'), 'i102', 's1 은 prefer 최댓값 i102 여야 한다');
	assert.equal(bySinner.get('s2'), 'i201', 's2 는 prefer 최댓값 i201 이어야 한다');
	// 수감자끼리: prefer 최댓값이 큰 수감자부터 순서대로 나왔는가(7·5·4·0)
	assert.deepEqual(squad.map((i) => i.sinnerId), ['s1', 's2', 's4', 's3']);
});

test('size 가 안 차면 남은 수감자로 메운다 — prefer 가 0 이어도 메운다', () => {
	// 못은 수감자 넷뿐이라 size 를 10 으로 둬도 넷만 나온다. prefer 0 인 s3 가
	// 빠지면 「자리 채우기가 먼저다」가 안 지켜진 것이다
	const squad = buildSquad(makePool(), prefer, 10);
	assert.equal(squad.length, 4, '수감자 넷을 다 채워야 한다');
	assert.ok(squad.some((i) => i.sinnerId === 's3'), 'prefer 0 인 s3 가 빠졌다');
});

test('못이 12수감자보다 작으면 있는 만큼만 낸다', () => {
	const squad = buildSquad(makePool(), prefer); // size 기본값 12, 못은 수감자 넷뿐
	assert.equal(squad.length, 4);
});

test('동점이면 id 오름차순으로 집는다', () => {
	const pool: Identity[] = [
		{ id: 'z9', sinnerId: 'sa', name: '가', title: '갑' },
		{ id: 'a1', sinnerId: 'sb', name: '나', title: '을' },
	];
	const squad = buildSquad(pool, () => 5, 1);
	assert.equal(squad.length, 1);
	assert.equal(squad[0]?.id, 'a1', 'id 가 작은 쪽을 집어야 한다');
});

test('같은 입력이면 같은 답이 나온다 — 무작위가 아니다', () => {
	const a = buildSquad(makePool(), prefer).map((i) => i.id);
	const b = buildSquad(makePool(), prefer).map((i) => i.id);
	assert.deepEqual(a, b);
});

test('labelOf 가 title 의 줄바꿈을 공백으로 바꾼다', () => {
	const i: Identity = { id: 'i101', sinnerId: 's1', name: '이상', title: '검계\n살수' };
	assert.equal(labelOf(i), '검계 살수 이상');
});
