/**
 * 변환기 — 원본 3출처를 우리 스키마로 정규화한다.
 *
 * ADR-01 제약 1  파일 하나가 테이블 하나에 대응한다
 * ADR-02 원칙 1  매핑되지 않은 입력은 버리지 않고 리포트한다
 * ADR-02 원칙 2  전체를 재생성한다. 증분 갱신을 하지 않는다
 * ADR-02 원칙 3  같은 입력이면 같은 결과가 나온다
 * ADR-04         엔티티마다 정본이 하나이고 보강은 선언된 것만 허용한다
 *
 * 실행: npm run convert
 */
import { writeTable, OUT } from './io.js';
import { Report } from './report.js';
import { buildTokenTable, buildTriggerTable, collectLocale, type LocaleIndex } from './text.js';
import {
	buildSins,
	buildKeywords,
	buildAffiliations,
	buildStatuses,
	type Ctx,
} from './entities/basics.js';
import { buildGifts } from './entities/gifts.js';
import { buildPacks } from './entities/packs.js';
import { buildIdentities } from './entities/identities.js';
import { buildSkills } from './entities/skills.js';
import {
	buildEgos,
	buildMirrorDungeon,
	buildEncounters,
	buildDataset,
} from './entities/egos.js';

function main(): void {
	const report = new Report();

	// 로케일 표제어를 먼저 모은다. 치환표와 표시 문자열이 모두 이것에 의존한다.
	const terms = { ko: collectLocale('loc-ko', report), en: collectLocale('loc-en', report) };
	const tokens = { ko: buildTokenTable(terms.ko), en: buildTokenTable(terms.en) };
	// 스킬 설명문은 어휘가 하나 더 있다. 상태 표 위에 발동 시점 표기를 얹는다.
	const triggers = {
		ko: buildTriggerTable(tokens.ko, 'ko', report),
		en: buildTriggerTable(tokens.en, 'en', report),
	};
	const termCount = (i: LocaleIndex) => [...i.values()].reduce((n, m) => n + m.size, 0);
	console.log(`로케일 표제어: 한국어 ${termCount(terms.ko)}종 · 영어 ${termCount(terms.en)}종`);

	const ctx: Ctx = { report, tokens, triggers, terms };

	const sins = buildSins(ctx);
	writeTable('sin_info', sins.rows);
	writeTable('sin_text', sins.texts);

	const keywords = buildKeywords(ctx);
	writeTable('keyword', keywords.rows);
	writeTable('keyword_text', keywords.texts);

	const affiliations = buildAffiliations(ctx);
	writeTable('affiliation', affiliations.rows);
	writeTable('affiliation_text', affiliations.texts);

	const statuses = buildStatuses(ctx);
	writeTable('status', statuses.rows);
	writeTable('status_text', statuses.texts);

	const gifts = buildGifts(ctx);
	writeTable('gift', gifts.gift);
	writeTable('gift_text', gifts.giftText);
	writeTable('gift_pack', gifts.giftPack);
	writeTable('gift_exclusive_pack', gifts.exclusive);
	writeTable('fusion_recipe', gifts.recipes);
	writeTable('fusion_slot', gifts.slots);
	writeTable('fusion_slot_option', gifts.options);

	const ids = buildIdentities(ctx);
	writeTable('sinner', ids.sinner);
	writeTable('sinner_text', ids.sinnerText);
	writeTable('identity', ids.identity);
	writeTable('identity_text', ids.identityText);
	writeTable('identity_resist', ids.resists);
	writeTable('identity_speed', ids.speeds);
	writeTable('identity_affiliation', ids.affiliations);
	writeTable('identity_status', ids.statuses);

	const skills = buildSkills(ctx);
	writeTable('skill', skills.skill);
	writeTable('skill_stage', skills.stage);
	writeTable('skill_coin', skills.coin);
	writeTable('skill_stage_text', skills.stageText);
	writeTable('skill_coin_text', skills.coinText);
	writeTable('passive', skills.passive);
	writeTable('passive_requirement', skills.passiveReq);
	writeTable('passive_text', skills.passiveText);
	writeTable('identity_passive', skills.identityPassive);

	const packs = buildPacks(ctx);
	writeTable('pack', packs.pack);
	writeTable('pack_text', packs.packText);
	writeTable('pack_boss_encounter', packs.bosses);
	writeTable('floor_pack', packs.floorPack);

	const egos = buildEgos(ctx);
	writeTable('ego', egos.ego);
	writeTable('ego_text', egos.egoText);
	writeTable('ego_cost', egos.cost);
	writeTable('ego_resist', egos.resist);
	writeTable('ego_status', egos.status);
	writeTable('ego_passive', egos.passive);
	writeTable('ego_passive_text', egos.passiveText);

	const md = buildMirrorDungeon(ctx);
	writeTable('mirror_dungeon', md.dungeon);
	writeTable('mirror_dungeon_text', md.dungeonText);
	writeTable('grace_option', md.grace);
	writeTable('grace_option_text', md.graceText);

	const enc = buildEncounters(ctx);
	writeTable('encounter', enc.rows);
	writeTable('encounter_target', enc.targets);
	writeTable('encounter_target_text', enc.targetText);

	const version = md.dungeon[0]?.version ?? 'unknown';
	writeTable('dataset', buildDataset(ctx, version));

	console.log(`\n산출 위치: ${OUT}\n`);
	console.log(report.format());

	// 게이트는 판정까지 해야 게이트다. 리포트만 찍고 성공으로 끝나면 후속 단계가
	// 미분류 입력을 안은 채 그대로 적재한다.
	if (report.hasUnmapped) {
		console.error('\n처리하지 못한 입력이 있다. 적재 전에 해소해야 한다.');
		process.exitCode = 1;
	}
}

main();
