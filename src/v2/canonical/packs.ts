/**
 * 거울 던전 테마 팩 117종.
 *
 * 정본은 limbus-data-mj 다. 마스터북 팩 편 실측에서 단독 보유 개념이
 * mj 6 · assets 2 · loc 1 로 mj 쪽으로 쏠렸다 — ADR-04 의 「거울 던전 구성 =
 * limbus-assets」 문장과 어긋난다(backlog/09).
 *
 * 예외 하나 — 층별 등장 팩(floor_pack)은 assets md_floor_packs 가 정본이다.
 * 구간 단위 테이블이 원본 형태에 가깝다(ADR-04 2.1).
 */
import { arr, bool, num, str, strArr, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const EVIDENCE = 'docs/data/pack/00-overview.md';

/** `{ hard: { "1": [...], "6-10": [...] }, normal: { ... } }` */
export type FloorTable = Record<string, Record<string, string[]>>;

export interface PackInput {
	mjPacks: RawIndex;
	mjDetail: RawIndex;
	assets: RawIndex;
	floorTable: FloorTable;
	locKo: RawIndex;
	locEn: RawIndex;
	locJa: RawIndex;
}

export interface PackRow {
	id: string;
	category: string;
	chapter: number | null;
	variant: string | null;
	sprite: string;
	overlaySprite: string | null;
	superposition: boolean;
	extreme: boolean;
	bokgak: boolean;
	floorLength: number;
	textColor: string | null;
	unlockCode: number | null;
}

export interface PackTextRow {
	packId: string;
	locale: 'ko' | 'en' | 'ja';
	name: string;
}

export interface PackTagRow {
	packId: string;
	tag: string;
}

export interface PackCategoryPathRow {
	packId: string;
	depth: number;
	value: string;
}

export interface FloorPackRow {
	difficulty: string;
	floorRange: string;
	packId: string;
}

export interface PackTables {
	pack: PackRow[];
	packText: PackTextRow[];
	packTag: PackTagRow[];
	packCategoryPath: PackCategoryPathRow[];
	floorPack: FloorPackRow[];
}

/** mj 단독 개념. 대조할 상대가 없으므로 규칙이 고정이다. */
const MJ_ONLY_FIELDS = [
	'category',
	'chapter',
	'variant',
	'superposition',
	'extreme',
	'bokgak',
	'floorLength',
] as const;

export function buildPacks(input: PackInput, meta: Meta): PackTables {
	const pack: PackRow[] = [];
	const packText: PackTextRow[] = [];
	const packTag: PackTagRow[] = [];
	const packCategoryPath: PackCategoryPathRow[] = [];

	for (const [id, mj] of input.mjPacks) {
		const assets = input.assets.get(id) ?? {};
		const detail = input.mjDetail.get(id) ?? {};

		// ── sprite — 두 출처가 같아야 한다. 실측 117/117 일치 ──────────
		const sprite = str(mj, 'sprite');
		if (sprite === null) throw new Error(`팩 ${id} 에 sprite 가 없다`);
		const image = str(assets, 'image');
		meta.source(
			'pack',
			id,
			'sprite',
			image === null ? 'mj-only' : image === sprite ? 'agreed' : 'disagreed',
			image === null ? [MJ] : [MJ, ASSETS],
		);

		// ── textColor — 61건 결손 ────────────────────────────────────
		const textColor = str(mj, 'textColor');
		if (textColor === null) {
			meta.gap('pack', id, 'textColor', 'mj packs.json 에 값이 없다 (56/117 만 보유)', EVIDENCE);
		} else {
			meta.source('pack', id, 'textColor', 'mj-only', [MJ]);
		}

		// ── unlockCode — 2건 결손 ───────────────────────────────────
		const unlockRaw = detail['unlock'];
		const unlockCode =
			typeof unlockRaw === 'object' && unlockRaw !== null && !Array.isArray(unlockRaw)
				? num(unlockRaw as Record<string, unknown>, 'unlockCode')
				: null;
		if (unlockCode === null) {
			meta.gap('pack', id, 'unlockCode', 'packs_detail.unlock 에 값이 없다', EVIDENCE);
		} else {
			meta.source('pack', id, 'unlockCode', 'mj-only', [MJ]);
		}

		const category = str(mj, 'category');
		if (category === null) throw new Error(`팩 ${id} 에 category 가 없다`);
		const floorLength = num(mj, 'floorLength');
		if (floorLength === null) throw new Error(`팩 ${id} 에 floorLength 가 없다`);

		const overlaySprite = str(assets, 'overlayImage');
		if (overlaySprite !== null) meta.source('pack', id, 'overlaySprite', 'assets-only', [ASSETS]);

		pack.push({
			id,
			category,
			chapter: num(mj, 'chapter'),
			variant: str(mj, 'variant'),
			sprite,
			overlaySprite,
			superposition: bool(mj, 'superposition'),
			extreme: bool(mj, 'extreme'),
			bokgak: bool(mj, 'bokgak'),
			floorLength,
			textColor,
			unlockCode,
		});

		for (const field of MJ_ONLY_FIELDS) meta.source('pack', id, field, 'mj-only', [MJ]);

		// ── 표시명 ──────────────────────────────────────────────────
		// ko 는 mj 가 이긴다. 1309 「감정 앞에 게으른 것 」의 loc 후행 공백을 피한다.
		pushText(packText, meta, id, 'ko', str(mj, 'nameKo'), str(input.locKo.get(id) ?? {}, 'name'), MJ);
		pushText(
			packText,
			meta,
			id,
			'en',
			str(input.locEn.get(id) ?? {}, 'name'),
			str(mj, 'name'),
			'loc-en',
		);
		pushText(packText, meta, id, 'ja', str(input.locJa.get(id) ?? {}, 'name'), null, 'loc-ja');

		// ── assets 단독 ─────────────────────────────────────────────
		const tags = strArr(assets, 'tags');
		for (const tag of tags) packTag.push({ packId: id, tag });
		if (tags.length > 0) meta.source('pack', id, 'tags', 'assets-only', [ASSETS]);

		const path = arr(assets, 'category');
		path.forEach((value, depth) => {
			packCategoryPath.push({ packId: id, depth, value: String(value) });
		});
		if (path.length > 0) meta.source('pack', id, 'categoryPath', 'assets-only', [ASSETS]);
	}

	// ── 층별 등장 팩 — assets 가 정본 ────────────────────────────────
	const known = new Set(pack.map((p) => p.id));
	const floorPack: FloorPackRow[] = [];
	for (const [difficulty, ranges] of Object.entries(input.floorTable)) {
		for (const [floorRange, packIds] of Object.entries(ranges)) {
			for (const raw of packIds) {
				const packId = String(raw);
				if (!known.has(packId)) {
					meta.gap(
						'pack',
						packId,
						'floorPack',
						`층 테이블(${difficulty} ${floorRange})이 팩 목록에 없는 id 를 가리킨다`,
						EVIDENCE,
					);
					continue;
				}
				floorPack.push({ difficulty, floorRange, packId });
			}
		}
	}

	return { pack, packText, packTag, packCategoryPath, floorPack };
}

/**
 * 표시명 한 로케일. 정본이 없으면 폴백을 쓰고, 둘 다 없으면 **행을 만들지 않는다.**
 * 소비 측이 폴백을 판정할 수 있어야 한다(ADR-03 5절).
 */
function pushText(
	out: PackTextRow[],
	meta: Meta,
	packId: string,
	locale: 'ko' | 'en' | 'ja',
	primary: string | null,
	fallback: string | null,
	primarySource: string,
): void {
	const name = primary ?? fallback;
	if (name === null) {
		meta.gap('pack', packId, 'name', `${locale} 표시명이 어느 출처에도 없다`, EVIDENCE, locale);
		return;
	}
	out.push({ packId, locale, name });
	meta.source(
		'pack',
		packId,
		`name.${locale}`,
		primary !== null ? `${primarySource}-primary` : 'fallback',
		[primarySource],
	);
}
