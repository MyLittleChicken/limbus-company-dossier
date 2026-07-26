/**
 * 표시 문자열 정제.
 *
 * ADR-02 원칙 4 — 정제 규칙을 한 곳에 모은다. 여러 파일에 흩어지면 패치 때 갱신 지점을 놓친다.
 * ADR-03 3.3 — 토큰 치환은 빌드 시점에 수행하고 원문도 함께 보관한다.
 */
import { readJson, readJsonGlob, flattenDataList, type DataList } from './io.js';
import type { Report } from './report.js';

/**
 * 로컬라이즈 파일의 표제어 한 줄.
 *
 * **`id` 의 타입이 파일마다 다르다** — 기프트는 정수 `9001`, 상태는 문자열 `"AreaAtk"` 다.
 * 색인할 때 문자열로 통일하지 않으면 조회가 전부 빗나간다.
 */
export interface Term {
	id?: string | number;
	name?: string;
	desc?: string;
	/** UI 문자열 파일은 `name` 대신 이 필드를 쓴다. 색인 시 `name` 으로 정규화한다. */
	content?: string;
}

/** 로컬라이즈 파일이 흩어져 있는 디렉토리. 한 곳만 읽으면 결손이 생긴다. */
const LOCALE_DIRS = ['mechanics', 'mirror-dungeon', 'gifts', 'identities', 'egos', 'packs'] as const;

export type LocaleDir = (typeof LOCALE_DIRS)[number];

/**
 * 디렉토리별로 나뉜 로케일 색인.
 *
 * **id 공간이 엔티티마다 겹친다.** `1001` 은 팩(잊혀진 자들)이면서 동시에 다른 디렉토리의
 * 기프트(신도의 가면)이기도 하다. 실측 40종이 두 개 이상의 디렉토리에 겹친다. 평평한 맵으로 합치면
 * 조회가 엉뚱한 엔티티의 이름을 돌려준다. 조회할 때 어느 디렉토리를 볼지 지정해야 한다.
 */
export type LocaleIndex = ReadonlyMap<LocaleDir, ReadonlyMap<string, Term>>;

/** 지정한 디렉토리들에서 순서대로 찾는다. 앞선 디렉토리가 우선한다. */
export function lookupTerm(
	index: LocaleIndex,
	id: string | number,
	dirs: readonly LocaleDir[],
): Term | undefined {
	const key = String(id);
	for (const dir of dirs) {
		const hit = index.get(dir)?.get(key);
		if (hit !== undefined) return hit;
	}
	return undefined;
}

/** 상태 표제어가 놓인 디렉토리. 실측 mechanics 1,214 · mirror-dungeon 258 (합 1,472). */
export const STATUS_DIRS = ['mechanics', 'mirror-dungeon', 'gifts'] as const;

/**
 * 로케일 표제어를 전부 모은다.
 *
 * **디렉토리 하나만 읽으면 안 된다.** 상태 1,472종의 한국어는 `mechanics` 에 1,207,
 * `mirror-dungeon` 에 258, `gifts` 에 7로 흩어져 있다. 처음에 `mechanics` 만 읽어
 * 258종이 결손으로 잡혔다.
 */
const HANGUL = /[가-힣]/;

/** 번역 대신 들어간 자리표시자. 실측 32회 등장하며 영어 파일에도 이 한국어가 그대로 있다. */
const PLACEHOLDERS = new Set(['버프 이름']);

/**
 * 표제어의 적합도. 같은 id 가 여러 파일에 있을 때 무엇을 택할지 정한다.
 *
 * **먼저 등장한 것을 택하면 안 된다.** `loc-en/EGOgift.json` 은 영어 로케일인데 내용이
 * 한국어인 미번역 스텁이고, 파일명이 사전순으로 앞서 이긴다. 그 결과 기프트 9001–9040 의
 * 영문명이 한국어로 굳었다. 로케일과 언어가 맞는 쪽을 택해야 한다.
 */
function score(term: Term, locale: 'loc-ko' | 'loc-en'): number {
	const name = term.name;
	if (!name) return 0;
	if (PLACEHOLDERS.has(name.trim())) return -1;
	const hasHangul = HANGUL.test(name);
	return hasHangul === (locale === 'loc-ko') ? 2 : 1;
}

