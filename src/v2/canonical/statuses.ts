/**
 * 전투 상태 1,472종 · 죄악 7종 · 치환 어휘 483종.
 *
 * **한국어가 245종(16.6 %) 없다.** 세 출처를 합쳐도 못 얻는다 — 마스터북 상태 편
 * 회차 3의 실측과 같다. 행을 만들지 않고 `field_gap` 에 남긴다. 소비 측이
 * 폴백을 판정할 수 있어야 한다(ADR-03 5절).
 *
 * 로케일 두 파일이 겹치지만 **목적이 다르다** — `Bufs` 가 런타임 원형,
 * `BattleKeywords` 가 표시용이다(마스터북 판정). `Bufs` 를 우선하고
 * `BattleKeywords` · `terms.json` 순으로 폴백한다.
 */
import { arr, num, str, type RawIndex } from '../source.js';
import { descOf } from './markup.js';
import type { Meta } from './meta.js';

const ASSETS = 'limbus-assets';
const MJ = 'limbus-data-mj';
const LOC = 'loc-ko/en/ja';
const EVIDENCE = 'docs/data/status/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

export interface StatusInput {
	assets: RawIndex;
	bufsKo: RawIndex;
	bufsEn: RawIndex;
	bufsJa: RawIndex;
	bkKo: RawIndex;
	bkEn: RawIndex;
	bkJa: RawIndex;
	/**
	 * `mirror-dungeon/loc-*` 의 `Bufs_Mirror*` · `BattleKeywords_Mirror*` 를 합친 것.
	 *
	 * **거울 던전 상태는 `mechanics/loc-*` 에 없다.** MD*Limit(역경) · MDHM* · MD5* 등
	 * 245종의 한국어가 「어느 출처에도 없다」로 기록돼 있었는데 이 파일들을 안 읽은
	 * 탓이다. 같은 id 가 양쪽에 있으면 mechanics 가 이긴다 — 거울 던전 판본이
	 * 임시 표기를 담는 경우가 있다.
	 */
	mirrorKo: RawIndex;
	mirrorEn: RawIndex;
	mirrorJa: RawIndex;
	terms: RawIndex;
	sins: RawIndex;
}

export interface StatusRow {
	id: string;
	buffType: string;
	sprite: string | null;
}

export interface StatusTextRow {
	statusId: string;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
	summary: string | null;
}

export interface StatusCategoryRow {
	statusId: string;
	category: string;
}

export interface SinInfoRow {
	sin: string;
	attribute: string;
	order: number;
}

export interface SinTextRow {
	sin: string;
	locale: Loc;
	name: string;
}

export interface TermRow {
	id: string;
}

export interface TermTextRow {
	termId: string;
	locale: Loc;
	name: string;
}

export interface StatusTables {
	status: StatusRow[];
	statusText: StatusTextRow[];
	statusCategory: StatusCategoryRow[];
	sinInfo: SinInfoRow[];
	sinText: SinTextRow[];
	term: TermRow[];
	termText: TermTextRow[];
}

export function buildStatuses(input: StatusInput, meta: Meta): StatusTables {
	const t: StatusTables = {
		status: [],
		statusText: [],
		statusCategory: [],
		sinInfo: [],
		sinText: [],
		term: [],
		termText: [],
	};

	const bufs: Record<Loc, RawIndex> = { ko: input.bufsKo, en: input.bufsEn, ja: input.bufsJa };
	const bk: Record<Loc, RawIndex> = { ko: input.bkKo, en: input.bkEn, ja: input.bkJa };
	const md: Record<Loc, RawIndex> = { ko: input.mirrorKo, en: input.mirrorEn, ja: input.mirrorJa };

	for (const [id, a] of input.assets) {
		const buffType = str(a, 'buffType');
		if (buffType === null) {
			meta.gap('status', id, 'buffType', 'buffType 이 없다', EVIDENCE);
			continue;
		}
		t.status.push({ id, buffType, sprite: str(a, 'srcPath') });
		meta.source('status', id, 'core', 'assets-only', [ASSETS]);

		for (const category of arr(a, 'categoryKeywordList')) {
			if (typeof category === 'string') t.statusCategory.push({ statusId: id, category });
		}

		for (const locale of LOCALES) {
			// mechanics Bufs → mechanics BattleKeywords → mirror-dungeon(Bufs·BK 합본)
			//   → (ko·en 만) terms.json → (en 만) assets name
			const b = bufs[locale].get(id) ?? {};
			const k = bk[locale].get(id) ?? {};
			const m = md[locale].get(id) ?? {};
			const termName =
				locale === 'ko' ? str(input.terms.get(id) ?? {}, 'nameKo')
				: locale === 'en' ? str(input.terms.get(id) ?? {}, 'name')
				: null;
			const assetsName = locale === 'en' ? str(a, 'name') : null;
			const name = str(b, 'name') ?? str(k, 'name') ?? str(m, 'name') ?? termName ?? assetsName;
			if (name === null) {
				meta.gap(
					'status',
					id,
					'name',
					`${locale} 표시명이 어느 출처에도 없다 (Bufs · BattleKeywords · 거울 던전 · terms 전부)`,
					EVIDENCE,
					locale,
				);
				continue;
			}
			t.statusText.push({
				statusId: id,
				locale,
				name,
				...descOf(
					str(b, 'desc') ?? str(k, 'desc') ?? str(m, 'desc')
					?? (locale === 'en' ? str(a, 'desc') : null),
				),
				summary: str(b, 'summary') ?? str(k, 'summary') ?? str(m, 'summary'),
			});
		}
	}

	// ── 죄악 7종 ─────────────────────────────────────────────────
	for (const [sin, o] of input.sins) {
		const attribute = str(o, 'attribute');
		const order = num(o, 'order');
		if (attribute === null || order === null) continue;
		t.sinInfo.push({ sin, attribute, order });
		const ko = str(o, 'nameKo');
		const en = str(o, 'name');
		if (ko !== null) t.sinText.push({ sin, locale: 'ko', name: ko });
		if (en !== null) t.sinText.push({ sin, locale: 'en', name: en });
		meta.source('sin', sin, 'name', 'mj-only', [MJ]);
	}

	// ── 치환 어휘 ────────────────────────────────────────────────
	for (const [id, o] of input.terms) {
		t.term.push({ id });
		const ko = str(o, 'nameKo');
		const en = str(o, 'name');
		if (ko !== null) t.termText.push({ termId: id, locale: 'ko', name: ko });
		if (en !== null) t.termText.push({ termId: id, locale: 'en', name: en });
		meta.source('term', id, 'name', 'mj-only', [MJ]);
	}

	void LOC;
	return t;
}
