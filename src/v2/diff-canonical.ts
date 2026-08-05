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
 * **읽기 전용이다 — 그것도 규율이 아니라 PostgreSQL 자신이 강제한다.** 전체를
 * 인터랙티브 트랜잭션 하나로 감싸고 맨 앞에서 `SET TRANSACTION READ ONLY` 를
 * 건다(아래 `main` 참고). 세션 단위(`SET SESSION CHARACTERISTICS`)로 하지 않는
 * 이유 — Prisma 는 커넥션 풀을 쓰므로 세션에 건 설정이 다음 질의에서 다른
 * 커넥션으로 새면 강제가 안 걸린다. 트랜잭션 하나로 묶어야 커넥션이 고정되고
 * 그 안의 모든 질의에 실제로 걸린다.
 *
 * **덤으로 일관된 스냅샷을 본다.** 94테이블을 여러 질의로 훑는 동안 트랜잭션이
 * 하나로 안 묶이면 그 사이 데이터가 바뀌어 대조가 찢어질 수 있다 — 승격 직전
 * 판단의 근거로는 옳지 않다. 한 트랜잭션 안이면 시작 시점의 스냅샷만 본다.
 *
 * 실행: npm run v2:diff
 */
import { PrismaClient, type Prisma } from './generated/client.js';
import {
	LIVE_SCHEMA,
	appDependencies,
	appFkChecks,
	appIntegrityCheck,
	buildDiedMidwayMessage,
	exactCount,
	formatIds,
	ident,
	schemaExists,
	tableNames,
} from './schema-ops.js';

/**
 * 이 대조가 **보는 것과 안 보는 것.** 요약 줄에 늘 같이 찍는다 — 「차이 없음」이
 * 실제 범위보다 넓게 들리면 안 된다. `gift.hardOnly` 정정처럼 id 도 행수도 그대로인
 * 컬럼 값 변경은 여기 안 나오는데(ADR-07 3절이 이 프로젝트의 전형이라고 못 박은 바로
 * 그 종류다) 범위를 안 적으면 사람이 「아무것도 안 달라졌다」로 읽는다.
 */
const DIFF_SCOPE = [
	'이 대조의 범위 — 값 비교는 안 한다. 테이블 집합 · 행수 · 네 테이블(gift·identity·ego·pack)의 id 집합 · app FK 무결성만 본다.',
	'id 도 행수도 그대로인 컬럼 값 변경(예: gift.hardOnly 정정)은 여기 안 나온다 — ADR-07 3절이 전형이라고 적은 바로 그 종류다.',
].join('\n');

/** 개체 차를 보는 네 테이블 — 설계 7절. 전부 `id` 하나로 식별된다(문자열 PK). */
const ENTITY_TABLES = ['gift', 'identity', 'ego', 'pack'] as const;

/**
 * `pg_stat_user_tables.n_live_tup` 은 추정치다. 통계 수집기가 DML 뒤에 갱신하는
 * 값이라 시점에 따라 실제 행수와 어긋날 수 있다(schema-ops 의 `hasAnyRow` 가
 * 같은 이유로 이 값 대신 직접 세는 것과 대비된다 — 거긴 가드라 오탐이 최악이고,
 * 여긴 훑기라 **속도가 우선**이다). 94 테이블을 전부 `count(*)` 로 정확히 세면
 * 느리므로, 여기서는 스캔 없이 통계만 한 번 읽어 "다른 것 같은 후보"를 고른다 —
 * 실제 확정은 그 후보만 `count(*)` 로 다시 잰다(아래 `exactCount`).
 */
async function liveTupEstimates(
	tx: Prisma.TransactionClient,
	schema: string,
): Promise<Map<string, number>> {
	const rows = await tx.$queryRaw<Array<{ relname: string; n_live_tup: bigint | null }>>`
		SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = ${schema}
	`;
	return new Map(rows.map((r) => [r.relname, Number(r.n_live_tup ?? 0n)]));
}

interface EntityDiff {
	missing: string[]; // canonical 에 있고 wip 에 없다 — 승격되면 사라질 개체
	added: string[]; // wip 에 있고 canonical 에 없다 — 승격되면 새로 생길 개체
}

/** `EXCEPT` 두 방향 — 설계 7절 그대로. 테이블 이름은 상수(ENTITY_TABLES)뿐이지만 `ident` 를 거쳐 SQL 에 박는다. */
async function entityDiff(tx: Prisma.TransactionClient, table: string): Promise<EntityDiff> {
	const t = ident(table);
	const [missing, added] = await Promise.all([
		tx.$queryRawUnsafe<Array<{ id: string }>>(
			`SELECT ${ident('id')} FROM ${ident('canonical')}.${t}
			 EXCEPT SELECT ${ident('id')} FROM ${ident('wip')}.${t}`,
		),
		tx.$queryRawUnsafe<Array<{ id: string }>>(
			`SELECT ${ident('id')} FROM ${ident('wip')}.${t}
			 EXCEPT SELECT ${ident('id')} FROM ${ident('canonical')}.${t}`,
		),
	]);
	return { missing: missing.map((r) => r.id), added: added.map((r) => r.id) };
}

