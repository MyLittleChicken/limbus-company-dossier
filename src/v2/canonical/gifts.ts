/**
 * E.G.O 기프트 582종.
 *
 * 정본은 limbus-assets 다(ADR-04). 다만 마스터북 기프트 편에서 세 출처가 처음으로
 * 균등해졌다 — 단독 보유 개념이 mj 5 · assets 6 · loc 6 이다. 어느 하나를 골라도
 * 3분의 1을 잃으므로 필드마다 정본이 다르다.
 *
 * **loc 가 강화 단계를 별도 id 로 담는다** — id+10000 이 2단계, id+20000 이 3단계다.
 * 한국어 강화 단계 이름·설명이 여기에만 있으므로 이 규칙이 없으면 영영 못 얻는다.
 */
import { arr, bool, num, str, strArr, type RawIndex } from '../source.js';
import { keywordIdOf } from './vocab.js';
import { descOf } from './markup.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const EVIDENCE = 'docs/data/gift/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/** assets 가 자기 웹도구를 위해 붙인 필드. 게임 사실이 아니다. */
const TOOL_FIELDS = ['search_desc', 'srcPath', 'imageOverride', 'vestige', 'hidden', 'updated'];

/** loc 의 강화 단계 id 규칙. level 0 은 원래 id, 1·2 는 +10000 · +20000 이다. */
export function stageLocId(giftId: string, level: number): string {
	if (level === 0) return giftId;
	return String(Number(giftId) + level * 10_000);
}

export interface GiftInput {
	mj: RawIndex;
	mjDetail: RawIndex;
	assets: RawIndex;
	locKo: RawIndex;
	locEn: RawIndex;
	locJa: RawIndex;
	lockedKo: RawIndex;
	lockedEn: RawIndex;
	lockedJa: RawIndex;
	/** 소문자 영문명 → 키워드 사전 id */
	keywordDict: Map<string, string>;
	/** canonical.pack 에 실제로 있는 팩 id. 외래 키가 서야 한다 */
	knownPacks: Set<string>;
}

export interface GiftRow {
	id: string;
	domain: 'mirror_dungeon' | 'story_dungeon';
	sin: string | null;
	tier: number | null;
	tierLabel: string | null;
	cost: number | null;
	keywordId: string | null;
	hardOnly: boolean;
	enhanceable: boolean;
}

export interface GiftStageRow {
	giftId: string;
	level: number;
}

export interface GiftStageTextRow {
	giftId: string;
	level: number;
	locale: Loc;
	name: string;
	desc: string | null;
	descRaw: string | null;
}

export interface GiftLinkRow {
	giftId: string;
	packId: string;
}

export interface GiftEffectRow {
	giftId: string;
	effectId: string;
}

export interface GiftTriggerRow {
	giftId: string;
	triggerId: string;
}

export interface GiftRequirementRow {
	giftId: string;
	kind: string;
	value: unknown;
}

export interface FusionRecipeRow {
	giftId: string;
	index: number;
}

export interface FusionSlotRow {
	giftId: string;
	recipeIdx: number;
	slotIdx: number;
	materialId: string | null;
	count: number | null;
}

export interface FusionSlotOptionRow {
	giftId: string;
	recipeIdx: number;
	slotIdx: number;
	materialId: string;
}

export interface GiftLockedDescRow {
	giftId: string;
	locale: Loc;
	text: string;
}

export interface ToolAnnotationRow {
	source: string;
	entity: string;
	entityId: string;
	field: string;
	value: unknown;
}

export interface GiftTables {
	gift: GiftRow[];
	giftStage: GiftStageRow[];
	giftStageText: GiftStageTextRow[];
	giftEffect: GiftEffectRow[];
	giftTrigger: GiftTriggerRow[];
	giftPack: GiftLinkRow[];
	giftExclusivePack: GiftLinkRow[];
	giftRequirement: GiftRequirementRow[];
	fusionRecipe: FusionRecipeRow[];
	fusionSlot: FusionSlotRow[];
	fusionSlotOption: FusionSlotOptionRow[];
	giftLockedDesc: GiftLockedDescRow[];
	toolAnnotation: ToolAnnotationRow[];
}

/** 이 id 가 스토리 던전 기프트인가. 4자리 숫자이면서 assets 에 없다. */
function isStoryGift(id: string, assets: RawIndex): boolean {
	return /^\d{4}$/.test(id) && !assets.has(id);
}

