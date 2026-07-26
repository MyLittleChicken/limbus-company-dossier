/**
 * 죄악 · 키워드 · 소속 · 상태.
 *
 * 정본 배정(ADR-04 2.1)
 *   죄악 · 키워드   limbus-data-mj  (유일한 목록 출처)
 *   소속            limbus-assets   (93종 전량. mj 는 64종뿐)
 *   상태            limbus-assets   (유일한 출처)
 */
import { readJson, readJsonGlob, type DataList } from '../io.js';
import { stripMarkup, toDisplay, lookupTerm, STATUS_DIRS, type LocaleIndex } from '../text.js';
import type { Report } from '../report.js';

export interface Ctx {
	report: Report;
	tokens: { ko: ReadonlyMap<string, string>; en: ReadonlyMap<string, string> };
	terms: { ko: LocaleIndex; en: LocaleIndex };
}

const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];

// ── 죄악 ──────────────────────────────────────────────────────

interface MjSin {
	name: string;
	nameKo: string;
	attribute: string;
	order: number;
}

export function buildSins(ctx: Ctx) {
	const src = readJson<Record<string, MjSin>>('mechanics', 'limbus-data-mj', 'sins.json');
	const rows: Array<{ sin: string; order: number; attribute: string }> = [];
	const texts: Array<{ sin: string; locale: Locale; name: string }> = [];
	for (const [sin, v] of Object.entries(src)) {
		rows.push({ sin, order: v.order, attribute: v.attribute });
		texts.push({ sin, locale: 'ko', name: v.nameKo });
		texts.push({ sin, locale: 'en', name: v.name });
	}
	ctx.report.rows('sin_info', rows.length);
	ctx.report.rows('sin_text', texts.length);
	return { rows, texts };
}

// ── 키워드 ────────────────────────────────────────────────────

interface MjKeyword {
	name: string;
	order: number;
}

interface MjTerm {
	name: string;
	nameKo: string;
}

/**
 * 키워드의 한국어 표시명은 `terms.json` 에서 온다.
 *
 * `keywords.json` 은 영문 표시명(`Burn`)만 갖고, 로케일 파일은 내부 식별자(`Combustion`)로
 * 색인된다. **대응표 없이 문자열을 매칭하면 안 된다**(02-data-model 4.3).
 * 다행히 `terms.json` 은 표시명과 내부 식별자 양쪽을 키로 갖고 있어 대응표를 따로 만들 필요가 없다.
 *
 * 공격 타입 3종(참격·관통·타격)은 상태가 아니라 `terms.json` 에도 없다. 여기서 직접 적는다.
 */
const ATTACK_TYPE_KO: Record<string, string> = {
	slash: '참격',
	pierce: '관통',
	blunt: '타격',
};

export function buildKeywords(ctx: Ctx) {
	const src = readJson<Record<string, MjKeyword>>('mechanics', 'limbus-data-mj', 'keywords.json');
	const terms = readJson<Record<string, MjTerm>>('mechanics', 'limbus-data-mj', 'terms.json');

	// terms.json 은 **내부 식별자로 색인되고 표시명은 값에 있다**. 키 조회만으로는
	// `Burn`(표시명)이 안 걸리고 `Combustion`(내부명)만 걸린다. 양쪽을 다 색인한다.
	const koByName = new Map<string, string>();
	for (const [key, term] of Object.entries(terms)) {
		if (!term?.nameKo) continue;
		if (!koByName.has(key)) koByName.set(key, term.nameKo);
		if (term.name && !koByName.has(term.name)) koByName.set(term.name, term.nameKo);
	}

	const rows: Array<{ id: string; order: number }> = [];
	const texts: Array<{ keywordId: string; locale: Locale; name: string }> = [];

	for (const [id, v] of Object.entries(src)) {
		rows.push({ id, order: v.order });
		const ko = koByName.get(v.name) ?? ATTACK_TYPE_KO[id];
		if (ko === undefined) ctx.report.unmapped('키워드 한국어 없음', id, v.name);
		texts.push({ keywordId: id, locale: 'ko', name: ko ?? v.name });
		texts.push({ keywordId: id, locale: 'en', name: v.name });
	}
	ctx.report.rows('keyword', rows.length);
	ctx.report.rows('keyword_text', texts.length);
	return { rows, texts };
}

