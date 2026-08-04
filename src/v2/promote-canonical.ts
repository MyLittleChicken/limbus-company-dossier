/**
 * v2:promote — 새 판을 `canonical` 자리에 앉히고 `app` 을 다시 겨눈다.
 * v2:rollback — 그 반대. 이전 판을 `canonical` 자리로 되돌린다.
 *
 * ```
 * promote    canonical → canonical_bak · wip → canonical
 * rollback   canonical → wip           · canonical_bak → canonical
 * ```
 *
 * 두 명령은 **같은 절차의 방향만 다른 것**이라 한 파일에 둔다. 되돌리기를 따로
 * 쓰면 승격에 고친 것을 되돌리기에 안 고치는 날이 온다 — 그때 잃는 것이 살아있는
 * 152,399행이다.
 *
 * **교체와 `app` 재조준은 한 트랜잭션이다(설계 3.4).** PostgreSQL 은 DDL 이
 * 트랜잭션이므로 반쯤 바뀐 상태가 존재하지 않는다 — 임시 스키마로 실측해 확인했다
 * (실패시킨 트랜잭션 뒤에 스키마 이름도 FK 도 그대로였다). 이게 이 명령의 안전이
 * 서 있는 자리다.
 *
 * **이전 판을 지우는 것도 같은 트랜잭션 안이다**(결정 3, 첫 문장). 밖에 두면 거기서만
 * 원자성이 깨진다 — 삭제가 성공하고 교체가 실패하면 승격은 안 됐는데 N-1 백업만
 * 영구히 사라지고, 트랜잭션이 되돌아가도 그건 안 돌아온다. 2차 리뷰에서 잡힌
 * 유일한 구멍이었고, 실제로 실패시켜 이전 판이 되살아나는 것을 확인했다.
 *
 * **왜 `prisma.$transaction` 인가 — 수동 `BEGIN`/`COMMIT` 이 아니다.** Prisma 는
 * 커넥션 풀을 쓴다. `$executeRawUnsafe('BEGIN')` 과 그다음 문장이 같은 커넥션으로
 * 간다는 보장이 없다 — 실측하면 순차 호출은 대개 같은 커넥션을 다시 잡지만
 * (`pg_backend_pid` 가 같다) 동시 호출은 바로 갈린다(51430·51431·51432). "대개
 * 맞는다"는 152,399행이 걸린 자리에서 쓸 근거가 아니다. 인터랙티브 트랜잭션은
 * 커넥션 고정을 **보장한다** — v2:diff(diff-canonical.ts)가 읽기 전용을 세션이
 * 아니라 트랜잭션에 거는 것과 같은 이유다. DDL 이 그 안에서 도는 것도, 실패 시
 * 통째로 되돌아가는 것도 실측으로 확인했다.
 *
 * **SQL 은 트랜잭션을 열기 전에 전부 조립한다.** 식별자 모양 검사(`ident`)에
 * 걸리는 것 같은 실패가 교체 도중에 나면 안 된다 — 미리 만들어 두면 그런 실패는
 * DB 를 한 글자도 안 바꾼 상태에서 난다.
 *
 * 실행: npm run v2:promote · npm run v2:rollback
 */
import { PrismaClient, type Prisma } from './generated/client.js';
import {
	APP_FK_CHECKS,
	appDependencies,
	appIntegrityCheck,
	appTypeColumns,
	exactCount,
	formatIds,
	ident,
	outsideDependents,
	qualifiesSchema,
	rebindSql,
	renameSchema,
	retargetTypeSql,
	schemaExists,
	tableCount,
	type AppFk,
	type AppTypeColumn,
} from './schema-ops.js';

type Mode = 'promote' | 'rollback';

/** 살아있는 이름. Prisma 가 스키마 이름을 하드코딩하므로(설계 3.1) 바뀌지 않는다. */
const LIVE = 'canonical';

interface Plan {
	/** 교체 뒤 `canonical` 이 될 스키마 — 지금 이 이름 밑에 새(또는 이전) 판이 있다. */
	incoming: string;
	/** 지금 `canonical` 이 물러날 이름. */
	outgoing: string;
	/** `incoming` 이 없을 때 사람에게 할 말. 조용히 넘어가지 않는다. */
	missingIncoming: string[];
	/** `outgoing` 이름이 이미 차 있을 때 어떻게 하나. */
	outgoingOccupied: 'drop' | 'refuse';
}

