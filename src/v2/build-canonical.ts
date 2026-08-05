/**
 * v2:build — 살아있는 canonical 을 옆으로 치우고 그 이름으로 새 판을 굽는다.
 *
 * Prisma multiSchema 가 스키마 이름을 하드코딩하므로(설계 3.1) 새 판도 잠깐은
 * `canonical` 이라는 이름이어야 한다. 살아있는 판은 그동안 `canonical_hold` 에 있다.
 *
 * 끝나면 새 판은 `wip`, 살아있는 판은 `canonical` 이다. **canonical 은 한 행도
 * 안 바뀐다.** 승격은 v2:promote 가 따로 한다.
 *
 * DDL 출처(Step 1 실측, 설계 9절): `prisma migrate diff --from-url` 은 못 쓴다.
 * canonical 을 옆으로 치운 순간 `app` 의 FK 가 그 이름을 따라가므로(설계 3.3),
 * 그 이름을 datasource 의 schemas 목록에 안 넣으면 P4002 로 죽고, 넣어서
 * 통과시키면 그 이름 밑의 살아있는 94테이블을 "여분"으로 보고 DROP TABLE·
 * DROP TYPE 105건을 낸다 — 살아있는 판을 지우는 문장이라 못 쓴다. 대신
 * `--from-empty` 산물(`npm run v2:schema:ddl` 이 만드는 `prisma/v2/schema.sql`,
 * raw·canonical·app 이 섞여 있다)을 `extractCanonicalDdl` 로 걸러 쓴다 — 빈
 * 상태에서 만드는 것이니 애초에 DROP 이 없다.
 *
 * 4단계(적재)의 「빈 canonical」가드(설계 결정 4, `load-canonical.ts`)는 테이블
 * 존재가 아니라 **행** 존재로 판정한다 — 방금 구운 DDL 은 테이블 94개·행 0개라
 * 우회로 없이 그대로 통과한다. 살아있는 판(테이블 94개·행 152,399개)은 여전히
 * 막힌다.
 */
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from './generated/client.js';
import {
	RESTORE_LIVE_SQL,
	renameSchema,
	schemaExists,
	tableCount,
	extractCanonicalDdl,
	tallyCanonicalDdl,
} from './schema-ops.js';

const SCHEMA_SQL_URL = new URL('../../prisma/v2/schema.sql', import.meta.url);

