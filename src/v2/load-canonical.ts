/**
 * canonical 층 적재기.
 *
 * **파일을 읽지 않는다.** raw.raw_object 를 질의해 만든다(스펙 2.1).
 * 재적재는 canonical 만 비운다 — raw 도 app 도 건드리지 않는다.
 *
 * 실행: npm run v2:canonical
 */
import { PrismaClient } from './generated/client.js';
import { latestSnapshotId, readSource, readSourceGroup } from './source.js';
import { Meta } from './canonical/meta.js';
import { buildPacks, type FloorTable } from './canonical/packs.js';
import { buildVocab, buildKeywordLookup } from './canonical/vocab.js';
import { buildGifts } from './canonical/gifts.js';

const CHUNK = 1_000;

async function chunked<T>(
	rows: T[],
	insert: (part: T[]) => Promise<{ count: number }>,
): Promise<number> {
	let n = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const r = await insert(rows.slice(i, i + CHUNK));
		n += r.count;
	}
	return n;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		const snapshotId = await latestSnapshotId(prisma);
		console.log(`스냅샷 ${snapshotId} 를 읽는다`);

		const meta = new Meta();

		// md_floor_packs.json 은 {hard: {...}, normal: {...}} 이고 값이 전부 객체라
		// 스캔 규칙상 map 으로 분류된다 — 즉 id 가 'hard' · 'normal' 인 두 행이다.
		const floorRaw = await readSource(
			prisma,
			snapshotId,
			'mirror-dungeon/limbus-assets/md_floor_packs.json',
		);
		const floorTable: FloorTable = {};
		for (const [difficulty, ranges] of floorRaw) {
			floorTable[difficulty] = ranges as Record<string, string[]>;
		}

		const tables = buildPacks(
			{
				mjPacks: await readSource(prisma, snapshotId, 'packs/limbus-data-mj/packs.json'),
				mjDetail: await readSource(prisma, snapshotId, 'packs/limbus-data-mj/packs_detail.json'),
				assets: await readSource(prisma, snapshotId, 'packs/limbus-assets/md_theme_packs.json'),
				floorTable,
				locKo: await readSource(prisma, snapshotId, 'packs/loc-ko/MirrorDungeonTheme-1.json'),
				locEn: await readSource(prisma, snapshotId, 'packs/loc-en/MirrorDungeonTheme-1.json'),
				locJa: await readSource(prisma, snapshotId, 'packs/loc-ja/MirrorDungeonTheme-1.json'),
			},
			meta,
		);

		// ── 기프트 계열 ──────────────────────────────────────────────
		// 로케일 기프트는 30파일로 흩어져 있다. 성격이 다른 두 파일은 뺀다.
		const EXCLUDE = ['EgoGiftCategory.json', 'MirrorDungeonEgoGiftLockedDesc.json'];
		const locGift = async (locale: string) =>
			readSourceGroup(prisma, snapshotId, 'gifts', `loc-${locale}`, EXCLUDE);
		const catOf = async (locale: string) =>
			readSource(prisma, snapshotId, `gifts/loc-${locale}/EgoGiftCategory.json`);
		const lockedOf = async (locale: string) =>
			readSource(prisma, snapshotId, `gifts/loc-${locale}/MirrorDungeonEgoGiftLockedDesc.json`);

		const assetGifts = await readSource(prisma, snapshotId, 'gifts/limbus-assets/gifts.json');
		const categoryKo = await catOf('ko');
		const categoryEn = await catOf('en');
		const categoryJa = await catOf('ja');

		const vocab = buildVocab({ categoryKo, categoryEn, categoryJa, assets: assetGifts }, meta);

		const gifts = buildGifts(
			{
				mj: await readSource(prisma, snapshotId, 'gifts/limbus-data-mj/gifts.json'),
				mjDetail: await readSource(prisma, snapshotId, 'gifts/limbus-data-mj/gifts_detail.json'),
				assets: assetGifts,
				locKo: await locGift('ko'),
				locEn: await locGift('en'),
				locJa: await locGift('ja'),
				lockedKo: await lockedOf('ko'),
				lockedEn: await lockedOf('en'),
				lockedJa: await lockedOf('ja'),
				keywordDict: buildKeywordLookup(categoryEn),
				knownPacks: new Set(tables.pack.map((p) => p.id)),
			},
			meta,
		);

		// canonical 만 비운다. raw 도 app 도 건드리지 않는다.
		await prisma.$executeRaw`
			TRUNCATE canonical.pack, canonical.gift, canonical.keyword, canonical.trigger,
			         canonical.effect, canonical.field_gap, canonical.field_source,
			         canonical.tool_annotation CASCADE
		`;

		const counts: Array<[string, number]> = [];
		counts.push(['pack', (await prisma.pack.createMany({ data: tables.pack as never })).count]);
		counts.push([
			'pack_text',
			await chunked(tables.packText, (d) => prisma.packText.createMany({ data: d as never })),
		]);
		counts.push([
			'pack_tag',
			await chunked(tables.packTag, (d) => prisma.packTag.createMany({ data: d })),
		]);
		counts.push([
			'pack_category_path',
			await chunked(tables.packCategoryPath, (d) =>
				prisma.packCategoryPath.createMany({ data: d }),
			),
		]);
		counts.push([
			'floor_pack',
			await chunked(tables.floorPack, (d) => prisma.floorPack.createMany({ data: d as never })),
		]);
		// 어휘 차원이 기프트보다 먼저 서야 외래 키가 선다.
		counts.push(['keyword', (await prisma.keyword.createMany({ data: vocab.keyword })).count]);
		counts.push([
			'keyword_text',
			await chunked(vocab.keywordText, (d) => prisma.keywordText.createMany({ data: d as never })),
		]);
		counts.push(['trigger', (await prisma.trigger.createMany({ data: vocab.trigger })).count]);
		counts.push(['effect', (await prisma.effect.createMany({ data: vocab.effect })).count]);

		counts.push([
			'gift',
			await chunked(gifts.gift, (d) => prisma.gift.createMany({ data: d as never })),
		]);
		counts.push([
			'gift_stage',
			await chunked(gifts.giftStage, (d) => prisma.giftStage.createMany({ data: d })),
		]);
		counts.push([
			'gift_stage_text',
			await chunked(gifts.giftStageText, (d) =>
				prisma.giftStageText.createMany({ data: d as never }),
			),
		]);
		counts.push([
			'gift_effect',
			await chunked(gifts.giftEffect, (d) => prisma.giftEffect.createMany({ data: d })),
		]);
		counts.push([
			'gift_trigger',
			await chunked(gifts.giftTrigger, (d) => prisma.giftTrigger.createMany({ data: d })),
		]);
		counts.push([
			'gift_pack',
			await chunked(gifts.giftPack, (d) => prisma.giftPack.createMany({ data: d })),
		]);
		counts.push([
			'gift_exclusive_pack',
			await chunked(gifts.giftExclusivePack, (d) =>
				prisma.giftExclusivePack.createMany({ data: d }),
			),
		]);
		counts.push([
			'gift_requirement',
			await chunked(gifts.giftRequirement, (d) =>
				prisma.giftRequirement.createMany({ data: d as never }),
			),
		]);
		counts.push([
			'fusion_recipe',
			await chunked(gifts.fusionRecipe, (d) => prisma.fusionRecipe.createMany({ data: d })),
		]);
		counts.push([
			'fusion_slot',
			await chunked(gifts.fusionSlot, (d) => prisma.fusionSlot.createMany({ data: d })),
		]);
		counts.push([
			'fusion_slot_option',
			await chunked(gifts.fusionSlotOption, (d) =>
				prisma.fusionSlotOption.createMany({ data: d }),
			),
		]);
		counts.push([
			'gift_locked_desc',
			await chunked(gifts.giftLockedDesc, (d) =>
				prisma.giftLockedDesc.createMany({ data: d as never }),
			),
		]);
		counts.push([
			'tool_annotation',
			await chunked(gifts.toolAnnotation, (d) =>
				prisma.toolAnnotation.createMany({ data: d as never }),
			),
		]);

		counts.push([
			'field_gap',
			await chunked(meta.gaps, (d) => prisma.fieldGap.createMany({ data: d })),
		]);
		counts.push([
			'field_source',
			await chunked(meta.sources, (d) => prisma.fieldSource.createMany({ data: d })),
		]);

		console.log('');
		for (const [t, n] of counts) console.log(`  ${t.padEnd(22)} ${String(n).padStart(6)}`);

		const s = meta.summary();
		console.log('');
		console.log('판정 규칙별:', JSON.stringify(s.byRule));
		console.log('결손 필드별:', JSON.stringify(s.gapsByField));
	} finally {
		await prisma.$disconnect();
	}
}

await main();