const PLANS: Record<Mode, Plan> = {
	promote: {
		incoming: 'wip',
		outgoing: 'canonical_bak',
		missingIncoming: [
			'wip 스키마가 없다. v2:promote 는 v2:build 가 구운 새 판을 승격하는 명령이라 wip 없이는 할 일이 없다.',
			'먼저 npm run v2:build 로 새 판을 구워라. 그 뒤 npm run v2:diff 로 무엇이 달라지는지 보고 승격해라.',
		],
		// 결정 3 — 이전 판은 하나만 남긴다. 다음 승격이 이전 bak 을 지운다.
		outgoingOccupied: 'drop',
	},
	rollback: {
		incoming: 'canonical_bak',
		outgoing: 'wip',
		missingIncoming: [
			'canonical_bak 스키마가 없다. 되돌릴 이전 판이 없다는 뜻이다.',
			'승격을 한 적이 없거나, 이미 되돌렸거나, 그다음 승격이 이전 판을 지웠다(설계 결정 3 — 이전 판은 하나만 남는다).',
		],
		// 승격과 달리 지우지 않는다. 되돌리기 중에 wip 이름이 차 있다는 것은 아직
		// 승격 안 한 새 판이 거기 있다는 뜻일 수 있고, 그건 지울 물건이 아니다.
		outgoingOccupied: 'refuse',
	},
};

async function exec(tx: Prisma.TransactionClient, sql: string): Promise<void> {
	console.log(`  ${sql}`);
	await tx.$executeRawUnsafe(sql);
}

/**
 * `app` 이 `LIVE` 를 참조하는 곳을 전부 읽어 온다 — FK 와 컬럼 타입 둘 다.
 *
 * **실명을 하드코딩하지 않는다.** 모델이 바뀌면 이름이 바뀌고, 손으로 옮겨 적은
 * 목록은 그때 조용히 하나를 빠뜨린다.
 */
async function readAppBindings(
	prisma: PrismaClient,
): Promise<{ fks: AppFk[]; others: AppFk[]; types: AppTypeColumn[] }> {
	const deps = await appDependencies(prisma);
	return {
		fks: deps.filter((d) => d.foreignSchema === LIVE),
		others: deps.filter((d) => d.foreignSchema !== LIVE),
		types: await appTypeColumns(prisma, LIVE),
	};
}

/**
 * 재부착의 전제 확인 — 정의문이 `canonical` 을 **이름으로** 한정하고 있어야 한다.
 * 한정이 없으면 `search_path` 로 풀리므로 교체 뒤 어느 판을 가리킬지 알 수 없다
 * (`qualifiesSchema` 주석 참고). 트랜잭션을 열기 전에 확인한다.
 */
function assertQualified(fks: AppFk[], types: AppTypeColumn[]): void {
	const bad = [
		...fks.filter((f) => !qualifiesSchema(f.def, LIVE)).map((f) => `FK app.${f.table}.${f.name}: ${f.def}`),
		...types
			.filter((t) => !qualifiesSchema(t.typeText, LIVE))
			.map((t) => `타입 app.${t.table}.${t.column}: ${t.typeText}`),
	];
	if (bad.length === 0) return;
	throw new Error(
		[
			`카탈로그가 찍어 준 정의문이 "${LIVE}" 를 이름으로 한정하지 않았다 — 그대로 다시 실행하면 어느 판을 가리킬지 알 수 없다.`,
			...bad.map((b) => `  ${b}`),
			`접속의 search_path 에 ${LIVE} 이 들어 있으면 이렇게 된다. DATABASE_URL 의 ?schema= 를 확인해라.`,
		].join('\n'),
	);
}