export function buildGifts(input: GiftInput, meta: Meta): GiftTables {
	const t: GiftTables = {
		gift: [],
		giftStage: [],
		giftStageText: [],
		giftEffect: [],
		giftTrigger: [],
		giftPack: [],
		giftExclusivePack: [],
		giftRequirement: [],
		fusionRecipe: [],
		fusionSlot: [],
		fusionSlotOption: [],
		giftLockedDesc: [],
		toolAnnotation: [],
	};

	const locByName: Record<Loc, RawIndex> = {
		ko: input.locKo,
		en: input.locEn,
		ja: input.locJa,
	};
	const lockedByName: Record<Loc, RawIndex> = {
		ko: input.lockedKo,
		en: input.lockedEn,
		ja: input.lockedJa,
	};

	// 대상 id — assets 전량 + loc 에만 있는 스토리 던전 기프트
	const ids = new Set<string>(input.assets.keys());
	for (const index of LOCALES.map((l) => locByName[l])) {
		for (const id of index.keys()) if (isStoryGift(id, input.assets)) ids.add(id);
	}

	for (const id of [...ids].sort((a, b) => Number(a) - Number(b))) {
		const assets = input.assets.get(id);
		const mj = input.mj.get(id) ?? {};
		const detail = input.mjDetail.get(id) ?? {};
		const story = assets === undefined;
		const a = assets ?? {};

		// ── 등급 — mj 는 문자열, assets 는 숫자. "EX" 는 숫자가 아니다 ──
		const tierRaw = str(mj, 'tier') ?? (typeof a['tier'] === 'number' ? String(a['tier']) : str(a, 'tier'));
		const tier = tierRaw !== null && /^\d+$/.test(tierRaw) ? Number(tierRaw) : null;
		const tierLabel = tierRaw !== null && tier === null ? tierRaw : null;

		// ── hardOnly — 합집합. 한쪽만 보면 6건 또는 69건을 놓친다 ──
		const hardOnly = bool(mj, 'hardOnly') || bool(a, 'hardonly');
		if (!story) {
			meta.source('gift', id, 'hardOnly', 'union', [MJ, ASSETS]);
		}

		// ── 죄악 — mj 단독. assets affinity 는 4건 틀렸다(게임 확인) ──
		const sin = str(mj, 'sin');
		if (sin !== null) meta.source('gift', id, 'sin', 'mj-only', [MJ]);

		const keywordEn = str(mj, 'keyword') ?? str(a, 'keyword');
		const keywordId = story ? null : keywordIdOf(keywordEn, input.keywordDict);
		if (keywordId === null && !story) {
			meta.gap('gift', id, 'keywordId', `키워드 "${keywordEn}" 가 사전에 없다`, EVIDENCE);
		}

		const names = arr(a, 'names');
		const stageCount = story ? 1 : Math.max(1, names.length);

		t.gift.push({
			id,
			domain: story ? 'story_dungeon' : 'mirror_dungeon',
			sin,
			tier,
			tierLabel,
			cost: num(mj, 'cost'),
			keywordId,
			hardOnly,
			enhanceable: stageCount >= 2,
		});

		if (story) {
			meta.source('gift', id, 'domain', 'loc-only', ['loc-ko/en/ja']);
		}

		// ── 강화 단계 ─────────────────────────────────────────────
		const descs = arr(a, 'descs');
		for (let level = 0; level < stageCount; level += 1) {
			t.giftStage.push({ giftId: id, level });
			const locId = stageLocId(id, level);
			for (const locale of LOCALES) {
				const loc = locByName[locale].get(locId) ?? {};
				const fallbackName =
					locale === 'en' && typeof names[level] === 'string' ? (names[level] as string) : null;
				const fallbackDesc =
					locale === 'en' && typeof descs[level] === 'string' ? (descs[level] as string) : null;
				const name = str(loc, 'name') ?? fallbackName;
				if (name === null) {
					meta.gap(
						'gift',
						id,
						'name',
						`${locale} 표시명이 어느 출처에도 없다 (단계 ${level})`,
						EVIDENCE,
						locale,
					);
					continue;
				}
				t.giftStageText.push({
					giftId: id,
					level,
					locale,
					name,
					...descOf(str(loc, 'desc') ?? fallbackDesc),
				});
			}
		}
		if (stageCount >= 2) meta.source('gift', id, 'stages', 'assets+loc', [ASSETS, 'loc-ko/en/ja']);

		// ── 어휘 연결 ─────────────────────────────────────────────
		// **중복을 접는다.** 원본 결함 — 9429 가 "Gain Speed / Haste" 를 두 번 담는다.
		// 마스터북 원본 결함 31건에 없던 것이며 여기서 처음 드러났다.
		const effects = strArr(a, 'effects');
		const triggers = strArr(a, 'triggers');
		if (effects.length !== new Set(effects).size) {
			meta.source('gift', id, 'effects', 'assets-only-deduped', [ASSETS]);
		}
		if (triggers.length !== new Set(triggers).size) {
			meta.source('gift', id, 'triggers', 'assets-only-deduped', [ASSETS]);
		}
		for (const e of new Set(effects)) t.giftEffect.push({ giftId: id, effectId: e });
		for (const g of new Set(triggers)) t.giftTrigger.push({ giftId: id, triggerId: g });

		// ── 팩 연결 ──────────────────────────────────────────────
		pushPacks(t.giftPack, meta, input.knownPacks, id, strArr(mj, 'packs'), 'packs', MJ);
		pushPacks(
			t.giftExclusivePack,
			meta,
			input.knownPacks,
			id,
			strArr(a, 'exclusiveTo'),
			'exclusiveTo',
			ASSETS,
		);

		// ── 발동 조건 — mj 단독 ────────────────────────────────────
		const requires = mj['requires'];
		if (typeof requires === 'object' && requires !== null && !Array.isArray(requires)) {
			for (const [kind, value] of Object.entries(requires as Record<string, unknown>)) {
				t.giftRequirement.push({ giftId: id, kind, value });
			}
			meta.source('gift', id, 'requires', 'mj-only', [MJ]);
		}

		// ── 합성 — assets recipes 가 대체 슬롯을 담는다 ──────────────
		arr(a, 'recipes').forEach((recipe, recipeIdx) => {
			if (!Array.isArray(recipe)) return;
			t.fusionRecipe.push({ giftId: id, index: recipeIdx });
			recipe.forEach((slot, slotIdx) => {
				if (typeof slot === 'string' || typeof slot === 'number') {
					t.fusionSlot.push({
						giftId: id,
						recipeIdx,
						slotIdx,
						materialId: String(slot),
						count: null,
					});
					return;
				}
				if (typeof slot !== 'object' || slot === null) return;
				const s = slot as Record<string, unknown>;
				t.fusionSlot.push({
					giftId: id,
					recipeIdx,
					slotIdx,
					materialId: null,
					count: num(s, 'count'),
				});
				for (const opt of strArr(s, 'options')) {
					t.fusionSlotOption.push({ giftId: id, recipeIdx, slotIdx, materialId: opt });
				}
			});
		});
		if (arr(a, 'recipes').length > 0) meta.source('gift', id, 'recipes', 'assets-only', [ASSETS]);

		// ── 획득 문구 ────────────────────────────────────────────
		for (const locale of LOCALES) {
			const text = str(lockedByName[locale].get(id) ?? {}, 'content');
			if (text !== null) t.giftLockedDesc.push({ giftId: id, locale, text });
		}

		// ── 도구 필드 격리 ────────────────────────────────────────
		for (const field of TOOL_FIELDS) {
			const value = a[field];
			if (value === undefined || value === null) continue;
			t.toolAnnotation.push({
				source: ASSETS,
				entity: 'gift',
				entityId: id,
				field,
				value,
			});
		}
	}

	return t;
}

/** 팩 연결 하나. 모르는 팩을 가리키면 버리고 결손으로 남긴다. */
function pushPacks(
	out: GiftLinkRow[],
	meta: Meta,
	known: Set<string>,
	giftId: string,
	packIds: string[],
	field: string,
	source: string,
): void {
	let dropped = 0;
	for (const packId of packIds) {
		if (!known.has(packId)) {
			dropped += 1;
			continue;
		}
		out.push({ giftId, packId });
	}
	if (dropped > 0) {
		meta.gap('gift', giftId, field, `${field} 가 팩 목록에 없는 id 를 ${dropped}건 가리킨다`, EVIDENCE);
	} else if (packIds.length > 0) {
		meta.source('gift', giftId, field, `${source}-only`, [source]);
	}
}
