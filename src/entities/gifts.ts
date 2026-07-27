/**
 * E.G.O 기프트와 합성 레시피.
 *
 * 정본 배정(ADR-04 2.1)  limbus-assets — 456종 완전집합. mj 는 441종으로 15종이 없다.
 * 허용 보강(ADR-04 2.3)
 *   gift.mdCost   limbus-data-mj `cost`   441/456 만 존재하므로 15종은 빈다
 *   gift_pack     limbus-data-mj `packs`  정본에 없다. 교차 검증 불가한 단일 출처다
 */
import { readJson, toRecords } from '../io.js';
import { normalizeKeyword, toDisplay, stripMarkup, lookupTerm } from '../text.js';
import type { Ctx } from './basics.js';

const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];

/** 강화 단계 id 규칙 — 기본 id + 10000 × 단계. 로컬라이즈 소스에만 있는 규칙이다. */
const ENHANCE_ID_STRIDE = 10_000;

interface AssetGift {
	tier: string | number;
	affinity: string;
	effects?: string[];
	triggers?: string[];
	keyword?: string;
	names: string[];
	descs?: string[];
	srcPath: string;
	enhanceable?: boolean;
	hardonly?: boolean;
	exclusiveTo?: string[];
	/** 재료 슬롯. 문자열이면 단일 기프트, 객체면 대체 가능한 묶음이다. */
	recipes?: Array<Array<string | { count?: number; options?: string[] }>>;
}

interface MjGift {
	id: number;
	cost?: number;
	packs?: number[];
}