/**
 * ★ 승격의 선검사 — 트랜잭션을 **시작하기 전에** `app` 무결성을 본다.
 *
 * 재부착이 어차피 검사 역할을 하므로(설계 6.2) 이 검사 없이도 잘못된 승격은
 * 막힌다 — 트랜잭션이 통째로 되돌아간다. **하지만 그때 사람이 보는 것은
 * PostgreSQL 원시 오류다**("violates foreign key constraint"). 어느 id 가 문제인지
 * 도, 무엇을 해야 하는지도 안 나온다. 먼저 검사해서 사람이 읽을 이유를 낸다.
 *
 * **v2:diff 의 종료 코드에는 연동하지 않는다.** diff 가 1을 내는 것은 "차이가
 * 있다"는 뜻이고, 패치가 들어온 뒤라면 차이가 있는 게 정상이며 그걸 승격하려는
 * 것이다. promote 는 자기 검사만 한다.
 *
 * 0행이면 「0행 · 확인할 것 없음」으로 **아무 일도 안 했다는 사실이 보이게** 찍는다
 * (`skipped`) — 조용히 "문제 없음"만 찍으면 나중에 진짜 문제를 놓친다.
 */
async function precheckAppIntegrity(prisma: PrismaClient, target: string): Promise<void> {
	const blocked: string[] = [];
	for (const check of APP_FK_CHECKS) {
		const r = await appIntegrityCheck(prisma, check, target);
		if (r.skipped) {
			console.log(`  app.${check.table} 0행 · 확인할 것 없음`);
			continue;
		}
		if (r.missingIds.length === 0) {
			console.log(
				`  app.${check.table} ${r.total.toLocaleString()}행 · 문제 없음 — 전부 ${target}.${check.targetTable} 에서 찾아진다`,
			);
			continue;
		}
		blocked.push(
			`  app.${check.table}.${check.fkColumn} ${r.total.toLocaleString()}행 중 ${r.missingIds.length}건이 ` +
				`${target}.${check.targetTable} 에 없다: ${formatIds(r.missingIds)}`,
		);
	}
	if (blocked.length === 0) return;
	throw new Error(
		[
			`app 이 ${target} 에 없는 것을 가리킨다 — 승격하면 FK 재부착에서 트랜잭션이 통째로 되돌아간다.`,
			'트랜잭션을 시작하지 않았다. DB 는 한 글자도 안 바뀌었다.',
			...blocked,
			'',
			'할 일 — 셋 중 하나다.',
			`  1. 그 id 가 새 판에서 왜 빠졌는지 본다. 콜라보 기프트가 원본에서 빠지는 일이 실재한다(설계 6.2).`,
			`     빠지면 안 되는 것이면 적재기를 고치고 npm run v2:build 로 다시 구워라.`,
			`  2. 빠지는 것이 맞다면 그 id 를 가리키는 app 행을 먼저 정리해라.`,
			`  3. npm run v2:diff 로 무엇이 사라지는지 전체를 먼저 읽어라.`,
		].join('\n'),
	);
}

/**
 * 교체 뒤 어느 이름이 무엇을 들고 있는지 — 실패했을 때 사람이 되돌릴 근거다.
 * `build-canonical.ts` 의 같은 이름 함수와 같은 역할이고, 여기서는 교체가 원자적이라
 * **대개 "아무것도 안 바뀌었다"가 답이다.** 그 사실을 말해 주는 것이 중요하다 —
 * 사람이 모르면 멀쩡한 DB 를 손으로 고치려 들 수 있다.
 *
 * 위험한 자리는 트랜잭션 **밖**이다: 선검사 중, 상태를 읽는 중, 접속이 끊긴 경우.
 * 그래서 세 이름의 실제 존재 여부를 다시 읽어서 찍는다. 이전 판 삭제는 2차 리뷰
 * 뒤로 트랜잭션 **안**에 있으므로 여기서 따로 다룰 갈래가 없다 — 실패하면 되살아난다.
 */
