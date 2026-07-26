/**
 * 표시 문자열 정제.
 *
 * ADR-02 원칙 4 — 정제 규칙을 한 곳에 모은다. 여러 파일에 흩어지면 패치 때 갱신 지점을 놓친다.
 * ADR-03 3.3 — 토큰 치환은 빌드 시점에 수행하고 원문도 함께 보관한다.
 */
import { readJsonGlob, flattenDataList, type DataList } from './io.js';
import type { Report } from './report.js';

/** 로컬라이즈 파일의 표제어 한 줄. */
export interface Term {
	id?: string;
	name?: string;
	desc?: string;
}

/** 로컬라이즈 파일이 흩어져 있는 디렉토리. 한 곳만 읽으면 결손이 생긴다. */
const LOCALE_DIRS = ['mechanics', 'mirror-dungeon', 'gifts', 'identities', 'egos', 'packs'];

/**
 * 로케일 표제어를 전부 모은다.
 *
 * **디렉토리 하나만 읽으면 안 된다.** 상태 1,472종의 한국어는 `mechanics` 에 1,207,
 * `mirror-dungeon` 에 258, `gifts` 에 7로 흩어져 있다. 처음에 `mechanics` 만 읽어
 * 258종이 결손으로 잡혔다.
 */
export function collectLocale(locale: 'loc-ko' | 'loc-en'): Map<string, Term> {
	const out = new Map<string, Term>();
	for (const dir of LOCALE_DIRS) {
		for (const file of readJsonGlob<DataList<Term>>([dir, locale], '')) {
			for (const entry of file.dataList ?? []) {
				// 먼저 등장한 표제어를 유지한다. 뒤 파일이 덮어쓰면 결과가 파일 순서에 의존한다.
				if (entry.id && !out.has(entry.id)) out.set(entry.id, entry);
			}
		}
	}
	return out;
}

/**
 * 내부 토큰 치환표를 만든다.
 *
 * 치환 대상은 `id → name` 이다. 실측 기준 기프트 설명문의 토큰 119종 1,513회가
 * 100% 치환된다.
 */
export function buildTokenTable(terms: ReadonlyMap<string, Term>): Map<string, string> {
	const table = new Map<string, string>();
	for (const [id, term] of terms) {
		if (term.name) table.set(id, term.name);
	}
	return table;
}

/**
 * 스포일러 마크업을 제거한다.
 *
 * 소속 태그 94종 중 5종에 `<color=...><s>...</s></color>` 가 섞여 있는데,
 * **그중 2종은 닫는 태그가 `</s>` 가 아니라 `<s>` 로 깨져 있다.**
 * 짝을 맞추는 패턴 대신 모든 태그를 지우는 방식이라야 그 2종도 걸린다.
 */
export function stripMarkup(text: string): string {
	return text.replace(/<[^>]*>/g, '').trim();
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
	return substituteTokens(stripMarkup(raw), table, report, context);
}

/**
 * 키워드 식별자를 정규화한다.
 *
 * **대소문자가 소스마다 다르다** — 기프트는 `Burn`, 키워드 목록은 `burn` 이다.
 * 정규화하지 않으면 기프트 456종 전부가 외래 키 위반이 된다.
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