export function collectLocale(locale: 'loc-ko' | 'loc-en', report: Report): LocaleIndex {
	const out = new Map<LocaleDir, Map<string, Term>>();
	for (const dir of LOCALE_DIRS) {
		const bucket = new Map<string, Term>();
		out.set(dir, bucket);
		for (const file of readJsonGlob<DataList<Term>>([dir, locale], '')) {
			for (const entry of file.dataList ?? []) {
				if (entry.id === undefined || entry.id === null) continue;
				const key = String(entry.id);
				// 파일마다 표시명 필드가 다르다. `content` 만 있는 것은 `name` 으로 맞춘다.
				if (!entry.name && entry.content) entry.name = entry.content;
				const seen = bucket.get(key);
				if (seen === undefined) {
					bucket.set(key, entry);
					continue;
				}
				if (!entry.name || !seen.name || entry.name === seen.name) continue;
				// 적합도가 높은 쪽으로 교체한다. 같으면 먼저 등장한 것을 유지해 순서 의존을 막는다.
				if (score(entry, locale) > score(seen, locale)) {
					bucket.set(key, entry);
					report.note(`로케일 표제어 교체 (${locale}/${dir})`, key, `${seen.name} → ${entry.name}`);
				} else {
					report.note(`로케일 표제어 중복 (${locale}/${dir})`, key, `${seen.name} / ${entry.name}`);
				}
			}
		}
	}
	return out;
}

/**
 * 내부 토큰 치환표를 만든다.
 *
 * 토큰은 상태 식별자이므로 상태 표제어가 놓인 디렉토리만 본다. 실측 기준 기프트
 * 설명문의 토큰 119종 1,513회가 100% 치환된다.
 */
export function buildTokenTable(index: LocaleIndex): Map<string, string> {
	const table = new Map<string, string>();
	for (const dir of STATUS_DIRS) {
		for (const [id, term] of index.get(dir) ?? []) {
			if (term.name && !table.has(id)) table.set(id, term.name);
		}
	}
	return table;
}

/** 발동 시점 표기의 어휘. 이 목록 자체가 무엇이 발동 시점 표기인지를 정의한다. */
interface SkillTag {
	text?: string;
}

/** 발동 시점 표기의 한국어. 정본(`skill_tags.json`)은 영어만 담는다. */
interface TriggerTerm {
	name?: string;
	nameKo?: string;
}

/**
 * 스킬·코인·패시브 설명문의 치환표. 상태 표에 **발동 시점 표기**를 덮어 얹는다.
 *
 * 대괄호 표기는 어휘가 둘이다. `[Sinking]` 은 상태이고 `[WhenUse]` 는 발동 시점이다.
 * 상태 표만 쓰면 발동 시점 표기 40종 17,324회가 `[WhenUse]` 꼴로 화면에 새어나간다.
 *
 * **덮어쓰는 이유는 두 어휘가 같은 열쇠를 다른 뜻으로 쓰기 때문이다.** `StartBattle` 은
 * 상태 어휘에서 거울 던전 조우 알림 `전투 발생!` 이지만 스킬 어휘에서는 발동 시점
 * `[전투 시작시]` 다. 스킬 설명문 안의 표기는 스킬 어휘로 읽어야 한다(ADR-04 2.2 —
 * 어휘가 출처를 정한다). 실측 충돌은 이 한 종뿐이고 나머지 39종은 상태 표에 없다.
 *
 * 정본은 `identities/limbus-assets/skill_tags.json`(72종, 영어)이고 한국어는
 * `mechanics/limbus-data-mj/terms.json` 에서 보강한다(ADR-04 2.3). 두 출처가 겹치는
 * 39종의 영문 표기를 전수 대조해 불일치 0을 확인했다.
 */
export function buildTriggerTable(
	base: ReadonlyMap<string, string>,
	locale: 'ko' | 'en',
	report: Report,
): Map<string, string> {
	const tags = readJson<Record<string, SkillTag>>('identities', 'limbus-assets', 'skill_tags.json');
	const terms = readJson<Record<string, TriggerTerm>>('mechanics', 'limbus-data-mj', 'terms.json');
	const table = new Map(base);
	for (const [key, tag] of Object.entries(tags)) {
		// `text` 가 빈 문자열인 표기가 있다(`TabExplain`). 게임이 지우는 UI 표식이므로
		// 빈 값 그대로가 정답이다. `??` 를 써서 빈 문자열이 폴백으로 넘어가지 않게 한다.
		const en = tag.text ?? terms[key]?.name;
		const value = locale === 'ko' ? (terms[key]?.nameKo ?? en) : en;
		if (value === undefined) {
			report.note(`발동 시점 표기에 표시 문자열이 없음 (${locale})`, key);
			continue;
		}
		const prev = base.get(key);
		if (prev !== undefined && prev !== value) {
			report.note(`발동 시점 표기가 상태 표기를 대체 (${locale})`, key, `${prev} → ${value}`);
		}
		table.set(key, value);
	}
	return table;
}