async function reportFailureAndRecovery(
	prisma: PrismaClient,
	mode: Mode,
	plan: Plan,
): Promise<void> {
	const live = await schemaExists(prisma, LIVE);
	const incoming = await schemaExists(prisma, plan.incoming);
	const outgoing = await schemaExists(prisma, plan.outgoing);

	console.error(`\n${mode} 가 실패했다.`);
	console.error(
		`지금 상태 — ${LIVE} 존재: ${live} · ${plan.incoming} 존재: ${incoming} · ${plan.outgoing} 존재: ${outgoing}`,
	);

	if (live && incoming) {
		console.error('교체 전 상태 그대로다 — 살아있는 판도 새 판도 제자리에 있다. 한 행도 안 바뀌었다.');
		console.error(`위 오류를 고친 뒤 npm run v2:${mode} 를 다시 돌리면 된다.`);
		return;
	}
	if (live && !incoming) {
		console.error(
			`${LIVE} 은 있고 ${plan.incoming} 이 없다 — 교체 자체는 끝났고 그 뒤(확인 단계)에서 죽었을 수 있다.`,
		);
		console.error(`${LIVE} 이 어느 판인지 행수로 확인해라(예: SELECT count(*) FROM ${LIVE}.gift).`);
		if (mode === 'promote') console.error('되돌리려면 npm run v2:rollback.');
		return;
	}
	// 여기부터는 canonical 이라는 이름이 비어 있다 — 원자적 교체에서는 나올 수 없는
	// 상태다. 그래도 갈래를 빠뜨리면 사람이 복구 명령 없이 갇힌다.
	console.error(`${LIVE} 이라는 이름이 비어 있다 — 원자적 교체에서는 나올 수 없는 상태다. 손으로 되돌려야 한다.`);
	if (outgoing) {
		console.error(`살아있던 판은 ${plan.outgoing} 에 있을 가능성이 높다. 행수를 확인한 뒤:`);
		console.error(`  ${renameSchema(plan.outgoing, LIVE)}`);
	} else if (incoming) {
		console.error(`${plan.incoming} 만 남아 있다. 행수를 확인한 뒤:`);
		console.error(`  ${renameSchema(plan.incoming, LIVE)}`);
	} else {
		console.error(
			`${LIVE}·${plan.incoming}·${plan.outgoing} 어느 이름에도 판이 없다. 남은 스키마 목록을 직접 확인해라:`,
		);
		console.error(
			"  SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%'",
		);
	}
	console.error(`app 은 옛 판을 계속 가리키고 있을 수 있다 — 되돌린 뒤 npm run v2:${mode} 로 다시 맞춰라.`);
}

/**
 * 위 보고 자체가 실패할 수 있다 — 원인이 접속 끊김이면 상태를 읽는 질의도 다
 * 던진다. 그러면 원래 오류와 복구 안내가 둘 다 사라진다. 한 번 더 감싸서 최소한의
 * 안내는 남긴다(`build-canonical.ts` 의 같은 패턴).
 */
async function safeReportFailureAndRecovery(
	prisma: PrismaClient,
	mode: Mode,
	plan: Plan,
): Promise<void> {
	try {
		await reportFailureAndRecovery(prisma, mode, plan);
	} catch (reportErr) {
		console.error('\n상태를 못 읽었다 — 복구 안내를 못 만든다. 원인:', reportErr);
		console.error('스키마 이름을 직접 확인해라:');
		console.error(
			"  SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%'",
		);
		console.error(`교체는 한 트랜잭션이라 ${LIVE} 이 살아 있으면 아무것도 안 바뀐 것이다.`);
	}
}

/** 끝 상태를 직접 세서 찍는다 — 전역 제약(raw 43,270 · field_override 5)이 지켜졌는지 매번 눈에 보이게. */
async function reportFinalState(prisma: PrismaClient, plan: Plan): Promise<void> {
	const [liveTables, outgoingTables, overrides, rawObjects] = await Promise.all([
		tableCount(prisma, LIVE),
		tableCount(prisma, plan.outgoing),
		exactCount(prisma, 'app', 'field_override'),
		exactCount(prisma, 'raw', 'raw_object'),
	]);
	console.log(`\n끝 상태 — ${LIVE} ${liveTables}테이블 · ${plan.outgoing} ${outgoingTables}테이블`);
	console.log(
		`app.field_override ${overrides}행 · raw.raw_object ${rawObjects.toLocaleString()}행 (둘 다 이 명령이 건드리지 않는다)`,
	);

	const { fks, types } = await readAppBindings(prisma);
	for (const f of fks) console.log(`app.${f.table}.${f.name} → ${f.foreignSchema}`);
	for (const t of types) console.log(`app.${t.table}.${t.column} : ${t.typeText}`);
	if (fks.length === 0 && types.length === 0) {
		console.log(`app 이 ${LIVE} 을 가리키는 곳이 하나도 없다 — 재조준이 안 붙었다는 뜻이다. 조사해라.`);
	}
}

