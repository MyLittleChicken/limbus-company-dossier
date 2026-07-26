/**
 * 검증기 — 적재 결과를 독립 기준과 대조한다.
 *
 * ADR-01 2절   적재 결과를 coverage.json 의 대조 수치와 맞춘다
 * ADR-02 6절   변환과 적재를 서로 다른 수단으로 검사한다
 *
 * **기준은 `data/coverage.json` 이다.** 이 파일은 스키마도 변환기도 없던 수집 시점에
 * 원본만 보고 만들어졌다. 우리가 산출한 값으로 기준을 맞추면 검증이 아니라 자기 확인이 되므로,
 * 기대값을 이 스크립트에 적지 않고 그 파일에서 읽는다.
 *
 * 실패는 실패로 보고한다. 통과시키려고 기대값을 조정하지 않는다.
 *
 * 실행: npm run verify
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ROOT } from './io.js';

interface Coverage {
	snapshot: string;
	entities: Record<string, { count: number }>;
	localization: Record<string, { universe: number; ko: number; en: number }>;
	mechanics: { statuses: number; keywords: string[]; sins: string[] };
	mirrorDungeon: { totalFloors: number; baseFloors: number };
	integrity: { giftPackForward: number; giftPackReverse: number };
}

interface Check {
	name: string;
	expected: string;
	actual: string;
	ok: boolean;
	/** 기준의 출처. 어디서 온 기대값인지 밝힌다. */
	basis: string;
}

/**
 * 대조할 기준이 없어 실행하지 못한 검사.
 *
 * **조용히 건너뛰면 통과처럼 보인다.** 검사가 21건이라고 적혀 있는데 그중 몇 건이
 * 실행조차 안 됐다면 그 숫자는 거짓말이 된다. 따로 세어 드러낸다.
 */
interface Skipped {
	name: string;
	reason: string;
}

const prisma = new PrismaClient();
const checks: Check[] = [];
const skipped: Skipped[] = [];

function record(name: string, basis: string, expected: unknown, actual: unknown): void {
	checks.push({
		name,
		basis,
		expected: String(expected),
		actual: String(actual),
		ok: String(expected) === String(actual),
	});
}

async function scalar(sql: string): Promise<number> {
	const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(sql);
	return Number(rows[0]?.n ?? -1);
}