/**
 * Unity 리치텍스트 태그 이름. 게임 텍스트에 실제로 등장하는 것만 담는다.
 *
 * **꺾쇠를 무조건 지우면 안 된다.** 게임은 `<혈귀>` · `<라만차랜드>` · `<획득 조건>` 처럼
 * 꺾쇠 자체를 키워드 표기로 쓴다. 전부 지우면 `<라만차랜드>소속, <혈귀>(상위 권속)인 아군` 이
 * `소속, (상위 권속)인 아군` 이 되어 주어가 사라진다. 실측 리터럴 100종이 이런 표기다.
 */
const UNITY_TAGS = [
	'color', 'style', 'b', 'i', 'u', 's', 'size', 'mark', 'sprite', 'link', 'noparse',
	'font', 'br', 'align', 'cspace', 'indent', 'line-height', 'lowercase', 'uppercase',
	'smallcaps', 'margin', 'nobr', 'pos', 'space', 'voffset', 'width', 'alpha',
	'gradient', 'rotate', 'sup', 'sub',
] as const;

const MARKUP = new RegExp(`</?(?:${UNITY_TAGS.join('|')})\\b[^>]*>`, 'gi');

/**
 * Unity 리치텍스트만 제거한다. 리터럴 꺾쇠 표기는 보존한다.
 *
 * 소속 태그 5종에 섞인 스포일러 마크업도 여기서 걸린다. **그중 2종은 닫는 태그가
 * `</s>` 가 아니라 `<s>` 로 깨져 있는데**, 짝을 맞추지 않고 태그 단위로 지우므로 함께 처리된다.
 */
export function stripMarkup(text: string): string {
	return text.replace(MARKUP, '').trim();
}

const TOKEN = /\[([A-Za-z][A-Za-z0-9_ ]*)\]/g;

/**
 * `[Combustion]` 같은 내부 토큰을 표시명으로 바꾼다.
 *
 * 대괄호가 전부 토큰인 것은 아니다. 설명문에는 `Trussed [Hong Lu]` 나 `[Rouge]` 처럼
 * **표기 그대로가 의도인 리터럴**도 들어 있다. 표에 없으면 원문을 남기며, 이는 오류가
 * 아니라 정상이다. 다만 새 상태가 표에 안 들어온 경우와 구분되지 않으므로 리포트에는
 * 올려 눈으로 확인할 수 있게 한다.
 */
export function substituteTokens(
	text: string,
	table: ReadonlyMap<string, string>,
	report: Report,
	context: string,
): string {
	return text.replace(TOKEN, (whole, key: string) => {
		const replacement = table.get(key);
		if (replacement === undefined) {
			report.note('표에 없는 대괄호 표기(원문 유지)', key, context);
			return whole;
		}
		return replacement;
	});
}

/**
 * 표시용 텍스트를 만든다. 마크업을 지우고 토큰을 치환한다.
 * 원문은 호출 측이 따로 보관한다(ADR-03 2절 — `descRaw`).
 */
export function toDisplay(
	raw: string | null | undefined,
	table: ReadonlyMap<string, string>,
	report: Report,
	context: string,
): string {
	if (!raw) return '';
	// 치환값 자체가 마크업을 품은 표제어가 있다(예: `중지 - 원한 문신 [<s>큰 누님</s>]`).
	// 치환 뒤 한 번 더 정제하지 않으면 그 마크업이 표시용 텍스트에 남는다.
	return stripMarkup(substituteTokens(stripMarkup(raw), table, report, context));
}

/**
 * 키워드 식별자를 정규화한다.
 *
 * **대소문자가 소스마다 다르다** — 기프트는 `Burn`, 키워드 목록은 `burn` 이다.
 * 정규화하지 않으면 키워드를 가진 기프트 336종이 전부 외래 키 위반이 된다.
 * 원본의 `Keywordless` 는 값이 아니라 부재를 뜻하므로 null 로 바꾼다.
 */
export function normalizeKeyword(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const key = raw.toLowerCase();
	return key === 'keywordless' ? null : key;
}

/** `20230227` 또는 `2023-02-27` 을 ISO 날짜로 맞춘다. 출처마다 형식이 다르다. */
export function toIsoDate(value: string | number | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const text = String(value);
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
	if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
	return null;
}