function runScript(script: string): void {
	console.log(`\n$ npm run ${script}`);
	const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
	if (result.error) {
		// spawnSync 자체가 npm 을 못 띄운 경우(예: PATH 문제) — status 가 null 이라
		// 아래 검사만으로는 원인이 사라진다. Node 가 준 오류를 그대로 실어 던진다.
		throw new Error(`npm run ${script} 을 띄우지 못했다: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`npm run ${script} 실패 (exit ${result.status ?? '알 수 없음'})`);
	}
}

async function alter(prisma: PrismaClient, sql: string): Promise<void> {
	console.log(sql);
	await prisma.$executeRawUnsafe(sql);
}

/**
 * canonical_hold 로 되돌리는 한 줄 — 여러 갈래에서 반복하므로 한 곳에 둔다.
 * SQL 자체는 `schema-ops` 가 갖는다(promote·diff 의 「build 가 중간에 죽었다」안내가
 * 같은 문장을 찍어야 해서다 — 세 곳이 각자 들고 있으면 언젠가 하나만 고친다).
 */
const RESTORE_LIVE_CMD = `  ${RESTORE_LIVE_SQL}    -- 살아있는 판을 복귀`;

/**
 * canonical_hold 를 옆으로 치운 뒤(2단계) 실패하면 여기서 지금 상태를 읽어
 * 되돌리는 방법을 알려 준다. **세 갈래 모두** 마지막엔 canonical_hold 를
 * canonical 로 되돌리는 명령을 찍는다 — 갈래를 하나라도 빠뜨리면 사람이 복구
 * 명령 없이 갇힌다(리뷰에서 실제로 하나 빠져 있었다: canonical 도 wip 도 없는
 * 경우 — 3단계 초입, 즉 파일을 못 읽거나 걸러낸 문장이 0개이거나 첫 DDL
 * 문장부터 실패한 경우다).
 */
async function reportFailureAndRecovery(prisma: PrismaClient): Promise<void> {
	const liveNamedCanonical = await schemaExists(prisma, 'canonical');
	const holdExists = await schemaExists(prisma, 'canonical_hold');
	const wipExists = await schemaExists(prisma, 'wip');
	console.error('\n실패했다. 이름 바꾸기의 남은 단계를 더 진행하지 않는다.');
	console.error(
		`지금 상태 — canonical 존재: ${liveNamedCanonical} · canonical_hold 존재: ${holdExists} · wip 존재: ${wipExists}`,
	);
	if (!holdExists) {
		console.error(
			'canonical_hold 가 없다 — 이미 되돌아갔거나 애초에 옆으로 치우기 전에 실패한 것이다. ' +
				'위 로그에서 어느 단계였는지 확인해라.',
		);
		return;
	}
	console.error('살아있던 판은 canonical_hold 에 안전하게 있다 — 이 실행으로 한 행도 안 바뀌었다.');
	console.error('되돌리려면:');
	if (liveNamedCanonical) {
		console.error('지금 canonical 이름은 새로 굽다 만(또는 검사에 실패한) 판이다 — 조사할 수 있게 그대로 뒀다.');
		console.error('  ALTER SCHEMA "canonical" RENAME TO "canonical_failed"   -- 실패한 새 판을 비키고');
		console.error(RESTORE_LIVE_CMD);
		console.error('그 뒤 canonical_failed 를 살펴본 뒤 필요 없으면 DROP SCHEMA "canonical_failed" CASCADE 로 지운다.');
	} else if (wipExists) {
		console.error('새 판은 이미 wip 이름으로 옮겨졌다 — canonical 자리는 비어 있다.');
		console.error(RESTORE_LIVE_CMD);
	} else {
		console.error(
			'canonical 도 wip 도 없다 — 3단계 초입(schema.sql 읽기·문장 0개·첫 DDL 문장)에서 죽었다는 뜻이다.',
		);
		console.error('새로 굽던 판이 없으니 비킬 것도 없다.');
		console.error(RESTORE_LIVE_CMD);
	}
}

/**
 * 2단계(옆으로 치우기) 뒤에 실패하면 위 함수로 상태를 읽어 복구 안내를 찍는다.
 * **그 읽기 자체가 실패할 수 있다** — 원인이 DB 접속 끊김이면 세 번의
 * `schemaExists` 질의도 다 던진다. 그러면 원래 오류와 복구 안내가 둘 다
 * 사라진다. 여기서 한 번 더 감싸서 최소한의 안내는 남긴다.
 */
async function safeReportFailureAndRecovery(prisma: PrismaClient): Promise<void> {
	try {
		await reportFailureAndRecovery(prisma);
	} catch (reportErr) {
		console.error('\n상태를 못 읽었다 — 복구 안내를 못 만든다. 원인:', reportErr);
		console.error('canonical_hold 가 남아 있으면 손으로 되돌려라:');
		console.error(RESTORE_LIVE_CMD);
	}
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	let movedLiveAside = false;
	try {
		console.log('1. 선점 확인 — wip · canonical_hold 가 이미 있으면 멈춘다');
		const liveExists = await schemaExists(prisma, 'canonical');
		const holdExists = await schemaExists(prisma, 'canonical_hold');
		if (await schemaExists(prisma, 'wip')) {
			// canonical 이 있는지 먼저 본다. 없으면 wip 이 **남은 유일한 판**일 수
			// 있어서 무조건 "지워라"는 위험한 안내가 된다 — 아래 canonical_hold 거부가
			// 「어느 쪽이 살아있는 판인지 먼저 조사해라」로 신중한 것과 같은 수준을
			// 여기도 지킨다.
			throw new Error(
				[
					'wip 스키마가 이미 있다. 앞선 v2:build 산물을 말없이 덮지 않는다.',
					...(liveExists
						? [
								'canonical 이 제자리에 있으므로 wip 은 아직 승격 안 한 새 판이다.',
								'승격할 물건이면 npm run v2:diff 로 대조한 뒤 npm run v2:promote 를 써라.',
								'정말 버릴 물건이라고 확인했으면 DROP SCHEMA "wip" CASCADE 로 지우고 다시 돌려라.',
							]
						: [
								'canonical 이 없다 — wip 이 지금 남은 유일한 판일 수 있으므로 지우라고 말하지 않는다.',
								...(holdExists
									? [
											'canonical_hold 가 있다. v2:build 가 중간에 죽은 흔적이고, 살아있는 판은 그쪽이다 —',
											`먼저 ${RESTORE_LIVE_SQL} 로 복귀시킨 뒤 wip 을 어떻게 할지 판단해라.`,
										]
									: [
											'canonical_hold 도 없다. 어느 스키마에 무엇이 있는지 먼저 조사해라:',
											"  SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%'",
											'행수를 비교하면 어느 것이 살아있는 판인지 알 수 있다(예: gift 582).',
										]),
							]),
				].join('\n'),
			);
		}
		if (holdExists) {
			throw new Error(
				'canonical_hold 가 이미 있다. 앞선 v2:build 가 중간에 죽은 흔적이다. ' +
					'canonical(지금 이름)과 canonical_hold 중 어느 쪽이 살아있는 판인지 먼저 조사해라 — ' +
					'행수를 비교하면 알 수 있다(예: gift 582). ' +
					'canonical_hold 가 살아있는 판이라고 확인되면(지금 canonical 이름은 실패한 새 판이거나 ' +
					'비어 있다) 되돌린다: 지금 canonical 에 뭔가 있으면 먼저 ' +
					'ALTER SCHEMA "canonical" RENAME TO "canonical_failed" 로 비키고, ' +
					'ALTER SCHEMA "canonical_hold" RENAME TO "canonical" 로 복귀해라.',
			);
		}

		console.log('\n2. 살아있는 canonical 을 옆으로 — canonical → canonical_hold');
		await alter(prisma, renameSchema('canonical', 'canonical_hold'));
		movedLiveAside = true;

		console.log('\n3. 새 canonical DDL');
		// schema.prisma 를 고치고 v2:schema:ddl 을 깜빡하면 커밋된 schema.sql 이
		// 낡은 채로 굽는다 — 검사 203건은 행 수만 보므로 그 누락을 못 잡는다.
		// v2:schema:ddl 은 DB 접속이 필요 없고 결정적이다(재실행해도 바이트가
		// 같다 — 확인함). 매번 다시 만들어 source-of-truth 를 schema.prisma 로
		// 고정한다.
		runScript('v2:schema:ddl');

		const fullDdl = await readFile(SCHEMA_SQL_URL, 'utf8');
		const statements = extractCanonicalDdl(fullDdl);
		if (statements.length === 0) {
			throw new Error(
				'prisma/v2/schema.sql 에서 canonical 문장을 하나도 못 걸렀다. ' +
					'npm run v2:schema:ddl 로 다시 만들었는지, 파일 형식이 바뀌지 않았는지 확인해라.',
			);
		}

		// extractCanonicalDdl 이 뭔가를 빠뜨렸는지 — 원본과 걸러낸 것을 종류별로
		// 독립 집계해 서로 비교한다. 검사 203건은 행 수만 보므로 인덱스나 FK 가
		// 통째로 빠져도 통과한다 — 그 누락을 잡는 실질적 방어선은 여기뿐이다.
		const originalTally = tallyCanonicalDdl(fullDdl);
		const filteredTally = tallyCanonicalDdl(statements.join('\n'));
		console.log('canonical 문장 종류별 개수 (원본 → 걸러낸 것):');
		for (const label of Object.keys(originalTally)) {
			console.log(`  ${label.padEnd(34)} ${originalTally[label]} → ${filteredTally[label]}`);
		}
		const mismatches = Object.keys(originalTally).filter(
			(label) => originalTally[label] !== filteredTally[label],
		);
		if (mismatches.length > 0) {
			throw new Error(
				`extractCanonicalDdl 이 걸러내며 무언가를 빠뜨렸다: ${mismatches.join(', ')}. ` +
					'prisma/v2/schema.sql 의 형식이 바뀌었을 수 있다 — 걸러내는 조건을 다시 봐야 한다.',
			);
		}

		console.log(`\n집계가 맞다 — ${statements.length}개 문장을 실행한다`);
		for (const stmt of statements) {
			await prisma.$executeRawUnsafe(stmt);
		}
		const built = await tableCount(prisma, 'canonical');
		const liveTableCount = await tableCount(prisma, 'canonical_hold');
		console.log(`새 canonical 테이블 ${built}개 생성 (canonical_hold ${liveTableCount}개와 대조)`);
		if (built !== liveTableCount) {
			throw new Error(
				`새 canonical 테이블 수(${built})가 살아있는 canonical_hold(${liveTableCount})와 다르다.`,
			);
		}

		console.log('\n4. 적재 — npm run v2:canonical (canonical_hold 는 건드리지 않는다)');
		// 적재기의 「빈 canonical」가드(설계 결정 4)는 행 존재로 판정한다 —
		// load-canonical.ts 참고. 방금 구운 DDL 은 테이블만 있고 행이 없으므로
		// 우회로 없이 그대로 통과한다.
		runScript('v2:canonical');

		console.log('\n5. 검사 — npm run v2:verify:canonical');
		runScript('v2:verify:canonical');

		console.log('\n6. 새 판을 wip 으로 — canonical → wip');
		await alter(prisma, renameSchema('canonical', 'wip'));

		console.log('\n7. 살아있는 판 복귀 — canonical_hold → canonical');
		await alter(prisma, renameSchema('canonical_hold', 'canonical'));

		const liveCount = await tableCount(prisma, 'canonical');
		const wipCount = await tableCount(prisma, 'wip');
		console.log(`\ncanonical ${liveCount}테이블 · wip ${wipCount}테이블`);
	} catch (err) {
		if (movedLiveAside) await safeReportFailureAndRecovery(prisma);
		throw err;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
