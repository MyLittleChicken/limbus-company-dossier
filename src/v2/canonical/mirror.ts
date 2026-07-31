/**
 * 거울 던전 구성 — 선택지 이벤트 · 업적 · 보상 · 역경 · 은총 · 시작 기프트 풀.
 *
 * **지금 통째로 버려지는 것들이다.** 마스터북 거울 던전 편이 「assets 8파일 중
 * 변환기가 읽는 것은 grace 하나뿐」이라 적었다.
 *
 * `md__*` 와 `md__md6__*` 는 시즌 판본이며 범주 구성이 같다. season 으로 가른다.
 */
import { arr, num, str, strArr, type RawIndex } from '../source.js';
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
	knownGifts: Set<string>;
	knownKeywords: Set<string>;
	keywordDict: Map<string, string>;
}

export interface MirrorTables {
	choiceEvent: Array<{ id: string; type: string; illustId: string | null }>;
	choiceEventText: Array<{ eventId: string; locale: Loc; name: string | null; desc: string | null }>;
	choiceEventGift: Array<{ eventId: string; giftId: string }>;
	choiceOption: Array<{ eventId: string; index: number; message: string; results: unknown }>;
	choiceOptionText: Array<{ eventId: string; index: number; locale: Loc; message: string; desc: string | null }>;
	achievement: Array<{ id: string; season: number; category: string; points: number[]; hardOnly: boolean[] }>;
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
		t.choiceEvent.push({ id, type, illustId: str(e, 'illustId') });
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
			t.choiceEventText.push({ eventId: id, locale, name, desc });
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
	for (const [index, season] of [
		[input.achievements, 0],
		[input.achievementsMd6, 6],
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

	// ── 층별 보상 ───────────────────────────────────────────────
	for (const [source, season] of [
		[input.rewards, 0],
		[input.rewardsMd6, 6],
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

	arr(details, 'grace').forEach((raw) => {
		const g = obj(raw);
		const id = str(g, 'id');
		const index = num(g, 'index');
		const cost = num(g, 'cost');
		if (id === null || index === null || cost === null) return;
		t.grace.push({ id, index, cost });
		const name = str(g, 'name');
		if (name !== null) t.graceText.push({ graceId: id, locale: 'en', name, descs: g['descs'] ?? [] });
		// 은총도 영문만 있다
		for (const locale of ['ko', 'ja'] as const) {
			meta.gap('grace', id, 'name', `${locale} 표시명이 어느 출처에도 없다`, EVIDENCE, locale);
		}
		meta.source('grace', id, 'core', 'assets-only', [ASSETS]);
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
			// 역경도 영문만 있다
			for (const locale of ['ko', 'ja'] as const) {
				meta.gap(
					'adversity', `${floorRange}#${index}`, 'name',
					`${locale} 표시 문자열이 어느 출처에도 없다`, EVIDENCE, locale,
				);
			}
		});
	}

	void LOC;
	return t;
}
