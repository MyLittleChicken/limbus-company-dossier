/**
 * 거울 던전 구성 — 선택지 이벤트 · 업적 · 보상 · 역경 · 은총 · 시작 기프트 풀.
 *
 * **지금 통째로 버려지는 것들이다.** 마스터북 거울 던전 편이 「assets 8파일 중
 * 변환기가 읽는 것은 grace 하나뿐」이라 적었다.
 *
 * `md__*` 와 `md__md6__*` 는 시즌 판본이며 범주 구성이 같다. season 으로 가른다.
 */
import { arr, num, str, strArr, type RawIndex } from '../source.js';
import { descOf } from './markup.js';
import type { Meta } from './meta.js';

const ASSETS = 'limbus-assets';
const LOC = 'loc-ko/en/ja';
const EVIDENCE = 'docs/data/mirror-dungeon/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

function obj(v: unknown): Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: {};
}

export interface MirrorInput {
	choiceEvents: RawIndex;
	achievements: RawIndex;
	achievementsMd6: RawIndex;
	rewards: RawIndex;
	rewardsMd6: RawIndex;
	details: RawIndex;
	eventLocKo: RawIndex;
	eventLocEn: RawIndex;
	eventLocJa: RawIndex;
	/** `mirror-dungeon/loc-{ko,en,ja}/MirrorDungeonUI_5.json` — 은총 표시명이 여기 있다 */
	graceLocKo: RawIndex;
	graceLocEn: RawIndex;
	graceLocJa: RawIndex;
	/** `mirror-dungeon/loc-{ko,en,ja}/{BattleKeywords,Bufs}_Mirror{6,7}.json` — 역경 표시명 */
	adversityLocKo: RawIndex;
	adversityLocEn: RawIndex;
	adversityLocJa: RawIndex;
	knownGifts: Set<string>;
	knownKeywords: Set<string>;
	keywordDict: Map<string, string>;
}

export interface MirrorTables {
	choiceEvent: Array<{ id: string; type: string; illustId: number | null }>;
	choiceEventText: Array<{ eventId: string; locale: Loc; name: string | null; desc: string | null; descRaw: string | null }>;
	choiceEventGift: Array<{ eventId: string; giftId: string }>;
	choiceOption: Array<{ eventId: string; index: number; message: string; results: unknown }>;
	choiceOptionText: Array<{ eventId: string; index: number; locale: Loc; message: string; desc: string | null }>;
	achievement: Array<{
		id: string; season: number; category: string; points: number[]; hardOnly: boolean[];
		/**
		 * 조건문의 자리표시자를 채울 값. 원본 `replace` 를 그대로 담는다 —
		 * `{count: [10,20,30,40,50]}` · `{floor: [1..15]}` · `{skills: ["Skill 1", …]}`.
		 *
		 * **치환은 여기서 하지 않는다.** `text` 가 `[count]` 를 그대로 가진 원문이고
		 * 소비 측이 `points[i]` ↔ `thresholds[key][i]` 를 짝지어 단계별로 편다
		 * (위키가 하는 표기와 같다). 원문을 잃지 않는 쪽을 골랐다.
		 */
		thresholds: Record<string, Array<number | string>> | null;
	}>;
	achievementText: Array<{ id: string; category: string; season: number; locale: Loc; text: string }>;
	reward: Array<{ season: number; level: number; item: string; count: number }>;
	adversity: Array<{ floorRange: string; index: number; value: number }>;
	adversityText: Array<{ floorRange: string; index: number; locale: Loc; name: string; desc: string }>;
	grace: Array<{ id: string; index: number; cost: number }>;
	graceText: Array<{ graceId: string; locale: Loc; name: string; descs: unknown }>;
	startGift: Array<{ keywordId: string; giftId: string }>;
}

