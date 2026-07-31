/**
 * 부분 편성 덱. 빈 칸 표기(부재)를 렌더시키기 위한 것이다.
 *   0–3  인격 + E.G.O 전부
 *   4–7  인격만, E.G.O 자리는 비운다
 *   8–11 칸 자체가 빈 상태
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { readFileSync, writeFileSync } from 'node:fs';


const decks = JSON.parse(readFileSync(join(CACHE, 'deck.json'), 'utf8').replace(/^﻿/, ''));
const d = structuredClone(decks[0]);

d.id = 'shot-deck-partial';
d.name = '부분 편성';
d.slots = d.slots.map((s, i) => {
	if (i < 4) return s;
	if (i < 8) return { ...s, egos: {} };
	return { ...s, identityId: null, egos: {} };
});
d.deployed = [1, 2, 3];

writeFileSync(join(CACHE, 'deck-partial.json'), JSON.stringify([d]));
console.log('slots: ' + d.slots.map((s) => (s.identityId ? 'I' : '-') + Object.keys(s.egos).length).join(' '));
