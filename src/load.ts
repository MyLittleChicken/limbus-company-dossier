/**
 * 적재기 — 정규화 JSON 을 PostgreSQL 에 넣는다.
 *
 * ADR-01 2절   적재 결과를 coverage.json 의 대조 수치와 맞춘다
 * ADR-02 3.2   Prisma Client 를 ORM 으로 쓴다. 마이그레이션 러너는 쓰지 않는다
 * ADR-02 원칙 2 전체를 재생성한다. 넣기 전에 비운다
 *
 * DDL 은 이 스크립트가 적용하지 않는다. `prisma/schema.sql` 을 psql 로 직접 넣는다.
 *
 * 실행: npm run load
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { OUT } from './io.js';

/**
 * 적재 순서. **부모가 먼저다.** 외래 키가 45개라 순서를 틀리면 참조 위반으로 멈춘다.
 * 튜플의 두 번째는 Prisma Client 의 델리게이트 이름이다.
 */
const ORDER: Array<[table: string, delegate: string]> = [
	// 참조되지 않는 뿌리
	['dataset', 'dataset'],
	['sinner', 'sinner'],
	['affiliation', 'affiliation'],
	['status', 'status'],
	['sin_info', 'sinInfo'],
	['keyword', 'keyword'],
	['pack', 'pack'],
	['mirror_dungeon', 'mirrorDungeon'],
	['passive', 'passive'],
	// 뿌리를 참조하는 엔티티
	['gift', 'gift'],
	['identity', 'identity'],
	['ego', 'ego'],
	['skill', 'skill'],
	['skill_stage', 'skillStage'],
	['skill_coin', 'skillCoin'],
	['fusion_recipe', 'fusionRecipe'],
	['fusion_slot', 'fusionSlot'],
	['grace_option', 'graceOption'],
	// 관계와 표시 문자열
	['sinner_text', 'sinnerText'],
	['affiliation_text', 'affiliationText'],
	['status_text', 'statusText'],
	['sin_text', 'sinText'],
	['keyword_text', 'keywordText'],
	['pack_text', 'packText'],
	['pack_boss_encounter', 'packBossEncounter'],
	['floor_pack', 'floorPack'],
	['identity_text', 'identityText'],
	['identity_resist', 'identityResist'],
	['identity_speed', 'identitySpeed'],
	['identity_affiliation', 'identityAffiliation'],
	['identity_status', 'identityStatus'],
	['identity_passive', 'identityPassive'],
	['passive_requirement', 'passiveRequirement'],
	['passive_text', 'passiveText'],
	['skill_stage_text', 'skillStageText'],
	['skill_coin_text', 'skillCoinText'],
	['ego_text', 'egoText'],
	['ego_cost', 'egoCost'],
	['ego_resist', 'egoResist'],
	['ego_status', 'egoStatus'],
	['ego_passive', 'egoPassive'],
	['ego_passive_text', 'egoPassiveText'],
	['gift_text', 'giftText'],
	['gift_pack', 'giftPack'],
	['gift_exclusive_pack', 'giftExclusivePack'],
	['fusion_slot_option', 'fusionSlotOption'],
	['grace_option_text', 'graceOptionText'],
];

/** 날짜 컬럼. JSON 은 문자열이지만 스키마는 date 라 변환이 필요하다. */
const DATE_FIELDS: Record<string, readonly string[]> = {
	identity: ['releaseDate'],
	ego: ['releaseDate'],
	dataset: ['snapshotDate', 'generatedAt'],
};

/** 한 번에 넣는 행 수. 5만 행을 한 문장에 담으면 파라미터 한도에 걸린다. */
const CHUNK = 2_000;

type Row = Record<string, unknown>;

function readTable(table: string): Row[] {
	const path = join(OUT, `${table}.json`);
	if (!existsSync(path)) throw new Error(`산출물이 없다: ${path}. 먼저 npm run convert 를 돌린다.`);
	return JSON.parse(readFileSync(path, 'utf8')) as Row[];
}

function coerceDates(table: string, rows: Row[]): Row[] {
	const fields = DATE_FIELDS[table];
	if (fields === undefined) return rows;
	return rows.map((row) => {
		const next: Row = { ...row };
		for (const field of fields) {
			const value = next[field];
			if (typeof value === 'string' && value.length > 0) next[field] = new Date(`${value}T00:00:00Z`);
		}
		return next;
	});
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	const counts = new Map<string, number>();

	try {
		// 전체 재생성이므로 넣기 전에 비운다. 자식부터 지워야 외래 키에 걸리지 않는다.
		console.log('기존 데이터를 비운다');
		for (const [table] of [...ORDER].reverse()) {
			await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
		}

		for (const [table, delegate] of ORDER) {
			const rows = coerceDates(table, readTable(table));
			if (rows.length === 0) {
				counts.set(table, 0);
				continue;
			}
			const client = prisma as unknown as Record<
				string,
				{ createMany: (args: { data: Row[] }) => Promise<{ count: number }> }
			>;
			const handle = client[delegate];
			if (handle === undefined) throw new Error(`Prisma 델리게이트를 찾을 수 없다: ${delegate}`);

			let inserted = 0;
			for (let i = 0; i < rows.length; i += CHUNK) {
				const result = await handle.createMany({ data: rows.slice(i, i + CHUNK) });
				inserted += result.count;
			}
			counts.set(table, inserted);
			process.stdout.write(`  ${table.padEnd(24)} ${String(inserted).padStart(7)}\n`);
		}

		const total = [...counts.values()].reduce((a, b) => a + b, 0);
		console.log(`\n적재 완료 — 테이블 ${counts.size}개 · ${total.toLocaleString('ko-KR')}행`);
	} finally {
		await prisma.$disconnect();
	}
}

await main();
