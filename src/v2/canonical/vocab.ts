/**
 * 어휘 차원. 스펙 6절 「그래프 파생을 위한 조건」의 구현이다.
 *
 * 원본이 이미 유한 집합이므로 문자열로 두지 않고 차원 테이블 + 연결 테이블로 담는다.
 * 그러면 Neo4j 투영이 덤프 한 번이 된다 — 재파싱도 재해석도 없다.
 *
 *   키워드   loc EgoGiftCategory.json 12종이 공식 사전
 *   트리거   assets triggers 150종
 *   효과     assets effects 55종
 */
import { arr, str, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const LOC = 'loc-ko/en/ja';
const ASSETS = 'limbus-assets';
const EVIDENCE = 'docs/data/gift/07-loc-egogift-common.md';

export interface VocabInput {
	categoryKo: RawIndex;
	categoryEn: RawIndex;
	categoryJa: RawIndex;
	assets: RawIndex;
}

export interface KeywordRow {
	id: string;
}

export interface KeywordTextRow {
	keywordId: string;
	locale: 'ko' | 'en' | 'ja';
	name: string;
}

export interface TriggerRow {
	id: string;
}

export interface EffectRow {
	id: string;
}

export interface VocabTables {
	keyword: KeywordRow[];
	keywordText: KeywordTextRow[];
	trigger: TriggerRow[];
	effect: EffectRow[];
}

/** 소문자 영문 표시명 → 사전 id. assets·mj 의 keyword 값이 영문명이라 필요하다. */
export function buildKeywordLookup(categoryEn: RawIndex): Map<string, string> {
	const m = new Map<string, string>();
	for (const [id, o] of categoryEn) {
		const name = str(o, 'name');
		if (name !== null) m.set(name.toLowerCase(), id);
	}
	return m;
}

/**
 * 영문 키워드명을 사전 id 로 바꾼다.
 *
 * **null 은 「없음」이 아니라 「범용」이다**(마스터북 기프트 편 회차 7). 게임이
 * 그렇게 부르며 사전에 `None` 항목이 따로 있다. mj 의 null 109건과 assets 의
 * "Keywordless" 109건이 정확히 대응한다.
 */
export function keywordIdOf(en: string | null, dict: Map<string, string>): string | null {
	if (en === null) return dict.get('keywordless') ?? 'None';
	return dict.get(en.toLowerCase()) ?? null;
}

export function buildVocab(input: VocabInput, meta: Meta): VocabTables {
	const keyword: KeywordRow[] = [];
	const keywordText: KeywordTextRow[] = [];

	for (const id of [...input.categoryEn.keys()].sort()) {
		keyword.push({ id });
		for (const [locale, index] of [
			['ko', input.categoryKo],
			['en', input.categoryEn],
			['ja', input.categoryJa],
		] as const) {
			const name = str(index.get(id) ?? {}, 'name');
			if (name === null) {
				meta.gap('keyword', id, 'name', `${locale} 표시명이 사전에 없다`, EVIDENCE, locale);
				continue;
			}
			keywordText.push({ keywordId: id, locale, name });
		}
		meta.source('keyword', id, 'name', 'loc-only', [LOC]);
	}

	const triggers = new Set<string>();
	const effects = new Set<string>();
	for (const g of input.assets.values()) {
		for (const t of arr(g, 'triggers')) if (typeof t === 'string') triggers.add(t);
		for (const e of arr(g, 'effects')) if (typeof e === 'string') effects.add(e);
	}
	for (const id of triggers) meta.source('trigger', id, 'id', 'assets-only', [ASSETS]);
	for (const id of effects) meta.source('effect', id, 'id', 'assets-only', [ASSETS]);

	return {
		keyword,
		keywordText,
		trigger: [...triggers].sort().map((id) => ({ id })),
		effect: [...effects].sort().map((id) => ({ id })),
	};
}