// ── 소속 ──────────────────────────────────────────────────────

interface UnitKeyword {
	id?: string;
	content?: string;
}

interface MjAssociation {
	name: string;
	nameKo: string;
}

export function buildAffiliations(ctx: Ctx) {
	// 정본은 limbus-assets 의 태그 목록이다. 마크업을 지우면 93종이 된다.
	const list = readJson<string[]>('identities', 'limbus-assets', 'identity_tag_list.json');
	const ids = [...new Set(list.map(stripMarkup).filter(Boolean))].sort();

	// 한국어는 두 곳에서 받는다. mj 의 associations 는 64종뿐이라 그것만으로는 35종이 빈다.
	// 로케일 파일 `UnitKeyword*.json` 이 내부 id 로 영↔한 쌍을 갖고 있어 대부분을 채운다.
	const ko = new Map<string, string>();
	const assoc = readJson<Record<string, MjAssociation>>(
		'identities',
		'limbus-data-mj',
		'associations.json',
	);
	for (const v of Object.values(assoc)) if (v.name && v.nameKo) ko.set(v.name, v.nameKo);

	// 영문 로케일의 `content` 를 키로 삼아 한국어 `content` 를 잇는다.
	const enById = new Map<string, string>();
	for (const file of readJsonGlob<DataList<UnitKeyword>>(
		['identities', 'loc-en'],
		'UnitKeyword',
	)) {
		for (const e of file.dataList ?? []) if (e.id && e.content) enById.set(e.id, e.content);
	}
	for (const file of readJsonGlob<DataList<UnitKeyword>>(
		['identities', 'loc-ko'],
		'UnitKeyword',
	)) {
		for (const e of file.dataList ?? []) {
			const english = e.id ? enById.get(e.id) : undefined;
			if (english && e.content && !ko.has(english)) ko.set(english, e.content);
		}
	}

	const rows = ids.map((id) => ({ id }));
	const texts: Array<{ affiliationId: string; locale: Locale; name: string }> = [];
	let missingKo = 0;
	for (const id of ids) {
		const korean = ko.get(id);
		if (korean === undefined) missingKo += 1;
		texts.push({ affiliationId: id, locale: 'ko', name: korean ?? id });
		texts.push({ affiliationId: id, locale: 'en', name: id });
	}
	ctx.report.rows('affiliation', rows.length);
	ctx.report.rows('affiliation_text', texts.length);
	// 소스에 없는 것은 만들 수 없다. 실패가 아니라 확인 항목이다.
	if (missingKo > 0) ctx.report.note('소속 한국어 결손(영문 유지)', `${missingKo}종`);
	return { rows, texts };
}

// ── 상태 ──────────────────────────────────────────────────────

interface AssetStatus {
	buffType: string;
	desc: string;
	name: string;
	srcPath?: string;
}

export function buildStatuses(ctx: Ctx) {
	const src = readJson<Record<string, AssetStatus>>(
		'mechanics',
		'limbus-assets',
		'statuses.json',
	);

	const rows: Array<{ id: string; buffType: string; sprite: string | null }> = [];
	const texts: Array<{
		statusId: string;
		locale: Locale;
		name: string;
		desc: string;
		descRaw: string;
	}> = [];

	let missingKo = 0;
	for (const [id, v] of Object.entries(src)) {
		rows.push({ id, buffType: v.buffType, sprite: v.srcPath ?? null });
		for (const locale of LOCALES) {
			const hit = lookupTerm(ctx.terms[locale], id, STATUS_DIRS);
			if (locale === 'ko' && hit === undefined) missingKo += 1;
			const rawName = hit?.name ?? v.name;
			const rawDesc = hit?.desc ?? v.desc ?? '';
			texts.push({
				statusId: id,
				locale,
				name: stripMarkup(rawName),
				desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `status:${id}`),
				descRaw: rawDesc,
			});
		}
	}

	ctx.report.rows('status', rows.length);
	ctx.report.rows('status_text', texts.length);
	if (missingKo > 0) ctx.report.note('상태 한국어 결손(영문 유지)', `${missingKo}종`);
	return { rows, texts };
}
