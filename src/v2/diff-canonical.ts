/**
 * v2:diff — wip 과 canonical 을 대조한다.
 *
 * **승격 전에 사람이 읽는 것이 목적이다.** 무엇이 사라지고 무엇이 새로 생기는지
 * 모르고 바꾸면, 되돌릴 수 있다는 사실만으로는 부족하다.
 *
 * `app 무결성 예고` 가 특히 그렇다 — 승격(v2:promote)의 FK 재부착이 실패할지를
 * 미리 알려 준다. `app.run_gift`·`app.run_floor` 가 가리키는 기프트·팩이 새
 * `wip` 에 없으면 승격 트랜잭션이 통째로 되돌아간다 — 콜라보 기프트가 원본에서
 * 빠지는 일이 실재하므로(설계 6.2) 이 실패는 실제로 일어날 수 있다.
 *
 * **읽기 전용이다.** INSERT·UPDATE·DELETE·ALTER·DROP·CREATE 를 하나도 안 쓴다.
 * 임시 테이블도 안 만든다 — 전부 SELECT 뿐이다.
 *
 * 실행: npm run v2:diff
 */
import { PrismaClient } from './generated/client.js';
import { ident, schemaExists } from './schema-ops.js';

/** 개체 차를 보는 네 테이블 — 설계 7절. 전부 `id` 하나로 식별된다(문자열 PK). */
const ENTITY_TABLES = ['gift', 'identity', 'ego', 'pack'] as const;

/**
 * `app` 이 `canonical`/`wip` 을 참조하는 FK 둘 — v2:promote 가 재부착하는 바로
 * 그것이다(설계 6.2). 여기서 미리 걸리면 승격이 걸릴 것도 미리 아는 셈이다.
 */
const APP_FK_CHECKS = [
	{ table: 'run_gift', fkColumn: 'gift_id', targetTable: 'gift' },
	{ table: 'run_floor', fkColumn: 'pack_id', targetTable: 'pack' },
] as const;