export function buildMirror(input: MirrorInput, meta: Meta): MirrorTables {
	const t: MirrorTables = {
		choiceEvent: [], choiceEventText: [], choiceEventGift: [],
		choiceOption: [], choiceOptionText: [],
		achievement: [], achievementText: [], reward: [],
		adversity: [], adversityText: [], grace: [], graceText: [], startGift: [],
	};
	const eventLoc: Record<Loc, RawIndex> = {
		ko: input.eventLocKo, en: input.eventLocEn, ja: input.eventLocJa,
	};

	// ── 선택지 이벤트 ────────────────────────────────────────────
	for (const [id, e] of input.choiceEvents) {
		const type = str(e, 'type');
		if (type === null) {
			meta.gap('choice_event', id, 'type', 'type 이 없다', EVIDENCE);
			continue;
		}
		// 원본이 숫자다 — 문자열로 읽으면 null 이 된다
		t.choiceEvent.push({ id, type, illustId: num(e, 'illustId') });
		meta.source('choice_event', id, 'core', 'assets-only', [ASSETS]);

		for (const giftId of strArr(e, 'gifts')) {
			if (!input.knownGifts.has(giftId)) continue;
			t.choiceEventGift.push({ eventId: id, giftId });
		}

		// 영문은 assets 가, 한국어·일본어는 loc 이 갖는다
		for (const locale of LOCALES) {
			const loc = eventLoc[locale].get(id);
			const name = locale === 'en' ? str(e, 'name') : str(loc ?? {}, 'name');
			const desc = locale === 'en' ? str(e, 'desc') : str(loc ?? {}, 'desc');
			if (name === null && desc === null) {
				meta.gap('choice_event', id, 'text', `${locale} 표시 문자열이 없다`, EVIDENCE, locale);
				continue;
			}
			t.choiceEventText.push({ eventId: id, locale, name, ...descOf(desc) });
		}

		// **결과는 JSONB 로 담는다.** 3중 중첩이고 마스터북이 구조를 확정하지 않았다.
		arr(e, 'options').forEach((raw, index) => {
			const o = obj(raw);
			const message = str(o, 'message');
			if (message === null) return;
			t.choiceOption.push({ eventId: id, index, message, results: o['result'] ?? [] });
			for (const locale of LOCALES) {
				const locOpt = obj(arr(eventLoc[locale].get(id) ?? {}, 'options')[index]);
				const m = locale === 'en' ? message : str(locOpt, 'message');
				if (m === null) continue;
				t.choiceOptionText.push({
					eventId: id, index, locale, message: m,
					desc: locale === 'en' ? str(o, 'messageDesc') : str(locOpt, 'messageDesc'),
				});
			}
		});
	}

	// ── 업적 — 두 시즌 판본 ──────────────────────────────────────
	// 파일이 {__Season__: n, Collection: [...], …} 이고 값이 전부 객체가 아니라
	// 스캔이 **단일 객체**로 분류한다 — 파일명 stem 이 id 인 한 행이다.
	//
	// **시즌은 원본이 말한다.** 예전에는 md__* 를 0, md__md6__* 를 6 으로 박아
	// 넣었는데 `__Season__` 이 각각 "7" 과 "6" 이다 — 0 은 어디에도 없는 값이었고
	// 아이템명 `Season 7 …` 과도 모순됐다(감사 5.4 · 위키 4). 원본을 읽는다.
	const seasonOf = (index: RawIndex, fallback: number): number =>
		num([...index.values()][0] ?? {}, '__Season__') ?? fallback;
	const season7 = seasonOf(input.achievements, 0);
	const season6 = seasonOf(input.achievementsMd6, 6);

	for (const [index, season] of [
		[input.achievements, season7],
		[input.achievementsMd6, season6],
	] as const) {
		const blob = [...index.values()][0] ?? {};
		for (const [category, raw] of Object.entries(blob)) {
			if (category === '__Season__') continue;
			for (const item of Array.isArray(raw) ? raw : []) {
				const a = obj(item);
				const id = str(a, 'id');
				const text = str(a, 'text');
				if (id === null) continue;
				t.achievement.push({
					id, season, category,
					points: arr(a, 'points').map((v) => Number(v)).filter((v) => Number.isFinite(v)),
					hardOnly: arr(a, 'hardonly').map((v) => v === true),
					thresholds: replaceOf(a),
				});
				if (text !== null) t.achievementText.push({ id, category, season, locale: 'en', text });
				// 업적은 영문만 있다 — loc 에 대응 파일이 없다
				for (const locale of ['ko', 'ja'] as const) {
					meta.gap(
						'achievement', `${id}#${season}`, 'text',
						`${locale} 표시 문자열이 어느 출처에도 없다`, EVIDENCE, locale,
					);
				}
			}
		}
	}

	// ── 시즌 보상 트랙 ──────────────────────────────────────────
	// **`md__rewards.json` 에는 `__Season__` 이 없다.** 같은 판본의 업적 파일에서
	// 읽은 시즌을 그대로 쓴다 — 두 파일이 한 판본을 이룬다.
	for (const [source, season] of [
		[input.rewards, season7],
		[input.rewardsMd6, season6],
	] as const) {
		for (const [level, raw] of source) {
			const r = obj(raw);
			const item = str(r, 'item');
			const count = num(r, 'count');
			const lv = Number(level);
			if (item === null || count === null || !Number.isFinite(lv)) continue;
			t.reward.push({ season, level: lv, item, count });
			// 보상 아이템 이름도 영문만 있다
			for (const locale of ['ko', 'ja'] as const) {
				meta.gap('reward', `${season}#${lv}`, 'item', `${locale} 아이템 이름이 없다`, EVIDENCE, locale);
			}
		}
	}

	// ── md__details — grace · startGiftPool · adversity ──────────
	const details = input.details.get('md__details') ?? {};

	// **은총 표시명은 어느 출처에도 없는 것이 아니었다.** `md__details.grace` 에는
	// 영문뿐이지만 `MirrorDungeonUI_5.json` 이 3언어를 갖는다 — 키는 index 1~10 ↔
	// `mirror_dungeon_5_buffs_title_100`~`109` 다. 현행 public 파이프라인도 이 대응으로
	// 한국어를 담아 `/ko/dungeon` 에 「시작의 별」을 띄우고 있었다(감사 6.1).
	//
	// 규칙으로 조합한 키다. **영문 content 가 assets name 과 같을 때만 채택한다** —
	// 어긋나면 다른 은총을 가리키는 것이므로 결손으로 남긴다.
	const graceLoc: Record<Loc, RawIndex> = {
		ko: input.graceLocKo, en: input.graceLocEn, ja: input.graceLocJa,
	};
	arr(details, 'grace').forEach((raw) => {
		const g = obj(raw);
		const id = str(g, 'id');
		const index = num(g, 'index');
		const cost = num(g, 'cost');
		if (id === null || index === null || cost === null) return;
		t.grace.push({ id, index, cost });
		const name = str(g, 'name');
		if (name !== null) t.graceText.push({ graceId: id, locale: 'en', name, descs: g['descs'] ?? [] });

		const key = `mirror_dungeon_5_buffs_title_${99 + index}`;
		const verified = name !== null && str(graceLoc.en.get(key) ?? {}, 'content') === name;
		for (const locale of ['ko', 'ja'] as const) {
			const loc = verified ? str(graceLoc[locale].get(key) ?? {}, 'content') : null;
			if (loc === null) {
				meta.gap(
					'grace', id, 'name',
					verified
						? `${locale} 표시명이 ${key} 에 없다`
						: `${locale} 표시명 — 조합 키 ${key} 의 영문이 assets 와 어긋나 믿지 않는다`,
					EVIDENCE, locale,
				);
				continue;
			}
			// `descs` 는 여전히 영문이다 — 단계별 설명의 3언어 출처는 못 찾았다
			t.graceText.push({ graceId: id, locale, name: loc, descs: g['descs'] ?? [] });
		}
		meta.source('grace', id, 'core', verified ? 'union' : 'assets-only', verified ? [ASSETS, LOC] : [ASSETS]);
	});

	const pool = obj(details['startGiftPool']);
	for (const [rawKeyword, gifts] of Object.entries(pool)) {
		const keywordId = input.keywordDict.get(rawKeyword.toLowerCase()) ?? rawKeyword;
		if (!input.knownKeywords.has(keywordId)) {
			meta.gap('start_gift', rawKeyword, 'keyword', `키워드 "${rawKeyword}" 가 사전에 없다`, EVIDENCE);
			continue;
		}
		for (const raw of Array.isArray(gifts) ? gifts : []) {
			const giftId = String(raw);
			if (!input.knownGifts.has(giftId)) continue;
			t.startGift.push({ keywordId, giftId });
		}
	}

	// **역경 표시명도 있었다.** `md__details.adversity` 는 영문뿐이지만 같은 역경이
	// 상태이상 id 로 `{BattleKeywords,Bufs}_Mirror{6,7}.json` 에 3언어로 들어 있다.
	// 키 규칙 — 층 구간 11~15 · index 0~4 는 `MD6Limit1{fr-11}{index+1}`,
	// 여섯 번째(index 5)만 MD7 신규라 `MD7Limit1{fr-11}1` 이다(감사 6.2 · 위키 5).
	//
	// 은총과 같이 **영문 대조로 검증한 것만 채택한다**(실측 30/30).
	const adversityLoc: Record<Loc, RawIndex> = {
		ko: input.adversityLocKo, en: input.adversityLocEn, ja: input.adversityLocJa,
	};
	const adversity = obj(details['adversity']);
	for (const [floorRange, list] of Object.entries(adversity)) {
		(Array.isArray(list) ? list : []).forEach((raw, index) => {
			const a = obj(raw);
			const name = str(a, 'name');
			const desc = str(a, 'desc');
			const value = num(a, 'value');
			if (name === null || desc === null || value === null) return;
			t.adversity.push({ floorRange, index, value });
			t.adversityText.push({ floorRange, index, locale: 'en', name, desc });

			const step = Number(floorRange) - 11;
			const key = index < 5 ? `MD6Limit1${step}${index + 1}` : `MD7Limit1${step}1`;
			const verified =
				Number.isFinite(step) && str(adversityLoc.en.get(key) ?? {}, 'name') === name;
			for (const locale of ['ko', 'ja'] as const) {
				const loc = verified ? adversityLoc[locale].get(key) ?? {} : {};
				const locName = str(loc, 'name');
				if (locName === null) {
					meta.gap(
						'adversity', `${floorRange}#${index}`, 'name',
						verified
							? `${locale} 표시 문자열이 ${key} 에 없다`
							: `${locale} 표시 문자열 — 조합 키 ${key} 의 영문이 assets 와 어긋나 믿지 않는다`,
						EVIDENCE, locale,
					);
					continue;
				}
				t.adversityText.push({
					floorRange, index, locale, name: locName, desc: str(loc, 'desc') ?? desc,
				});
			}
			meta.source(
				'adversity', `${floorRange}#${index}`, 'name',
				verified ? 'union' : 'assets-only', verified ? [ASSETS, LOC] : [ASSETS],
			);
		});
	}

	return t;
}

/**
 * 업적 조건문의 자리표시자 값. 원본 `replace` 를 그대로 옮긴다.
 *
 * 자리표시자는 `[count]` 하나가 아니다 — `clr_floors` 는 `[floor]`,
 * `shp_replace` 는 `[skills]`(문자열 배열)를 쓴다. 키를 고정하지 않는다.
 */
function replaceOf(a: Record<string, unknown>): Record<string, Array<number | string>> | null {
	const r = obj(a['replace']);
	const out: Record<string, Array<number | string>> = {};
	for (const [k, v] of Object.entries(r)) {
		if (!Array.isArray(v)) continue;
		out[k] = v.map((x) => (typeof x === 'number' ? x : String(x)));
	}
	return Object.keys(out).length > 0 ? out : null;
}
