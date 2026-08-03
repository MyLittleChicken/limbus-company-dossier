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
/** 위키 대조로 원본의 오류를 판정한 문서. 원본을 거스르는 보정의 근거다. */
const WIKI_GIFT = 'docs/audit/wiki/03-gift.md';
const WIKI_PACK = 'docs/audit/wiki/05-pack-gift.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/**
 * assets 가 자기 웹도구를 위해 붙인 필드. 게임 사실이 아니다.
 *
 * `srcPath` 는 여기서 뺐다 — 아이콘 파일명이라 게임 자산을 가리키는 사실이고,
 * 도구 주석으로 격리했더니 화면이 기프트 아이콘 456개를 통째로 잃었다(감사 3.4).
 * 지금은 `gift.sprite` 본체 컬럼으로 들어간다.
 */
const TOOL_FIELDS = ['search_desc', 'imageOverride', 'vestige', 'hidden', 'updated'];

/**
 * 「완전 공명」을 가리키는 영문 표기. 원본 설명문이 둘 중 하나로 쓴다.
 * `A-Reson.` 은 칸이 좁은 기프트에서 쓰는 축약형이다.
 */
const ABSOLUTE_RESONANCE = /Absolute Resonance|A-Reson\./i;

/**
 * mj 의 `packs` 가 빠뜨린 팩 풀 연결.
 *
 * 위키 테마팩 페이지가 `Unique Gifts` 로 적은 7종 중 6종은 mj 풀에 있는데 이것만 없다
 * — 설계가 아니라 결손이다(`docs/audit/wiki/05-pack-gift.md` §5).
 * 같은 자리에서 의심됐던 팩 1122(선의의 순례)의 9종은 **결손이 아니다** —
 * 게임에서 삭제된 콜라보 한정이라 여기에 넣지 않는다.
 */
const PACK_POOL_FIXES: ReadonlyArray<readonly [giftId: string, packId: string]> = [
	['9241', '1124'], // 아직 따뜻한 커피 ← 호박색 어스름의 시련
];

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
	/** 아이콘 파일명. assets `srcPath` 단독이며 id 로는 유도되지 않는다 */
	sprite: string | null;
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

/**
 * 효과 토큰 하나. **`index` 가 원본 배열 순서다.**
 *
 * 초판은 `(giftId, effectId)` 를 열쇠로 삼아 중복 토큰을 삼켰다 — 9429 작살 의족이
 * 「Gain Speed / Haste」 를 두 번 담는데 그 둘은 서로 다른 효과다(위키 확인,
 * `docs/audit/wiki/05-pack-gift.md` §4). 순서가 있어야 효과·발동을 나중에 짝지을 수 있다.
 */
export interface GiftEffectRow {
	giftId: string;
	index: number;
	effectId: string;
}

/** `GiftEffectRow` 와 같은 이유로 순서를 갖는다. */
export interface GiftTriggerRow {
	giftId: string;
	index: number;
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

		// ── 아이콘 파일명 — assets 단독 ────────────────────────────
		// 456행 전부 유일값이고 id 와도 표시명과도 대응하지 않는다(표시명 일치 362/456).
		// 여기서 잃으면 어디서도 복원할 수 없다.
		const sprite = str(a, 'srcPath');
		if (sprite !== null) meta.source('gift', id, 'sprite', 'assets-only', [ASSETS]);

		t.gift.push({
			id,
			domain: story ? 'story_dungeon' : 'mirror_dungeon',
			sin,
			tier,
			tierLabel,
			cost: num(mj, 'cost'),
			keywordId,
			hardOnly,
			sprite,
			enhanceable: stageCount >= 2,
		});

		if (story) {
			meta.source('gift', id, 'domain', 'loc-only', ['loc-ko/en/ja']);
		}

