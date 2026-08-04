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
import { renameSchema, schemaExists, tableCount, extractCanonicalDdl } from './schema-ops.js';

const SCHEMA_SQL_URL = new URL('../../prisma/v2/schema.sql', import.meta.url);

function runScript(script: string): void {
	console.log(`\n$ npm run ${script}`);
	const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
	if (result.status !== 0) {
		throw new Error(`npm run ${script} 실패 (exit ${result.status ?? '알 수 없음'})`);
	}
}

async function alter(prisma: PrismaClient, sql: string): Promise<void> {
	console.log(sql);
	await prisma.$executeRawUnsafe(sql);
}

/** canonical_hold 를 옆으로 치운 뒤 실패하면 여기서 지금 상태를 읽어 되돌리는 방법을 알려 준다. */
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
	if (liveNamedCanonical) {
		console.error('지금 canonical 이름은 새로 굽다 만(또는 검사에 실패한) 판이다 — 조사할 수 있게 그대로 뒀다.');
		console.error('되돌리려면:');
		console.error('  ALTER SCHEMA "canonical" RENAME TO "canonical_failed"   -- 실패한 새 판을 비키고');
		console.error('  ALTER SCHEMA "canonical_hold" RENAME TO "canonical"    -- 살아있는 판을 복귀');
		console.error('그 뒤 canonical_failed 를 살펴본 뒤 필요 없으면 DROP SCHEMA "canonical_failed" CASCADE 로 지운다.');
	} else if (wipExists) {
		console.error('새 판은 이미 wip 이름으로 옮겨졌다 — canonical 자리는 비어 있다.');
		console.error('되돌리려면:');
		console.error('  ALTER SCHEMA "canonical_hold" RENAME TO "canonical"    -- 살아있는 판을 복귀');
	}
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	let movedLiveAside = false;
	try {
		console.log('1. 선점 확인 — wip · canonical_hold 가 이미 있으면 멈춘다');
		if (await schemaExists(prisma, 'wip')) {
			throw new Error(
				'wip 스키마가 이미 있다. 앞선 v2:build 산물을 말없이 덮지 않는다. ' +
					'필요 없으면 지우고("DROP SCHEMA wip CASCADE") 다시 돌려라.',
			);
		}
		if (await schemaExists(prisma, 'canonical_hold')) {
			throw new Error(
				'canonical_hold 가 이미 있다. 앞선 v2:build 가 중간에 죽은 흔적이다. ' +
					'canonical(지금 이름)과 canonical_hold 중 어느 쪽이 살아있는 판인지 먼저 조사해라 — ' +
					'행수를 비교하면 알 수 있다(예: gift 582).',
			);
		}

		console.log('\n2. 살아있는 canonical 을 옆으로 — canonical → canonical_hold');
		await alter(prisma, renameSchema('canonical', 'canonical_hold'));
		movedLiveAside = true;

		console.log('\n3. 새 canonical DDL — prisma/v2/schema.sql 에서 canonical 문장만 걸러 실행한다');
		const fullDdl = await readFile(SCHEMA_SQL_URL, 'utf8');
		const statements = extractCanonicalDdl(fullDdl);
		if (statements.length === 0) {
			throw new Error(
				'prisma/v2/schema.sql 에서 canonical 문장을 하나도 못 걸렀다. ' +
					'npm run v2:schema:ddl 로 다시 만들었는지, 파일 형식이 바뀌지 않았는지 확인해라.',
			);
		}
		console.log(`${statements.length}개 문장을 실행한다 (raw·app 문장은 뺐다):`);
		for (const stmt of statements) {
			// 각 문장은 "-- CreateTable" 류 헤더 주석 + SQL 한 문장이다. 헤더만 찍는다.
			console.log(`  ${stmt.split('\n')[0]}`);
		}
		for (const stmt of statements) {
			await prisma.$executeRawUnsafe(stmt);
		}
		const built = await tableCount(prisma, 'canonical');
		console.log(`새 canonical 테이블 ${built}개 생성`);

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
		if (movedLiveAside) await reportFailureAndRecovery(prisma);
		throw err;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