async function main(): Promise<void> {
	const mode = process.argv[2];
	if (mode !== 'promote' && mode !== 'rollback') {
		throw new Error(
			`무엇을 할지 안 골랐다: ${mode ?? '(없음)'}\n` +
				'npm run v2:promote 또는 npm run v2:rollback 을 써라.',
		);
	}
	const plan = PLANS[mode];
	const prisma = new PrismaClient();
	let started = false;

	try {
		console.log(
			`v2:${mode} — ${LIVE} → ${plan.outgoing} · ${plan.incoming} → ${LIVE} 를 한 트랜잭션으로 바꾼다`,
		);

		console.log('\n0. 선점·존재 확인');
		if (!(await schemaExists(prisma, plan.incoming))) {
			throw new Error(plan.missingIncoming.join('\n'));
		}
		if (!(await schemaExists(prisma, LIVE))) {
			throw new Error(
				`${LIVE} 스키마가 없다 — 있어야 할 살아있는 판이 없다. DB 상태를 먼저 확인해라. ` +
					`${plan.incoming} 만 있는 상태라면 손으로 ${renameSchema(plan.incoming, LIVE)} 로 되돌린 뒤 다시 판단해라.`,
			);
		}
		console.log(`  ${plan.incoming} 있음 · ${LIVE} 있음`);

		console.log(`\n1. app 이 ${LIVE} 을 가리키는 곳 — 카탈로그에서 읽는다(실명 하드코딩 없음)`);
		const { fks, others, types } = await readAppBindings(prisma);
		for (const f of fks) console.log(`  FK   app.${f.table} · ${f.name}\n         ${f.def}`);
		for (const t of types) console.log(`  타입 app.${t.table}.${t.column} · ${t.typeText}`);
		if (fks.length === 0) {
			console.log(`  app → ${LIVE} FK 가 하나도 없다 — 뗐다 붙일 것이 없다는 뜻이다. 예상 밖이면 조사해라.`);
		}
		if (others.length > 0) {
			// app 안끼리의 FK 넷은 애초에 질의에서 빠진다(schema-ops 의 appDependencies).
			// 여기 걸리는 것은 app 이 canonical 도 app 도 아닌 스키마를 참조하는 경우다.
			console.log(
				`  건드리지 않는 FK ${others.length}건 — ${others.map((o) => `${o.table}.${o.name}→${o.foreignSchema}`).join(', ')}`,
			);
		}
		assertQualified(fks, types);

		// 조립을 먼저 끝낸다 — 식별자 모양 검사에 걸리는 실패가 교체 도중에 나면 안 된다.
		const { drop, add } = rebindSql(fks);
		const retarget = retargetTypeSql(types);

		console.log(`\n2. 선검사 — app 이 가리키는 것이 ${plan.incoming} 에 다 있나 (트랜잭션 전)`);
		await precheckAppIntegrity(prisma, plan.incoming);

		console.log(`\n3. ${plan.outgoing} 이름 정리 — 무엇을 지울지 정하기만 하고, 지우는 것은 트랜잭션 안이다`);
		let dropOutgoing: string | null = null;
		if (await schemaExists(prisma, plan.outgoing)) {
			if (plan.outgoingOccupied === 'refuse') {
				throw new Error(
					[
						`${plan.outgoing} 스키마가 이미 있다. ${mode} 는 ${LIVE} 을 그 이름으로 옮기려 하는데 자리가 차 있다.`,
						`이 명령은 그 자리를 말없이 비우지 않는다 — 무엇이 있는지 사람이 먼저 봐야 한다.`,
						'',
						`전형적인 경우는 「승격 뒤 v2:build 로 새 판을 구워 둔 상태」다. 그렇다면 ${plan.outgoing} 은`,
						`막 구운 판이라 버리면 안 된다. 옆으로 치우고 되돌려라:`,
						`  ALTER SCHEMA "${plan.outgoing}" RENAME TO "${plan.outgoing}_keep"`,
						`  npm run v2:${mode}`,
						`되돌린 뒤 그 판을 다시 승격하려면 "${plan.outgoing}_keep" 을 "${plan.outgoing}" 으로 되돌려 놓으면 된다.`,
						'',
						`정말 버릴 물건이라고 확인했으면 그때 DROP SCHEMA "${plan.outgoing}" CASCADE 로 지우고 다시 돌려라.`,
					].join('\n'),
				);
			}
			const tables = await tableCount(prisma, plan.outgoing);
			// CASCADE 는 스키마 밖에서 이것을 참조하는 것도 말없이 같이 지운다. 지운
			// 뒤에는 무엇이 있었는지 알 방법이 없으므로 먼저 세어서 찍는다.
			const dependents = await outsideDependents(prisma, plan.outgoing);
			if (dependents.length > 0) {
				throw new Error(
					[
						`${plan.outgoing} 을 스키마 밖에서 참조하는 것이 ${dependents.length}건 있다.`,
						`DROP SCHEMA … CASCADE 는 이것들을 말없이 같이 지운다 — 그래서 멈춘다.`,
						...dependents.map((d) => `  ${d}`),
						'',
						`정상이라면 0건이어야 한다. 이전 판(${plan.outgoing})은 지난 승격이 app 을 이미 새 판으로`,
						`돌려놨으므로 아무도 안 가리킨다. 위 목록은 누군가 손으로 만든 것일 가능성이 높다 —`,
						`무엇인지 확인하고 옮기거나 지운 뒤 다시 돌려라.`,
					].join('\n'),
				);
			}
			console.log(
				`  이전 ${plan.outgoing} 이 있다(${tables}테이블) · 스키마 밖에서 이것을 참조하는 것 0건 — CASCADE 가 딸려 지울 것이 없다.`,
			);
			console.log(
				`  설계 결정 3 — 이전 판은 하나만 남긴다. 아래 트랜잭션의 첫 문장으로 지운다(교체가 실패하면 되살아난다).`,
			);
			dropOutgoing = `DROP SCHEMA ${ident(plan.outgoing)} CASCADE`;
		} else {
			console.log(`  ${plan.outgoing} 없음 — 지울 것 없다.`);
		}

		console.log('\n4. 한 트랜잭션 — 이전 판 지우기 · FK 떼기 · 이름 교체 · 타입 재지정 · FK 붙이기');
		started = true;
		await prisma.$transaction(
			async (tx) => {
				// 이전 판 삭제도 트랜잭션 **안**이다. 밖에 두면 여기서만 원자성이
				// 깨진다 — 삭제가 성공하고 교체가 실패하면 승격은 안 됐는데 N-1
				// 백업만 영구히 사라진다. 트랜잭션이 되돌아가도 그건 안 돌아온다.
				// PostgreSQL 은 DROP SCHEMA 도 트랜잭션이라 그대로 들어간다.
				if (dropOutgoing) await exec(tx, dropOutgoing);
				for (const sql of drop) await exec(tx, sql);
				await exec(tx, renameSchema(LIVE, plan.outgoing));
				await exec(tx, renameSchema(plan.incoming, LIVE));
				// enum 재지정은 app.run 이 0행이어도 필요하다 — 컬럼이 옛 스키마의
				// 타입을 가리키면 그 스키마를 나중에 못 지운다.
				for (const sql of retarget) await exec(tx, sql);
				for (const sql of add) await exec(tx, sql);
			},
			// 기본 5초는 94테이블짜리 스키마 둘을 옮기기엔 빠듯할 수 있다. 넘치면
			// 트랜잭션이 되돌아갈 뿐이라 손해는 없지만, 넉넉히 준다.
			{ timeout: 120_000, maxWait: 30_000 },
		);
		console.log('\n  COMMIT — 여기까지 왔으면 교체가 끝났다.');

		await reportFinalState(prisma, plan);
		console.log(
			`\n${mode === 'promote' ? '승격했다' : '되돌렸다'}. ` +
				`이전 판은 ${plan.outgoing} 에 있다 — npm run v2:${mode === 'promote' ? 'rollback' : 'promote'} 로 다시 뒤집을 수 있다.`,
		);
		console.log('npm run v2:verify:canonical 로 새 canonical 을 확인해라.');
	} catch (err) {
		// 트랜잭션을 열기도 전에 거절한 경우(선검사·존재 확인·밖 의존)는 DB 가 안
		// 바뀌었고 오류 메시지가 이미 이유를 담고 있다 — 상태 보고를 덧붙이면 그
		// 메시지가 묻힌다. 트랜잭션을 열었을 때만 보고한다.
		if (started) {
			await safeReportFailureAndRecovery(prisma, mode, plan);
		}
		throw err;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