/** wip 이나 canonical 이 아예 없어 대조를 못 돌린 경우 — problems 를 셀 것도 없다. */
interface Incomplete {
	incomplete: true;
}
interface Complete {
	incomplete: false;
	/**
	 * 발견된 문제 "항목" 수 — 갈린 테이블 이름 하나 · 행수가 다른 테이블 하나 ·
	 * 개체가 갈린 테이블 하나 · FK 무결성이 깨진 app 검사 하나 · 정의문을 못 읽어
	 * `unsupported` 로 나온 app FK 하나, 전부 1씩 센다. 모든 섹션이 같은 잣대
	 * (항목당 1)를 쓰므로 이 숫자를 그대로 더해 합계를 낼 수 있다 — 섹션마다
	 * 단위가 다르면 합계가 뜻을 잃는다.
	 */
	problems: number;
}

/**
 * 실제 대조 넷 전부를 `tx`(읽기 전용 트랜잭션) 위에서 돈다. wip·canonical 이
 * 없으면 그 사실만 찍고 `{ incomplete: true }` 를 돌려 — main 이 요약 없이
 * 끝낸다.
 */
async function runDiff(tx: Prisma.TransactionClient): Promise<Incomplete | Complete> {
	let problems = 0;

	// 조용한 누락 금지 — wip 이 없으면 "없다"고 말하고 만드는 법을 안내한다.
	if (!(await schemaExists(tx, 'wip'))) {
		console.error(
			'\nwip 스키마가 없다. v2:diff 는 v2:build 산물을 canonical 과 대조하는 명령이라 wip 없이는 할 일이 없다.',
		);
		console.error('먼저 npm run v2:build 로 새 판을 구워라.');
		return { incomplete: true };
	}
	if (!(await schemaExists(tx, 'canonical'))) {
		// 정상 운영에서는 canonical 이 없을 수 없다(살아있는 판이다) — 그래도 조용히
		// 넘어가면 뒤 단계가 Prisma 원시 오류로 죽으며 원인을 숨긴다.
		//
		// canonical_hold 를 한 번 더 읽는다. wip 이 있고 canonical 이 없는 상태는
		// 「v2:build 가 SIGINT·크래시로 중간에 죽었다」가 가장 그럴듯한 설명이고,
		// 그때 살아있는 판은 canonical_hold 에 있다 — 그 사실을 안 알려 주면 사람이
		// wip 을 살아있는 자리에 올리는 쪽으로 간다.
		if (await schemaExists(tx, 'canonical_hold')) {
			for (const line of buildDiedMidwayMessage()) console.error(line);
			return { incomplete: true };
		}
		console.error('\ncanonical 스키마가 없다 — 있어야 할 살아있는 판이 없다. DB 상태를 먼저 확인해라.');
		console.error('canonical_hold 도 없으므로 v2:build 가 중간에 죽은 것은 아니다.');
		return { incomplete: true };
	}

	// 0. 테이블 집합 — 브리프가 안 적었어도 구조가 갈린 것은 사람이 알아야 한다.
	const [canonicalTables, wipTables] = await Promise.all([
		tableNames(tx, 'canonical'),
		tableNames(tx, 'wip'),
	]);
	const onlyInCanonical = [...canonicalTables].filter((t) => !wipTables.has(t)).sort();
	const onlyInWip = [...wipTables].filter((t) => !canonicalTables.has(t)).sort();
	const commonTables = [...canonicalTables].filter((t) => wipTables.has(t)).sort();

	console.log(`\n0. 테이블 집합 — canonical ${canonicalTables.size}개 · wip ${wipTables.size}개`);
	if (onlyInCanonical.length === 0 && onlyInWip.length === 0) {
		console.log('  같다.');
	} else {
		// 항목 = 갈린 테이블 이름 하나. "구조가 갈렸다"는 사실 하나로 뭉뚱그리지
		// 않는다 — 아래 세 섹션과 같은 잣대(항목당 1)를 쓴다.
		problems += onlyInCanonical.length + onlyInWip.length;
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
		liveTupEstimates(tx, 'canonical'),
		liveTupEstimates(tx, 'wip'),
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
		const [c, w] = await Promise.all([exactCount(tx, 'canonical', t), exactCount(tx, 'wip', t)]);
		if (c !== w) rowDiffs.push({ table: t, canonical: c, wip: w });
	}
	if (estimateSuspects.length > 0 && rowDiffs.length === 0) {
		console.log('  count(*) 로 다시 세니 차이 없음 — 추정 단계에서 걸린 것은 전부 오탐이었다.');
	}
	if (rowDiffs.length > 0) {
		// 항목 = 행수가 실제로 다른 테이블 하나(count(*) 로 확정된 것만 — 추정
		// 단계의 오탐은 안 센다).
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
		const { missing, added } = await entityDiff(tx, table);
		if (missing.length === 0 && added.length === 0) {
			console.log(`  ${table}: 같다.`);
			continue;
		}
		// 항목 = 개체가 갈린 테이블 하나(사라진 것·새 것이 둘 다 있어도 1) —
		// 위 행수 차·아래 app 무결성과 같은 "테이블/체크 하나당 1" 잣대다.
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
	//
	// 검사 목록을 상수로 안 박고 카탈로그에서 유도한다 — v2:promote 와 **같은 진실
	// 원천**이어야 한다. 예전엔 여기와 promote 가 상수 둘을 보고 promote 만
	// appDependencies 를 봤다. 그러면 셋째 FK 가 생겼을 때 예고에서 조용히 빠진다.
	console.log('\n3. app 무결성 예고 — 승격(v2:promote)의 FK 재부착이 실패할지 미리 본다');
	const liveFks = (await appDependencies(tx)).filter((d) => d.foreignSchema === LIVE_SCHEMA);
	const { checks, unsupported } = appFkChecks(liveFks);
	if (checks.length === 0 && unsupported.length === 0) {
		console.log(
			`  app → ${LIVE_SCHEMA} FK 가 하나도 없다 — 예고할 것이 없다는 뜻이다. 예상 밖이면 조사해라.`,
		);
	}
	for (const u of unsupported) {
		// 항목 = 선검사 모양을 못 읽어낸 FK 하나. 조용히 빼면 「예고에 문제 없음」이
		// 거짓이 되고, 승격은 이 FK 를 실제로 떼었다 붙인다.
		problems++;
		console.log(`  ${u}`);
		console.log('    → 이 FK 는 예고도 선검사도 못 한다. v2:promote 도 같은 이유로 거절한다.');
	}
	for (const check of checks) {
		if (!commonTables.includes(check.targetTable)) {
			console.log(
				`  app.${check.table}.${check.fkColumn}: 대상 테이블(${check.targetTable})이 테이블 집합에서 갈렸다(0번 참고) — 건너뛴다.`,
			);
			continue;
		}
		const result = await appIntegrityCheck(tx, check, 'wip');
		if (result.skipped) {
			// 0행이라 검사가 아무 일도 안 한 것 — "통과했다"와 다르다. 조용히 "문제
			// 없음"만 찍으면 나중에 실제로 걸릴 때를 놓친다.
			console.log(`  app.${check.table} 0행 · 확인할 것 없음`);
			continue;
		}
		if (result.missingIds.length === 0) {
			console.log(
				`  app.${check.table} ${result.total.toLocaleString()}행 · 문제 없음 — 전부 wip.${check.targetTable}.${check.targetColumn} 에서 찾아진다`,
			);
		} else {
			// 항목 = FK 무결성이 깨진 검사 하나(run_gift 또는 run_floor).
			problems++;
			console.log(
				`  app.${check.table} ${result.total.toLocaleString()}행 중 ${result.missingIds.length}건이 ` +
					`wip.${check.targetTable}.${check.targetColumn} 에 없다 — 승격 트랜잭션이 이 FK 재부착에서 통째로 되돌아간다: ` +
					formatIds(result.missingIds),
			);
		}
	}

	return { incomplete: false, problems };
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();

	try {
		console.log('v2:diff — wip 과 canonical 을 대조한다 (읽기 전용, 승격 전 확인용)');

		// 인터랙티브 트랜잭션 기본 제한시간은 5초다 — 94테이블을 여러 질의로
		// 훑으면 넘칠 수 있어 넉넉히 준다. 트랜잭션 자체의 이유는 파일 상단
		// 주석 참고("규율이 아니라 PostgreSQL 이 강제한다").
		const result = await prisma.$transaction(
			async (tx) => {
				await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
				return runDiff(tx);
			},
			{ timeout: 60_000 },
		);

		if (result.incomplete) {
			process.exitCode = 1;
			return;
		}

		console.log(
			`\n${
				result.problems === 0
					? '차이 없음 — 이 대조가 보는 범위 안에서는 승격을 막을 것이 안 보인다.'
					: `문제 ${result.problems}건 — 위 상세를 보고 승격 전에 조사해라.`
			}`,
		);
		// 범위는 두 갈래 모두에 찍는다 — 「차이 없음」쪽이 특히 넓게 들린다.
		console.log(DIFF_SCOPE);
		if (result.problems > 0) process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