async function main(): Promise<void> {
	const coverage = JSON.parse(
		readFileSync(join(ROOT, 'data', 'coverage.json'), 'utf8'),
	) as Coverage;

	console.log(`기준: data/coverage.json (스냅샷 ${coverage.snapshot})\n`);

	// ── 1. 엔티티 수 — 수집 시점 실측과 대조 ──
	const entityMap: Array<[string, string]> = [
		['인격', 'identity'],
		['E.G.O', 'ego'],
		['거울 던전 기프트', 'gift'],
		['테마 팩', 'pack'],
	];
	for (const [label, table] of entityMap) {
		const expected = coverage.entities[label]?.count;
		if (expected === undefined) {
			skipped.push({ name: `${label} 수`, reason: 'coverage.entities 에 항목이 없다' });
			continue;
		}
		record(`${label} 수`, `coverage.entities["${label}"].count`, expected, await scalar(`SELECT count(*) n FROM "${table}"`));
	}

	record(
		'상태 수',
		'coverage.mechanics.statuses',
		coverage.mechanics.statuses,
		await scalar('SELECT count(*) n FROM "status"'),
	);

	// ── 2. 다국어 커버리지 — 로케일별로 전수인가 ──
	const localeMap: Array<[string, string, string, string]> = [
		['인격', 'identity_text', 'identityId', 'identity'],
		['E.G.O', 'ego_text', 'egoId', 'ego'],
		['테마 팩', 'pack_text', 'packId', 'pack'],
	];
	for (const [label, textTable, fk] of localeMap) {
		const spec = coverage.localization[label];
		if (spec === undefined) {
			for (const locale of ['ko', 'en'] as const) {
				skipped.push({
					name: `${label} ${locale} 표시명`,
					reason: 'coverage.localization 에 기준이 없다',
				});
			}
			continue;
		}
		for (const locale of ['ko', 'en'] as const) {
			record(
				`${label} ${locale} 표시명`,
				`coverage.localization["${label}"].${locale}`,
				spec[locale],
				await scalar(
					`SELECT count(DISTINCT "${fk}") n FROM "${textTable}" WHERE locale='${locale}' AND name <> ''`,
				),
			);
		}
	}
	// 기프트는 강화 단계가 있어 기본 단계만 센다.
	for (const locale of ['ko', 'en'] as const) {
		record(
			`거울 던전 기프트 ${locale} 표시명`,
			`coverage.localization["거울 던전 기프트"].${locale}`,
			coverage.localization['거울 던전 기프트']?.[locale],
			await scalar(
				`SELECT count(DISTINCT "giftId") n FROM "gift_text" WHERE locale='${locale}' AND "enhanceLevel"=0 AND name <> ''`,
			),
		);
	}

	// ── 3. 열거값 목록 — 기준의 목록과 집합이 같은가 ──
	const keywordRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
		'SELECT id FROM "keyword" ORDER BY id',
	);
	record(
		'키워드 목록',
		'coverage.mechanics.keywords',
		[...coverage.mechanics.keywords].sort().join(','),
		keywordRows.map((r) => r.id).sort().join(','),
	);
	const sinRows = await prisma.$queryRawUnsafe<Array<{ sin: string }>>(
		'SELECT sin::text FROM "sin_info" ORDER BY sin::text',
	);
	record(
		'죄악 목록',
		'coverage.mechanics.sins',
		[...coverage.mechanics.sins].sort().join(','),
		sinRows.map((r) => r.sin).sort().join(','),
	);

	// ── 4. 거울 던전 구성 ──
	const md = await prisma.$queryRawUnsafe<Array<{ totalFloors: number; baseFloors: number }>>(
		'SELECT "totalFloors", "baseFloors" FROM "mirror_dungeon" LIMIT 1',
	);
	record('전체 층수', 'coverage.mirrorDungeon.totalFloors', coverage.mirrorDungeon.totalFloors, md[0]?.totalFloors);
	record('기본 층수', 'coverage.mirrorDungeon.baseFloors', coverage.mirrorDungeon.baseFloors, md[0]?.baseFloors);

	// ── 5. 기프트↔팩 전용 관계 교차 무결성 ──
	// 기준이 양방향 불일치 0 으로 기록했다. 적재 후에도 0 이어야 한다.
	record(
		'기프트→팩 전용 관계 불일치',
		'coverage.integrity.giftPackForward',
		coverage.integrity.giftPackForward,
		await scalar(
			'SELECT count(*) n FROM "gift_exclusive_pack" e WHERE NOT EXISTS (SELECT 1 FROM "pack" p WHERE p.id = e."packId")',
		),
	);
	record(
		'팩→기프트 전용 관계 불일치',
		'coverage.integrity.giftPackReverse',
		coverage.integrity.giftPackReverse,
		await scalar(
			'SELECT count(*) n FROM "gift_exclusive_pack" e WHERE NOT EXISTS (SELECT 1 FROM "gift" g WHERE g.id = e."giftId")',
		),
	);

	// ── 6. 구조적 완전성 — 문서가 규정한 축의 개수 ──
	// 02-data-model 3.2/3.4: 인격 저항은 공격 타입 3종, E.G.O 저항은 죄악 7종.
	record(
		'인격마다 저항 3행',
		'02-data-model 3.2 (공격 타입 3종)',
		0,
		await scalar(
			'SELECT count(*) n FROM (SELECT "identityId" FROM "identity_resist" GROUP BY "identityId" HAVING count(*) <> 3) t',
		),
	);
	record(
		'E.G.O마다 저항 7행',
		'02-data-model 3.4 (죄악 7종)',
		0,
		await scalar(
			'SELECT count(*) n FROM (SELECT "egoId" FROM "ego_resist" GROUP BY "egoId" HAVING count(*) <> 7) t',
		),
	);
	record(
		'인격마다 속도 4단계',
		'02-data-model 3.3 (동기화 1–4)',
		0,
		await scalar(
			'SELECT count(*) n FROM (SELECT "identityId" FROM "identity_speed" GROUP BY "identityId" HAVING count(*) <> 4) t',
		),
	);

	// ── 7. 외래 키 제약이 실재하고 검증된 상태인가 ──
	record(
		'검증되지 않은 외래 키',
		'PostgreSQL 제약 상태',
		0,
		await scalar(
			"SELECT count(*) n FROM pg_constraint WHERE contype='f' AND NOT convalidated",
		),
	);

	// ── 출력 ──
	const width = Math.max(...checks.map((c) => c.name.length));
	for (const c of checks) {
		const mark = c.ok ? 'OK  ' : 'FAIL';
		const detail = c.ok ? c.actual : `기대 ${c.expected} · 실제 ${c.actual}`;
		console.log(`  ${mark}  ${c.name.padEnd(width)}  ${detail}`);
		if (!c.ok) console.log(`        기준: ${c.basis}`);
	}

	if (skipped.length > 0) {
		console.log('\n대조 기준이 없어 실행하지 못한 검사');
		for (const s of skipped) console.log(`  --    ${s.name}  (${s.reason})`);
	}

	const failed = checks.filter((c) => !c.ok);
	console.log(
		`\n검사 ${checks.length}건 · 통과 ${checks.length - failed.length} · 실패 ${failed.length}` +
			(skipped.length > 0 ? ` · 미실행 ${skipped.length}` : ''),
	);
	if (failed.length > 0) {
		console.log('\n실패한 검사가 있다. 기대값을 고치지 말고 원인을 찾아야 한다.');
		process.exitCode = 1;
	}
}

try {
	await main();
} finally {
	await prisma.$disconnect();
}