export function buildGifts(ctx: Ctx) {
	const assets = readJson<Record<string, AssetGift>>('gifts', 'limbus-assets', 'gifts.json');
	const mjList = readJson<MjGift[]>('gifts', 'limbus-data-mj', 'gifts.json');
	const mj = new Map(mjList.map((g) => [g.id, g]));

	// **원본은 죄악이 아니라 색을 기록한다.** 정본(`limbus-assets`)의 `affinity` 는 그 색을
	// 죄악으로 되바꾼 값이라 원본 어휘가 아니다. 색을 그대로 담은 곳은 보강 출처의
	// `gifts_detail.json` 뿐이므로 거기서 가져온다. 변환은 우리가 하지 않는다.
	const mjDetail = toRecords(
		readJson<Record<string, { id: number; attributeType?: string }>>(
			'gifts',
			'limbus-data-mj',
			'gifts_detail.json',
		),
	);
	const attributeById = new Map(
		mjDetail
			.filter((d) => d.attributeType)
			.map((d) => [d.id, d.attributeType as string] as const),
	);

	const gift: Array<{
		id: number;
		tier: string;
		keywordId: string | null;
		attributeType: string | null;
		enhanceable: boolean;
		hardOnly: boolean;
		mdCost: number | null;
		sprite: string;
	}> = [];

	// 효과·발동 토큰. 해석하지 않고 원본 문자열 그대로 담는다(06-recommendation-engine).
	const token: Array<{ giftId: number; kind: string; index: number; token: string }> = [];
	let noToken = 0;

	const giftText: Array<{
		giftId: number;
		locale: Locale;
		enhanceLevel: number;
		name: string;
		desc: string;
		descRaw: string;
	}> = [];

	const exclusive: Array<{ giftId: number; packId: string }> = [];
	const recipes: Array<{ id: string; resultGiftId: number; index: number }> = [];
	const slots: Array<{ recipeId: string; index: number; count: number }> = [];
	const options: Array<{ recipeId: string; slotIndex: number; giftId: number }> = [];

	let missingCost = 0;
	let missingAttribute = 0;

	for (const [key, g] of Object.entries(assets)) {
		const id = Number(key);
		const supplement = mj.get(id);
		if (supplement?.cost === undefined) missingCost += 1;
		if (!attributeById.has(id)) missingAttribute += 1;

		gift.push({
			id,
			tier: String(g.tier),
			keywordId: normalizeKeyword(g.keyword),
			// 보강 출처에 없는 15종은 비운다. 정본의 죄악 값을 색으로 되돌려 채우지 않는다.
			attributeType: attributeById.get(id) ?? null,
			enhanceable: g.enhanceable === true,
			hardOnly: g.hardonly === true,
			mdCost: supplement?.cost ?? null,
			sprite: g.srcPath,
		});

		(g.effects ?? []).forEach((t, index) => token.push({ giftId: id, kind: 'effect', index, token: t }));
		(g.triggers ?? []).forEach((t, index) => token.push({ giftId: id, kind: 'trigger', index, token: t }));
		if ((g.effects ?? []).length === 0 && (g.triggers ?? []).length === 0) noToken += 1;

		// 강화 단계 수는 정본의 names 배열 길이로 정한다.
		for (let level = 0; level < g.names.length; level += 1) {
			const locId = String(id + ENHANCE_ID_STRIDE * level);
			for (const locale of LOCALES) {
				const hit = lookupTerm(ctx.terms[locale], locId, ['gifts']);
				const rawName = hit?.name ?? g.names[level] ?? g.names[0] ?? '';
				const rawDesc = hit?.desc ?? g.descs?.[level] ?? '';
				giftText.push({
					giftId: id,
					locale,
					enhanceLevel: level,
					name: stripMarkup(rawName),
					desc: toDisplay(rawDesc, ctx.tokens[locale], ctx.report, `gift:${locId}`),
					descRaw: rawDesc,
				});
				if (locale === 'ko' && hit === undefined) {
					ctx.report.note('기프트 한국어 결손(영문 유지)', `단계 ${level}`, String(id));
				}
			}
		}

		for (const packId of g.exclusiveTo ?? []) {
			exclusive.push({ giftId: id, packId: String(packId) });
		}

		// 레시피 하나가 슬롯 배열이고, 슬롯은 단일 기프트이거나 대체 가능한 묶음이다.
		(g.recipes ?? []).forEach((recipe, recipeIndex) => {
			const recipeId = `${id}_${recipeIndex}`;
			recipes.push({ id: recipeId, resultGiftId: id, index: recipeIndex });
			recipe.forEach((slot, slotIndex) => {
				const { count, giftIds } =
					typeof slot === 'string'
						? { count: 1, giftIds: [slot] }
						: { count: slot.count ?? 1, giftIds: slot.options ?? [] };
				slots.push({ recipeId, index: slotIndex, count });
				for (const materialId of giftIds) {
					const material = Number(materialId);
					if (!(String(material) in assets)) {
						ctx.report.unmapped('합성 재료가 기프트 목록에 없음', materialId, recipeId);
						continue;
					}
					options.push({ recipeId, slotIndex, giftId: material });
				}
			});
		});
	}

	// 팩 전체 풀은 mj 에만 있다. 정본에 없는 관계이므로 보강으로 채운다.
	const giftPack: Array<{ giftId: number; packId: string }> = [];
	let missingPool = 0;
	for (const key of Object.keys(assets)) {
		const id = Number(key);
		const packs = mj.get(id)?.packs;
		if (packs === undefined) {
			missingPool += 1;
			continue;
		}
		for (const packId of packs) giftPack.push({ giftId: id, packId: String(packId) });
	}

	ctx.report.rows('gift', gift.length);
	ctx.report.rows('gift_text', giftText.length);
	ctx.report.rows('gift_pack', giftPack.length);
	ctx.report.rows('gift_exclusive_pack', exclusive.length);
	ctx.report.rows('fusion_recipe', recipes.length);
	ctx.report.rows('fusion_slot', slots.length);
	ctx.report.rows('fusion_slot_option', options.length);

	if (missingCost > 0) ctx.report.note('MD 코스트 결손(보강 출처에 없음)', `${missingCost}종`);
	if (missingAttribute > 0)
		ctx.report.note('색 속성 결손(보강 출처에 없음)', `${missingAttribute}종`);
	ctx.report.rows('gift_token', token.length);
	if (noToken > 0) ctx.report.note('효과·발동 토큰이 없는 기프트', `${noToken}종`);
	if (missingPool > 0) ctx.report.note('팩 전체 풀 결손(보강 출처에 없음)', `${missingPool}종`);

	return { gift, giftText, token, giftPack, exclusive, recipes, slots, options };
}