async function tableNames(prisma: PrismaClient, schema: string): Promise<Set<string>> {
	const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
	`;
	return new Set(rows.map((r) => r.table_name));
}

/**
 * `pg_stat_user_tables.n_live_tup` 은 추정치다. 통계 수집기가 DML 뒤에 갱신하는
 * 값이라 시점에 따라 실제 행수와 어긋날 수 있다(design-ops 의 `hasAnyRow` 가
 * 같은 이유로 이 값 대신 직접 세는 것과 대비된다 — 거긴 가드라 오탐이 최악이고,
 * 여긴 훑기라 **속도가 우선**이다). 94 테이블을 전부 `count(*)` 로 정확히 세면
 * 느리므로, 여기서는 스캔 없이 통계만 한 번 읽어 "다른 것 같은 후보"를 고른다 —
 * 실제 확정은 그 후보만 `count(*)` 로 다시 잰다(아래 `exactCount`).
 */
async function liveTupEstimates(
	prisma: PrismaClient,
	schema: string,
): Promise<Map<string, number>> {
	const rows = await prisma.$queryRaw<Array<{ relname: string; n_live_tup: bigint | null }>>`
		SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = ${schema}
	`;
	return new Map(rows.map((r) => [r.relname, Number(r.n_live_tup ?? 0n)]));
}

async function exactCount(prisma: PrismaClient, schema: string, table: string): Promise<number> {
	const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
		`SELECT count(*)::bigint AS n FROM ${ident(schema)}.${ident(table)}`,
	);
	return Number(rows[0]?.n ?? 0n);
}

interface EntityDiff {
	missing: string[]; // canonical 에 있고 wip 에 없다 — 승격되면 사라질 개체
	added: string[]; // wip 에 있고 canonical 에 없다 — 승격되면 새로 생길 개체
}

/** `EXCEPT` 두 방향 — 설계 7절 그대로. 테이블 이름은 상수(ENTITY_TABLES)뿐이지만 `ident` 를 거쳐 SQL 에 박는다. */
async function entityDiff(prisma: PrismaClient, table: string): Promise<EntityDiff> {
	const t = ident(table);
	const [missing, added] = await Promise.all([
		prisma.$queryRawUnsafe<Array<{ id: string }>>(
			`SELECT ${ident('id')} FROM ${ident('canonical')}.${t}
			 EXCEPT SELECT ${ident('id')} FROM ${ident('wip')}.${t}`,
		),
		prisma.$queryRawUnsafe<Array<{ id: string }>>(
			`SELECT ${ident('id')} FROM ${ident('wip')}.${t}
			 EXCEPT SELECT ${ident('id')} FROM ${ident('canonical')}.${t}`,
		),
	]);
	return { missing: missing.map((r) => r.id), added: added.map((r) => r.id) };
}

interface AppIntegrityResult {
	total: number;
	/** true 면 `total` 이 0 이라 검사 자체를 안 돌렸다 — "문제 없음"과 구분해야 한다. */
	skipped: boolean;
	missingIds: string[];
}

/**
 * `app.<table>.<fkColumn>` 이 가리키는 값이 `wip.<targetTable>.id` 에 다 있는지.
 *
 * `total` 이 0 이면 질의 자체를 건너뛴다 — 지금 DB 상태(설계 검증 절)가 바로 이
 * 경우다(`run_gift`·`run_floor` 둘 다 0행). **"0 행이라 검사가 아무 일도 안 한
 * 것"과 "행이 있는데 전부 통과한 것"을 호출부가 구분해서 찍어야 한다** — 조용히
 * "문제 없음"만 찍으면 나중에 진짜 문제(가리키는 대상이 아예 없어 검사가 텅 빈
 * 결과를 낸 경우)를 놓친다. 그래서 `skipped` 를 따로 반환한다.
 */
async function appIntegrityCheck(
	prisma: PrismaClient,
	table: string,
	fkColumn: string,
	targetTable: string,
): Promise<AppIntegrityResult> {
	const total = await exactCount(prisma, 'app', table);
	if (total === 0) return { total: 0, skipped: true, missingIds: [] };

	const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
		`SELECT DISTINCT a.${ident(fkColumn)} AS ${ident('id')}
		   FROM ${ident('app')}.${ident(table)} a
		  WHERE NOT EXISTS (
		    SELECT 1 FROM ${ident('wip')}.${ident(targetTable)} w
		     WHERE w.${ident('id')} = a.${ident(fkColumn)}
		  )`,
	);
	return { total, skipped: false, missingIds: rows.map((r) => r.id) };
}

/** 목록이 길면 앞부분만 찍는다 — 수백 건이 통째로 로그를 덮으면 정작 중요한 요약이 묻힌다. */
function formatIds(ids: string[], limit = 20): string {
	const shown = ids.slice(0, limit).join(', ');
	return ids.length > limit ? `${shown} … (총 ${ids.length}건)` : shown;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	let problems = 0;

	try {
		console.log('v2:diff — wip 과 canonical 을 대조한다 (읽기 전용, 승격 전 확인용)');

		// 조용한 누락 금지 — wip 이 없으면 "없다"고 말하고 만드는 법을 안내한다.
		if (!(await schemaExists(prisma, 'wip'))) {
			console.error('\nwip 스키마가 없다. v2:diff 는 v2:build 산물을 canonical 과 대조하는 명령이라 wip 없이는 할 일이 없다.');
			console.error('먼저 npm run v2:build 로 새 판을 구워라.');
			process.exitCode = 1;
			return;
		}
		if (!(await schemaExists(prisma, 'canonical'))) {
			// 정상 운영에서는 canonical 이 없을 수 없다(살아있는 판이다) — 그래도 조용히
			// 넘어가면 뒤 단계가 Prisma 원시 오류로 죽으며 원인을 숨긴다.
			console.error('\ncanonical 스키마가 없다 — 있어야 할 살아있는 판이 없다. DB 상태를 먼저 확인해라.');
			process.exitCode = 1;
			return;
		}

		// 0. 테이블 집합 — 브리프가 안 적었어도 구조가 갈린 것은 사람이 알아야 한다.
		const [canonicalTables, wipTables] = await Promise.all([
			tableNames(prisma, 'canonical'),
			tableNames(prisma, 'wip'),
		]);
		const onlyInCanonical = [...canonicalTables].filter((t) => !wipTables.has(t)).sort();
		const onlyInWip = [...wipTables].filter((t) => !canonicalTables.has(t)).sort();
		const commonTables = [...canonicalTables].filter((t) => wipTables.has(t)).sort();

		console.log(
			`\n0. 테이블 집합 — canonical ${canonicalTables.size}개 · wip ${wipTables.size}개`,
		);
		if (onlyInCanonical.length === 0 && onlyInWip.length === 0) {
			console.log('  같다.');
		} else {
			problems++;
			if (onlyInCanonical.length > 0) {
				console.log(`  canonical 에만 있음(wip 에 없음): ${onlyInCanonical.join(', ')}`);
			}
			if (onlyInWip.length > 0) {
				console.log(`  wip 에만 있음(canonical 에 없음): ${onlyInWip.join(', ')}`);
			}
			console.log('  아래 행수·개체·app 무결성 비교는 겹치는 테이블만 본다 — 위 테이블은 그 자체로 조사거리다.');
		}

		// 1. 행수 차 — n_live_tup 추정으로 먼저 훑고, 어긋난 것만 정확히 다시 센다.
		console.log(`\n1. 행수 차 — n_live_tup 추정으로 먼저 훑는다 (공통 ${commonTables.length}테이블)`);
		const [canonEst, wipEst] = await Promise.all([
			liveTupEstimates(prisma, 'canonical'),
			liveTupEstimates(prisma, 'wip'),
		]);
		const estimateSuspects = commonTables.filter(
			(t) => (canonEst.get(t) ?? 0) !== (wipEst.get(t) ?? 0),
		);
		if (estimateSuspects.length === 0) {
			console.log('  추정치로는 전 테이블이 같다.');
		} else {
			console.log(
				`  추정치가 다른 테이블 ${estimateSuspects.length}개 — count(*) 로 정확히 다시 센다: ${estimateSuspects.join(', ')}`,
			);
		}
		const rowDiffs: Array<{ table: string; canonical: number; wip: number }> = [];
		for (const t of estimateSuspects) {
			const [c, w] = await Promise.all([
				exactCount(prisma, 'canonical', t),
				exactCount(prisma, 'wip', t),
			]);
			if (c !== w) rowDiffs.push({ table: t, canonical: c, wip: w });
		}
		if (estimateSuspects.length > 0 && rowDiffs.length === 0) {
			console.log('  count(*) 로 다시 세니 차이 없음 — 추정 단계에서 걸린 것은 전부 오탐이었다.');
		}
		if (rowDiffs.length > 0) {
			problems += rowDiffs.length;
			for (const d of rowDiffs) {
				console.log(
					`  ${d.table}: canonical ${d.canonical.toLocaleString()} vs wip ${d.wip.toLocaleString()}`,
				);
			}
		}
		console.log(
			'  한계: n_live_tup 은 통계 수집기가 갱신하는 추정치라 ANALYZE 전엔 실제로 행이 있어도 0 으로 ' +
				'보일 수 있다. 두 스키마가 같은 시점에 똑같이 뒤처져 있으면 위 "같다" 판정이 진짜 차이를 ' +
				'가릴 수 있다는 뜻이다 — 이 스캔은 훑기이지 증명이 아니다.',
		);

		// 2. 개체 차 — gift · identity · ego · pack.
		console.log('\n2. 개체 차 — gift · identity · ego · pack (canonical 과 wip 둘 다 있는 테이블만)');
		for (const table of ENTITY_TABLES) {
			if (!commonTables.includes(table)) {
				console.log(`  ${table}: 테이블 집합이 갈려서(0번 참고) 건너뛴다.`);
				continue;
			}
			const { missing, added } = await entityDiff(prisma, table);
			if (missing.length === 0 && added.length === 0) {
				console.log(`  ${table}: 같다.`);
				continue;
			}
			problems++;
			if (missing.length > 0) {
				console.log(
					`  ${table}: 사라진 개체 ${missing.length}건(canonical 에 있고 wip 에 없음) — ${formatIds(missing)}`,
				);
			}
			if (added.length > 0) {
				console.log(
					`  ${table}: 새 개체 ${added.length}건(wip 에 있고 canonical 에 없음) — ${formatIds(added)}`,
				);
			}
		}

		// 3. app 무결성 예고 — 승격의 FK 재부착이 실패할지 미리 본다.
		console.log('\n3. app 무결성 예고 — 승격(v2:promote)의 FK 재부착이 실패할지 미리 본다');
		for (const check of APP_FK_CHECKS) {
			if (!commonTables.includes(check.targetTable)) {
				console.log(
					`  app.${check.table}.${check.fkColumn}: 대상 테이블(${check.targetTable})이 테이블 집합에서 갈렸다(0번 참고) — 건너뛴다.`,
				);
				continue;
			}
			const result = await appIntegrityCheck(prisma, check.table, check.fkColumn, check.targetTable);
			if (result.skipped) {
				// 0행이라 검사가 아무 일도 안 한 것 — "통과했다"와 다르다. 조용히 "문제
				// 없음"만 찍으면 나중에 실제로 걸릴 때를 놓친다.
				console.log(`  app.${check.table} 0행 · 확인할 것 없음`);
				continue;
			}
			if (result.missingIds.length === 0) {
				console.log(
					`  app.${check.table} ${result.total.toLocaleString()}행 · 문제 없음 — 전부 wip.${check.targetTable} 에서 찾아진다`,
				);
			} else {
				problems++;
				console.log(
					`  app.${check.table} ${result.total.toLocaleString()}행 중 ${result.missingIds.length}건이 ` +
						`wip.${check.targetTable} 에 없다 — 승격 트랜잭션이 이 FK 재부착에서 통째로 되돌아간다: ` +
						formatIds(result.missingIds),
				);
			}
		}

		console.log(
			`\n${problems === 0 ? '차이 없음 — 승격을 막을 것이 안 보인다.' : `문제 ${problems}건 — 위 상세를 보고 승격 전에 조사해라.`}`,
		);
		if (problems > 0) process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