		// ── 강화 단계 ─────────────────────────────────────────────
		const descs = arr(a, 'descs');
		/** 0단계 영문 설명. 발동 요건 보정이 이것을 근거로 삼는다 */
		let baseDescEn: string | null = null;
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
				const text = descOf(str(loc, 'desc') ?? fallbackDesc);
				if (locale === 'en' && level === 0) baseDescEn = text.desc;
				t.giftStageText.push({ giftId: id, level, locale, name, ...text });
			}
		}
		if (stageCount >= 2) meta.source('gift', id, 'stages', 'assets+loc', [ASSETS, 'loc-ko/en/ja']);

		// ── 어휘 연결 ─────────────────────────────────────────────
		// **접지 않는다.** 같은 토큰이 두 번 나오면 서로 다른 두 효과다 —
		// 9429 작살 의족의 「Gain Speed / Haste」 는 「Haste 2 부여」와 「최대 속도 +1」로
		// 문장이 갈리고 발동 토큰도 2개다(docs/audit/wiki/05-pack-gift.md §4).
		// 순서를 담는 것이 짝짓기의 전제이므로 index 를 원본 배열 첨자로 둔다.
		const effects = strArr(a, 'effects');
		const triggers = strArr(a, 'triggers');
		effects.forEach((effectId, index) => t.giftEffect.push({ giftId: id, index, effectId }));
		triggers.forEach((triggerId, index) => t.giftTrigger.push({ giftId: id, index, triggerId }));
		if (effects.length > 0) meta.source('gift', id, 'effects', 'assets-only', [ASSETS]);
		if (triggers.length > 0) meta.source('gift', id, 'triggers', 'assets-only', [ASSETS]);

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
		fixPackPool(t.giftPack, meta, input.knownPacks, id);

		// ── 발동 조건 — mj 단독 ────────────────────────────────────
		const requires = mj['requires'];
		if (typeof requires === 'object' && requires !== null && !Array.isArray(requires)) {
			let corrected = false;
			for (const [kind, value] of Object.entries(requires as Record<string, unknown>)) {
				const fixed = kind === 'resonance' ? withAbsolute(value, baseDescEn) : value;
				if (fixed !== value) corrected = true;
				t.giftRequirement.push({ giftId: id, kind, value: fixed });
			}
			meta.source('gift', id, 'requires', corrected ? 'desc-corrected' : 'mj-only', [
				MJ,
				...(corrected ? [WIKI_GIFT] : []),
			]);
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

/**
 * 「완전 공명」 플래그를 설명문으로 보정한다.
 *
 * mj 가 **한 객체 안에서** 서로 모순되는 답을 준다 — `desc` 는 "Wrath Absolute
 * Resonance" 인데 `requires.resonance` 에는 `absolute` 가 없다. 위키의 per-gift
 * 데이터가 우리 설명문과 문자열까지 같아 **설명문 쪽이 옳다**
 * (`docs/audit/wiki/03-gift.md` §6 — 9001·9043·9049·9052·9053·9066 여섯 건).
 *
 * **더하기만 한다.** 이미 `absolute` 를 가진 값은 손대지 않는다 — 9104 처럼 일반 문턱과
 * 완전 문턱이 한 값에 섞여 있는 경우가 있어 일괄로 세우면 그쪽이 망가진다.
 * 기준은 **0단계** 영문 설명이다. 9001 은 ++ 단계에서 일반 공명으로 완화되는데
 * `gift_requirement` 에 단계 축이 없어 가장 흔한 0단계로 읽는다.
 */
export function withAbsolute(value: unknown, baseDescEn: string | null): unknown {
	if (baseDescEn === null || !ABSOLUTE_RESONANCE.test(baseDescEn)) return value;
	if (!Array.isArray(value)) return value;
	const parts = value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null);
	if (parts.length !== value.length) return value;
	if (parts.some((p) => 'absolute' in p)) return value;
	return parts.map((p) => ({ ...p, absolute: true }));
}

/** 위키가 판정한 팩 풀 결손을 채운다. 이미 있으면 아무것도 하지 않는다. */
function fixPackPool(out: GiftLinkRow[], meta: Meta, known: Set<string>, giftId: string): void {
	for (const [fixGift, packId] of PACK_POOL_FIXES) {
		if (fixGift !== giftId || !known.has(packId)) continue;
		if (out.some((r) => r.giftId === giftId && r.packId === packId)) continue;
		out.push({ giftId, packId });
		meta.source('gift', giftId, 'packs', 'wiki-verified', [MJ, WIKI_PACK]);
	}
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
