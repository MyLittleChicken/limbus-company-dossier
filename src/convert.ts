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
import { buildTokenTable, collectLocale } from './text.js';
import {
	buildSins,
	buildKeywords,
	buildAffiliations,
	buildStatuses,
	type Ctx,
} from './entities/basics.js';
import { buildGifts } from './entities/gifts.js';
import { buildPacks } from './entities/packs.js';

function main(): void {
	const report = new Report();

	// 로케일 표제어를 먼저 모은다. 치환표와 표시 문자열이 모두 이것에 의존한다.
	const terms = { ko: collectLocale('loc-ko'), en: collectLocale('loc-en') };
	const tokens = { ko: buildTokenTable(terms.ko), en: buildTokenTable(terms.en) };
	console.log(`로케일 표제어: 한국어 ${terms.ko.size}종 · 영어 ${terms.en.size}종`);

	const ctx: Ctx = { report, tokens, terms };

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

	const packs = buildPacks(ctx);
	writeTable('pack', packs.pack);
	writeTable('pack_text', packs.packText);
	writeTable('pack_boss_encounter', packs.bosses);
	writeTable('floor_pack', packs.floorPack);

	console.log(`\n산출 위치: ${OUT}\n`);
	console.log(report.format());
}

main();
