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
import { ROOT, readJson } from './io.js';

interface Coverage {
	snapshot: string;
	entities: Record<string, { count: number; sources?: Record<string, number> }>;
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

/**
 * 원본 자체가 잘못된 것으로 **확인된** 건. 검사에서 제외하되 id 를 특정한다.
 *
 * 통과시키려고 검사를 무르는 것이 아니다. 목록에 없는 id 는 계속 실패하므로
 * 같은 유형의 새 사례가 들어오면 잡힌다. 여기 넣으려면 원본을 직접 확인해야 한다.
 *
 * `status` 7건 — 2026-07-25 스냅샷 실측:
 *   MRR514·519·531·538·540·541  `BattleKeywords_Refraction5.json` 과 `Bufs_Refraction5.json`
 *                               양쪽 모두 이름이 자리표시자 `버프 이름` 이다. 고를 대안이 없다.
 *   SingBulletSupport           영어 파일에 개발자 메모가 들어 있다
 *                               — `(엄지 싱클 탄환 보급 받는 대상 이펙트)`
 */
const KNOWN_SOURCE_DEFECTS: Record<string, readonly string[]> = {
	status_text: [
		'MRR514',
		'MRR519',
		'MRR531',
		'MRR538',
		'MRR540',
		'MRR541',
		'SingBulletSupport',
	],
};

/** 표의 외래 키 컬럼명. 원본 결손 제외에 쓴다. */
function keyOf(table: string): string {
	return table === 'status_text' ? 'statusId' : 'id';
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
		// `localization` 절에 없는 엔티티도 `entities[].sources` 에 로케일별 실측이 있다.
		// 둘 다 수집 시점에 원본만 보고 적은 값이므로 어느 쪽을 읽든 기준의 성격은 같다.
		const sources = coverage.entities[label]?.sources;
		for (const locale of ['ko', 'en'] as const) {
			const expected = spec?.[locale] ?? sources?.[`loc-${locale}`];
			const basis = spec
				? `coverage.localization["${label}"].${locale}`
				: `coverage.entities["${label}"].sources["loc-${locale}"]`;
			if (expected === undefined) {
				skipped.push({
					name: `${label} ${locale} 표시명`,
					reason: 'coverage.json 에 로케일별 기준이 없다',
				});
				continue;
			}
			record(
				`${label} ${locale} 표시명`,
				basis,
				expected,
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

	// ── 7. 언어 판별 ──
	// 개수만 세면 한국어 칸이 통째로 영문이어도 통과한다. 실제로 그런 표가 넷 있었다.
	// 한글 포함 여부로 로케일과 내용이 맞는지 본다.
	const HANGUL = "~ '[가-힣]'";
	const textTables: Array<[table: string, column: string, label: string]> = [
		['gift_text', 'name', '기프트 이름'],
		['identity_text', 'name', '인격 이름'],
		['ego_text', 'name', 'E.G.O 이름'],
		['ego_passive_text', 'name', 'E.G.O 패시브 이름'],
		['pack_text', 'name', '테마 팩 이름'],
		['grace_option_text', 'name', '은총 이름'],
		['status_text', 'name', '상태 이름'],
		['skill_stage_text', 'name', '스킬 이름'],
	];
	for (const [table, column, label] of textTables) {
		// 영어 칸에 한글이 있으면 미번역 원본이 잘못 채워진 것이다. 결손과 달리 명백한 오류다.
		// 원본 자체가 잘못된 것으로 확인된 건은 id 를 특정해 제외한다. **새로운 id 는 계속 실패한다.**
		const exclusion =
			KNOWN_SOURCE_DEFECTS[table]?.map((id) => `'${id}'`).join(',') ?? '';
		const filter = exclusion ? ` AND "${keyOf(table)}" NOT IN (${exclusion})` : '';
		record(
			`${label} — 영어 칸의 한국어`,
			'로케일과 내용의 언어가 일치해야 한다',
			0,
			await scalar(
				`SELECT count(*) n FROM "${table}" WHERE locale='en' AND "${column}" ${HANGUL}${filter}`,
			),
		);
	}

	// 한국어 칸이 통째로 영문인 표를 찾는다. 부분 결손은 소스 사정이라 별도로 센다.
	for (const [table, column, label] of textTables) {
		const total = await scalar(
			`SELECT count(*) n FROM "${table}" WHERE locale='ko' AND "${column}" <> ''`,
		);
		const korean = await scalar(
			`SELECT count(*) n FROM "${table}" WHERE locale='ko' AND "${column}" ${HANGUL}`,
		);
		if (total === 0) {
			skipped.push({ name: `${label} — 한국어 비율`, reason: '대상 행이 없다' });
			continue;
		}
		record(
			`${label} — 한국어 비율`,
			'한국어 칸이 통째로 영문이면 원본을 안 읽은 것이다',
			true,
			korean > 0,
		);
	}

	// ── 8. 발동 시점 표기가 화면에 새어나가지 않는가 ──
	// `[WhenUse]` 같은 내부 표기가 표시용 텍스트에 남으면 그대로 화면에 노출된다.
	// 어휘 목록은 원본(`skill_tags.json`)에서 읽는다. 산출물에서 뽑으면 자기 확인이 된다.
	const triggerKeys = Object.keys(
		readJson<Record<string, unknown>>('identities', 'limbus-assets', 'skill_tags.json'),
	);
	const invalid = triggerKeys.filter((k) => !/^[A-Za-z0-9_]+$/.test(k));
	if (invalid.length > 0) {
		// 정규식에 그대로 넣을 수 없는 표제어가 생기면 검사를 조용히 좁히지 않고 알린다.
		skipped.push({
			name: '발동 시점 표기 미치환',
			reason: `표제어에 영숫자 밖의 문자가 있다 (${invalid.join(',')})`,
		});
	} else {
		const pattern = `\\[(${triggerKeys.join('|')})\\]`;
		const descTables = [
			'status_text',
			'gift_text',
			'skill_stage_text',
			'skill_coin_text',
			'passive_text',
			'ego_passive_text',
		];
		const leaked = (
			await Promise.all(
				descTables.map((t) => scalar(`SELECT count(*) n FROM "${t}" WHERE "desc" ~ '${pattern}'`)),
			)
		).reduce((a, b) => a + b, 0);
		record(
			'발동 시점 표기 미치환',
			`원본 어휘 ${triggerKeys.length}종이 표시용 텍스트에 남으면 안 된다`,
			0,
			leaked,
		);
	}

	// ── 9. 외래 키 제약이 실재하고 검증된 상태인가 ──
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
