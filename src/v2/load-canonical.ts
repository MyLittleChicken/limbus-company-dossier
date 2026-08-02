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
import { buildSinners } from './canonical/sinners.js';
import { buildSkills } from './canonical/skills.js';
import { buildIdentities } from './canonical/identities.js';
import { buildEgos } from './canonical/egos.js';
import { buildStatuses } from './canonical/statuses.js';
import { parseCoinTokens } from './canonical/tokens.js';
import { buildMirror } from './canonical/mirror.js';
import { buildEncounters } from './canonical/encounters.js';
import { applyTextOverrides, applyColumnOverrides, type OverrideRow } from './canonical/override.js';

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

		// ── 상태·어휘 계열 ─────────────────────────────────────────
		// 인격·E.G.O 보다 먼저 만든다 — 둘이 상태로 외래 키를 건다.
		const mech = (locale: string, prefix: string) =>
			readSourceGroup(prisma, snapshotId, 'mechanics', `loc-${locale}`, { startsWith: [prefix] });

		const statuses = buildStatuses(
			{
				assets: await readSource(prisma, snapshotId, 'mechanics/limbus-assets/statuses.json'),
				bufsKo: await mech('ko', 'Bufs'),
				bufsEn: await mech('en', 'Bufs'),
				bufsJa: await mech('ja', 'Bufs'),
				bkKo: await mech('ko', 'BattleKeywords'),
				bkEn: await mech('en', 'BattleKeywords'),
				bkJa: await mech('ja', 'BattleKeywords'),
				terms: await readSource(prisma, snapshotId, 'mechanics/limbus-data-mj/terms.json'),
				sins: await readSource(prisma, snapshotId, 'mechanics/limbus-data-mj/sins.json'),
			},
			meta,
		);
		const knownStatuses = new Set(statuses.status.map((x) => x.id));

		// ── 인격 계열 ──────────────────────────────────────────────
		const idKo = await readSourceGroup(prisma, snapshotId, 'identities', 'loc-ko');
		const idEn = await readSourceGroup(prisma, snapshotId, 'identities', 'loc-en');
		const idJa = await readSourceGroup(prisma, snapshotId, 'identities', 'loc-ja');

		const mjIdentities = await readSource(prisma, snapshotId, 'identities/limbus-data-mj/identities.json');
		const sinners = buildSinners(
			{
				mjIdentities,
				associations: await readSource(prisma, snapshotId, 'identities/limbus-data-mj/associations.json'),
				unitKeywordJa: idJa,
			},
			meta,
		);

		const skills = buildSkills(
			{
				mjSkills: await readSource(prisma, snapshotId, 'identities/limbus-data-mj/skills.json'),
				locKo: idKo,
				locEn: idEn,
				locJa: idJa,
			},
			meta,
		);

		const mjPassives = await readSource(prisma, snapshotId, 'identities/limbus-data-mj/passives.json');
		const identities = buildIdentities(
			{
				mj: mjIdentities,
				mjDetail: await readSource(prisma, snapshotId, 'identities/limbus-data-mj/identities_detail.json'),
				assets: await readSource(prisma, snapshotId, 'identities/limbus-assets/identities.json'),
				mjPassives,
				locKo: idKo,
				locEn: idEn,
				locJa: idJa,
				passiveKo: idKo,
				passiveEn: idEn,
				passiveJa: idJa,
				knownSkills: new Set(skills.skill.map((s) => s.id)),
				knownAssociations: new Set(sinners.association.map((a) => a.id)),
				knownKeywords: new Set(vocab.keyword.map((k) => k.id)),
				keywordDict: buildKeywordLookup(categoryEn),
				knownStatuses,
			},
			meta,
		);

		// ── E.G.O 계열 ─────────────────────────────────────────────
		// **파일명으로 가른다.** E.G.O 는 각성 스킬과 패시브가 같은 번호를 쓴다
		// (실측 교집합 110건) — id 자릿수로 가르면 한쪽이 다른 쪽을 덮어쓴다.
		const egoLoc = (locale: string, prefix: string) =>
			readSourceGroup(prisma, snapshotId, 'egos', `loc-${locale}`, { startsWith: [prefix] });

		const egos = buildEgos(
			{
				mj: await readSource(prisma, snapshotId, 'egos/limbus-data-mj/egos.json'),
				mjDetail: await readSource(prisma, snapshotId, 'egos/limbus-data-mj/egos_detail.json'),
				assets: await readSource(prisma, snapshotId, 'egos/limbus-assets/egos.json'),
				locEgoKo: await egoLoc('ko', 'Egos'),
				locEgoEn: await egoLoc('en', 'Egos'),
				locEgoJa: await egoLoc('ja', 'Egos'),
				locSkillKo: await egoLoc('ko', 'Skills_Ego'),
				locSkillEn: await egoLoc('en', 'Skills_Ego'),
				locSkillJa: await egoLoc('ja', 'Skills_Ego'),
				locPassiveKo: await egoLoc('ko', 'Passive_Ego'),
				locPassiveEn: await egoLoc('en', 'Passive_Ego'),
				locPassiveJa: await egoLoc('ja', 'Passive_Ego'),
				knownSinners: new Set(sinners.sinner.map((s) => s.id)),
				knownStatuses,
			},
			meta,
		);

		// ── 거울 던전 구성 ─────────────────────────────────────────
		const mdAsset = (f: string) =>
			readSource(prisma, snapshotId, `mirror-dungeon/limbus-assets/${f}`);
		const evLoc = (locale: string) =>
			readSourceGroup(prisma, snapshotId, 'mirror-dungeon', `loc-${locale}`, {
				startsWith: ['ActionEvents_Mirror', 'AbEvents_Mirror'],
			});
		const knownGifts = new Set(gifts.gift.map((g) => g.id));
		const mirror = buildMirror(
			{
				choiceEvents: await mdAsset('md_choice_events.json'),
				achievements: await mdAsset('md__achievements.json'),
				achievementsMd6: await mdAsset('md__md6__achievements.json'),
				rewards: await mdAsset('md__rewards.json'),
				rewardsMd6: await mdAsset('md__md6__rewards.json'),
				details: await mdAsset('md__details.json'),
				eventLocKo: await evLoc('ko'),
				eventLocEn: await evLoc('en'),
				eventLocJa: await evLoc('ja'),
				knownGifts,
				knownKeywords: new Set(vocab.keyword.map((k) => k.id)),
				keywordDict: buildKeywordLookup(categoryEn),
			},
			meta,
		);

		// ── 인카운터 ───────────────────────────────────────────────
		const enemyLocOf = (locale: string) =>
			readSourceGroup(prisma, snapshotId, 'encounters', `loc-${locale}`);
		const encounters = buildEncounters(
			{
				encounters: await readSourceGroup(prisma, snapshotId, 'encounters', 'limbus-assets'),
				groups: await mdAsset('encounters.json'),
				enemyKo: await enemyLocOf('ko'),
				enemyEn: await enemyLocOf('en'),
				enemyJa: await enemyLocOf('ja'),
				knownPacks: new Set(tables.pack.map((p) => p.id)),
				packs: await readSource(prisma, snapshotId, 'packs/limbus-assets/md_theme_packs.json'),
			},
			meta,
		);

		// ── 코인 토큰 분해 — 스펙 6절 「그래프 파생을 위한 조건」 ────────
		// 원문은 skill_coin.effects 에 그대로 남는다. 이것은 분해 결과다.
		const coinToken: Array<{
			skillId: string; uptie: number; coinIdx: number; ordinal: number;
			token: string; kind: string; amount: number | null; statusId: string | null;
		}> = [];
		for (const coin of skills.skillCoin) {
			let ordinal = 0;
			for (const effect of coin.effects) {
				for (const parsed of parseCoinTokens(effect)) {
					const isStatus = knownStatuses.has(parsed.token);
					coinToken.push({
						skillId: coin.skillId,
						uptie: coin.uptie,
						coinIdx: coin.index,
						ordinal,
						token: parsed.token,
						kind: isStatus ? 'status' : 'timing',
						amount: parsed.amount,
						statusId: isStatus ? parsed.token : null,
					});
					ordinal += 1;
				}
			}
		}

		// ── 수동 보정 — 적재의 마지막 판정 ─────────────────────────
		// app.field_override 는 TRUNCATE 범위 밖이라 재적재에 살아남는다.
		// 여기서 canonical 위에 덮고 field_source.rule = 'manual' 로 남긴다.
		const overrides: OverrideRow[] = (
			await prisma.fieldOverride.findMany({
				select: { entity: true, entityId: true, field: true, locale: true, value: true, note: true },
			})
		).map((o) => ({ ...o, value: o.value as unknown }));
		if (overrides.length > 0) console.log(`수동 보정 ${overrides.length}건을 덮는다`);

		statuses.statusText = applyTextOverrides(
			statuses.statusText, overrides,
			{ entity: 'status', idKey: 'statusId', field: 'name' }, meta,
		);
		gifts.giftStageText = applyTextOverrides(
			gifts.giftStageText, overrides,
			{ entity: 'gift', idKey: 'giftId', field: 'name' }, meta,
		);
		tables.packText = applyTextOverrides(
			tables.packText, overrides,
			{ entity: 'pack', idKey: 'packId', field: 'name' }, meta,
		);
		encounters.enemyText = applyTextOverrides(
			encounters.enemyText, overrides,
			{ entity: 'enemy', idKey: 'enemyId', field: 'name' }, meta,
		);
		tables.pack = applyColumnOverrides(
			tables.pack, overrides, { entity: 'pack', idKey: 'id' }, meta,
		);

		// canonical 만 비운다. **raw 도 app 도 건드리지 않는다.**
		await prisma.$executeRaw`
			TRUNCATE canonical.pack, canonical.gift, canonical.keyword, canonical.trigger,
			         canonical.effect, canonical.sinner, canonical.association,
			         canonical.skill, canonical.passive, canonical.identity,
			         canonical.ego, canonical.ego_passive,
			         canonical.status, canonical.sin_info, canonical.term,
			         canonical.choice_event, canonical.achievement, canonical.reward,
			         canonical.adversity, canonical.grace, canonical.encounter, canonical.enemy,
			         canonical.field_gap, canonical.field_source,
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

		// ── 상태·어휘 적재 — 인격·E.G.O 보다 먼저 ──────────────────
		counts.push(['status', await chunked(statuses.status, (d) => prisma.status.createMany({ data: d as never }))]);
		counts.push(['status_text', await chunked(statuses.statusText, (d) => prisma.statusText.createMany({ data: d as never }))]);
		counts.push(['status_category', await chunked(statuses.statusCategory, (d) => prisma.statusCategory.createMany({ data: d }))]);
		counts.push(['sin_info', await chunked(statuses.sinInfo, (d) => prisma.sinInfo.createMany({ data: d as never }))]);
		counts.push(['sin_text', await chunked(statuses.sinText, (d) => prisma.sinText.createMany({ data: d as never }))]);
		counts.push(['term', await chunked(statuses.term, (d) => prisma.term.createMany({ data: d }))]);
		counts.push(['term_text', await chunked(statuses.termText, (d) => prisma.termText.createMany({ data: d as never }))]);

		// ── 인격 계열 적재 — 뿌리부터 ─────────────────────────────
		counts.push(['sinner', (await prisma.sinner.createMany({ data: sinners.sinner })).count]);
		counts.push(['sinner_text', await chunked(sinners.sinnerText, (d) => prisma.sinnerText.createMany({ data: d as never }))]);
		counts.push(['association', (await prisma.association.createMany({ data: sinners.association })).count]);
		counts.push(['association_text', await chunked(sinners.associationText, (d) => prisma.associationText.createMany({ data: d as never }))]);

		counts.push(['skill', await chunked(skills.skill, (d) => prisma.skill.createMany({ data: d as never }))]);
		counts.push(['skill_stage', await chunked(skills.skillStage, (d) => prisma.skillStage.createMany({ data: d }))]);
		counts.push(['skill_stage_text', await chunked(skills.skillStageText, (d) => prisma.skillStageText.createMany({ data: d as never }))]);
		counts.push(['skill_coin', await chunked(skills.skillCoin, (d) => prisma.skillCoin.createMany({ data: d }))]);

		counts.push(['passive', await chunked(identities.passive, (d) => prisma.passive.createMany({ data: d }))]);
		counts.push(['passive_text', await chunked(identities.passiveText, (d) => prisma.passiveText.createMany({ data: d as never }))]);

		counts.push(['identity', await chunked(identities.identity, (d) => prisma.identity.createMany({ data: d }))]);
		counts.push(['identity_text', await chunked(identities.identityText, (d) => prisma.identityText.createMany({ data: d as never }))]);
		counts.push(['identity_resist', await chunked(identities.identityResist, (d) => prisma.identityResist.createMany({ data: d as never }))]);
		counts.push(['identity_speed', await chunked(identities.identitySpeed, (d) => prisma.identitySpeed.createMany({ data: d }))]);
		counts.push(['identity_skill', await chunked(identities.identitySkill, (d) => prisma.identitySkill.createMany({ data: d }))]);
		counts.push(['identity_passive', await chunked(identities.identityPassive, (d) => prisma.identityPassive.createMany({ data: d }))]);
		counts.push(['identity_association', await chunked(identities.identityAssociation, (d) => prisma.identityAssociation.createMany({ data: d }))]);
		counts.push(['identity_keyword', await chunked(identities.identityKeyword, (d) => prisma.identityKeyword.createMany({ data: d }))]);
		counts.push(['identity_status', await chunked(identities.identityStatus, (d) => prisma.identityStatus.createMany({ data: d }))]);
		counts.push(['coin_token', await chunked(coinToken, (d) => prisma.coinToken.createMany({ data: d }))]);
		counts.push(['identity_unit_keyword', await chunked(identities.identityUnitKeyword, (d) => prisma.identityUnitKeyword.createMany({ data: d }))]);

		// ── E.G.O 계열 적재 ───────────────────────────────────────
		counts.push(['ego_passive', await chunked(egos.egoPassive, (d) => prisma.egoPassive.createMany({ data: d }))]);
		counts.push(['ego_passive_text', await chunked(egos.egoPassiveText, (d) => prisma.egoPassiveText.createMany({ data: d as never }))]);
		counts.push(['ego', await chunked(egos.ego, (d) => prisma.ego.createMany({ data: d as never }))]);
		counts.push(['ego_text', await chunked(egos.egoText, (d) => prisma.egoText.createMany({ data: d as never }))]);
		counts.push(['ego_resist', await chunked(egos.egoResist, (d) => prisma.egoResist.createMany({ data: d as never }))]);
		counts.push(['ego_cost', await chunked(egos.egoCost, (d) => prisma.egoCost.createMany({ data: d as never }))]);
		counts.push(['ego_corrosion', await chunked(egos.egoCorrosion, (d) => prisma.egoCorrosion.createMany({ data: d }))]);
		counts.push(['ego_requirement', await chunked(egos.egoRequirement, (d) => prisma.egoRequirement.createMany({ data: d }))]);
		counts.push(['ego_skill', await chunked(egos.egoSkill, (d) => prisma.egoSkill.createMany({ data: d }))]);
		counts.push(['ego_skill_stage', await chunked(egos.egoSkillStage, (d) => prisma.egoSkillStage.createMany({ data: d }))]);
		counts.push(['ego_skill_stage_text', await chunked(egos.egoSkillStageText, (d) => prisma.egoSkillStageText.createMany({ data: d as never }))]);
		counts.push(['ego_skill_coin', await chunked(egos.egoSkillCoin, (d) => prisma.egoSkillCoin.createMany({ data: d as never }))]);
		counts.push(['ego_passive_link', await chunked(egos.egoPassiveLink, (d) => prisma.egoPassiveLink.createMany({ data: d }))]);
		counts.push(['ego_status', await chunked(egos.egoStatus, (d) => prisma.egoStatus.createMany({ data: d }))]);
		counts.push(['tool_annotation (ego)', await chunked(egos.toolAnnotation, (d) => prisma.toolAnnotation.createMany({ data: d as never }))]);

		// ── 거울 던전·인카운터 적재 ────────────────────────────────
		counts.push(['choice_event', await chunked(mirror.choiceEvent, (d) => prisma.choiceEvent.createMany({ data: d }))]);
		counts.push(['choice_event_text', await chunked(mirror.choiceEventText, (d) => prisma.choiceEventText.createMany({ data: d as never }))]);
		counts.push(['choice_event_gift', await chunked(mirror.choiceEventGift, (d) => prisma.choiceEventGift.createMany({ data: d }))]);
		counts.push(['choice_option', await chunked(mirror.choiceOption, (d) => prisma.choiceOption.createMany({ data: d as never }))]);
		counts.push(['choice_option_text', await chunked(mirror.choiceOptionText, (d) => prisma.choiceOptionText.createMany({ data: d as never }))]);
		counts.push(['achievement', await chunked(mirror.achievement, (d) => prisma.achievement.createMany({ data: d }))]);
		counts.push(['achievement_text', await chunked(mirror.achievementText, (d) => prisma.achievementText.createMany({ data: d as never }))]);
		counts.push(['reward', await chunked(mirror.reward, (d) => prisma.reward.createMany({ data: d }))]);
		counts.push(['adversity', await chunked(mirror.adversity, (d) => prisma.adversity.createMany({ data: d }))]);
		counts.push(['adversity_text', await chunked(mirror.adversityText, (d) => prisma.adversityText.createMany({ data: d as never }))]);
		counts.push(['grace', await chunked(mirror.grace, (d) => prisma.grace.createMany({ data: d }))]);
		counts.push(['grace_text', await chunked(mirror.graceText, (d) => prisma.graceText.createMany({ data: d as never }))]);
		counts.push(['start_gift', await chunked(mirror.startGift, (d) => prisma.startGift.createMany({ data: d }))]);

		counts.push(['encounter', await chunked(encounters.encounter, (d) => prisma.encounter.createMany({ data: d as never }))]);
		counts.push(['encounter_target', await chunked(encounters.encounterTarget, (d) => prisma.encounterTarget.createMany({ data: d }))]);
		counts.push(['encounter_target_part', await chunked(encounters.encounterTargetPart, (d) => prisma.encounterTargetPart.createMany({ data: d }))]);
		counts.push(['encounter_part_resist', await chunked(encounters.encounterPartResist, (d) => prisma.encounterPartResist.createMany({ data: d }))]);
		counts.push(['enemy', await chunked(encounters.enemy, (d) => prisma.enemy.createMany({ data: d }))]);
		counts.push(['enemy_text', await chunked(encounters.enemyText, (d) => prisma.enemyText.createMany({ data: d as never }))]);
		counts.push(['pack_boss_encounter', await chunked(encounters.packBossEncounter, (d) => prisma.packBossEncounter.createMany({ data: d }))]);

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
