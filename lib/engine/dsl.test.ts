import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './dsl';
import type { EvalContext } from './state';

function ctx(deck: number, deployed: number): EvalContext {
	return {
		statusSupply: {},
		sinSupply: {},
		atkTypes: {},
		affiliation: { deck: { x: deck }, deployed: { x: deployed } },
	} as unknown as EvalContext;
}

test('출전 기준은 출전 인원만 본다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'deployed' } as const;
	assert.equal(evaluate(c, ctx(6, 2)).ratio, 2 / 3);
});

test('편성 기준은 편성 인원만 본다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'deck' } as const;
	assert.equal(evaluate(c, ctx(6, 2)).ratio, 1);
});

test('표지가 없으면 큰 쪽을 쓰는 근사를 유지한다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'unknown' } as const;
	assert.equal(evaluate(c, ctx(6, 2)).ratio, 1);
});

test('근거에 판정 범위가 드러난다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'deployed' } as const;
	assert.match(evaluate(c, ctx(6, 2)).evidence[0] ?? '', /출전/);
});
