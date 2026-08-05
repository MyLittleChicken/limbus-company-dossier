/**
 * 재현 시험 — 원본을 지우고 처음부터 다시 만들어도 같은 DB 가 나오는가.
 *
 * ADR-02 원칙 3(같은 입력이면 같은 결과)과 ADR-06 의 「스냅샷은 쌓는다」가
 * 실제로 성립하는지 **전 과정을 다시 밟아** 확인한다.
 *
 *   1. DB 를 pg_dump 로 뜨고 원본 체크섬을 남긴다
 *   2. data/entities/ 를 지운다
 *   3. npm run fetch 로 원격에서 다시 받는다 (manifest 의 커밋 해시 고정)
 *   4. 파일 체크섬을 대조한다        ← 수집기가 같은 바이트를 냈나
 *   5. DB 를 통째로 다시 만든다
 *   6. 덤프를 대조한다               ← 파이프라인이 같은 결과를 냈나
 *
 * **`data/assets/` 는 건드리지 않는다.** v2 파이프라인이 한 번도 읽지 않으며,
 * 그중 16건(`v1-local`)은 지금 존재하지 않는 로컬 저장소에서 와 복원이 안 된다.
 *
 * 실행: npm run v2:reproduce
 *
 * 되돌릴 수 없는 작업이라 기본은 **모의 실행**이다. 실제로 지우려면
 * `npm run v2:reproduce -- --run` 을 쓴다.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ENTITIES, ROOT, listEntityFiles } from './paths.js';

const WORK = join(ROOT, 'build', 'reproduce');

/** 덤프에 담는 스키마. `app` 도 대조 대상이다 — 저작이 안 바뀌었음을 보이려면 담아야 한다. */
const DUMP_SCHEMAS = ['raw', 'canonical', 'app'];

/**
 * **`app` 의 내용은 살린다.**
 *
 * `app` 은 수집기·변환기가 만드는 것이 아니라 사람이 넣는 것이다. 저작 사실
 * (`ref_exception` · `ego_granted_axis`)과 값 정정(`field_override`)이 여기 있고,
 * 이건 재빌드의 **입력**이다(ADR-08). 지우고 구우면 자기가 검증하려는 입력을
 * 없애고 굽는 꼴이 된다 — 결과가 다르게 나오고, 그 다름은 비결정성이 아니다.
 * 지금까지는 경고 한 줄로만 막고 있었다.
 *
 * **구조는 그대로 다시 만든다.** `app` 테이블만 남기면 `schema.sql` 재적용이
 * `ON_ERROR_STOP=1` 에서 깨지고, `app → canonical` FK 는 어차피
 * `DROP SCHEMA canonical CASCADE` 에 딸려 사라진다. 그래서 스키마 셋을 다 지우되
 * **`app` 의 행만 따로 떠 두었다가 되넣는다.**
 */
const RESTORE_APP_DATA = true;

/**
 * `canonical.build_info.built_at` 의 타임스탬프. 굽는 순간이라 매번 다르므로
 * 바이트 단위 대조에서 뺀다. 나머지 열(`snapshot_id` · `code_commit` ·
 * `authored_digest` · `row_count`)은 같은 입력이면 같으므로 대조에 남긴다.
 *
 * 같은 꼴의 다른 타임스탬프(`app.field_override.created_at` ·
 * `raw.snapshot.created_at`)도 함께 지워지는데, 그 둘은 재현 시험에서 안 바뀌는
 * 값이라 지워도 대조가 약해지지 않는다.
 */
const TIMESTAMP = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}/g;

function sh(cmd: string, args: string[]): string {
	return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

/** `pg_dump` 산출물. 세션 토큰 줄과 타임스탬프는 매번 달라지므로 뺀다. */
function dumpDatabase(): string {
	const raw = sh('docker', [
		'compose', 'exec', '-T', 'postgres',
		'pg_dump', '-U', 'postgres', '-d', 'limbus',
		...DUMP_SCHEMAS.flatMap((s) => ['-n', s]),
		'--no-owner',
	]);
	return raw
		.split('\n')
		.filter((l) => !l.startsWith('\\restrict') && !l.startsWith('\\unrestrict'))
		.map((l) => l.replace(TIMESTAMP, '<timestamp>'))
		.join('\n');
}

/** `data/entities` 전 파일의 체크섬. 경로순으로 정렬해 한 문자열로 만든다. */
function entityChecksums(): string {
	return listEntityFiles()
		.map((p) => `${createHash('sha256').update(readFileSync(p)).digest('hex')}  ${p}`)
		.join('\n');
}

function sha(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

async function main(): Promise<void> {
	const run = process.argv.includes('--run');
	mkdirSync(WORK, { recursive: true });

	console.log('재현 시험');
	console.log(`  모드   ${run ? '실제 실행 — data/entities 를 지운다' : '모의 실행 (--run 으로 실제 실행)'}`);
	console.log('');

	// ── 1. 스냅샷 ────────────────────────────────────────────────
	const filesBefore = entityChecksums();
	const dumpBefore = dumpDatabase();
	writeFileSync(join(WORK, 'files-before.sha'), filesBefore);
	writeFileSync(join(WORK, 'dump-before.sql'), dumpBefore);
	console.log(`  스냅샷 파일 ${filesBefore.split('\n').length}개 · 덤프 ${(dumpBefore.length / 1024 / 1024).toFixed(1)} MB`);
	console.log(`         파일 해시 ${sha(filesBefore).slice(0, 16)}`);
	console.log(`         덤프 해시 ${sha(dumpBefore).slice(0, 16)}`);

	if (!run) {
		console.log('');
		console.log('  모의 실행이라 여기서 멈춘다. 아래가 실제로 벌어질 일이다.');
		console.log('    rm -rf data/entities');
		console.log('    npm run fetch');
		console.log('    pg_dump --data-only -n app          ← app 의 행을 떠 둔다');
		console.log('    npm run db:ddl -- -c "DROP SCHEMA raw, canonical, app CASCADE"');
		console.log('    npm run db:ddl < prisma/v2/schema.sql');
		console.log('    psql < app-data.sql                 ← app 의 행을 되넣는다');
		console.log('    npm run v2:load && npm run v2:canonical');
		console.log('');
		console.log('  **app 의 내용은 살린다.** 저작 사실과 값 정정은 재빌드의 입력이다(ADR-08) —');
		console.log('  지우고 구우면 자기가 검증하려는 입력을 없애고 굽는 꼴이 된다.');
		console.log('  구조는 그대로 다시 만든다 — app → canonical FK 가 canonical 과 함께 사라지고,');
		console.log('  app 테이블을 남기면 schema.sql 재적용이 ON_ERROR_STOP 에서 깨진다.');
		return;
	}

	// ── 2·3. 지우고 다시 받는다 ───────────────────────────────────
	console.log('');
	console.log('  data/entities 제거');
	rmSync(ENTITIES, { recursive: true, force: true });
	if (existsSync(ENTITIES)) throw new Error('data/entities 가 지워지지 않았다');

	console.log('  재수집 (npm run fetch)');
	sh('npm', ['run', 'fetch']);

	// ── 4. 파일 대조 ─────────────────────────────────────────────
	const filesAfter = entityChecksums();
	writeFileSync(join(WORK, 'files-after.sha'), filesAfter);
	const filesSame = filesBefore === filesAfter;
	console.log(`  파일 대조 ${filesSame ? 'OK' : '실패'} — ${sha(filesAfter).slice(0, 16)}`);

	// ── 5. DB 재생성 ─────────────────────────────────────────────
	// app 의 행을 먼저 떠 둔다. 구조는 다시 만들되 사람이 넣은 것은 되넣는다
	const appData = sh('docker', [
		'compose', 'exec', '-T', 'postgres',
		'pg_dump', '-U', 'postgres', '-d', 'limbus',
		'--data-only', '-n', 'app', '--no-owner',
	]);
	const appDataPath = join(WORK, 'app-data.sql');
	writeFileSync(appDataPath, appData);
	console.log(`  app 행 보존 — ${(appData.length / 1024).toFixed(1)} KB → ${appDataPath}`);

	console.log('  DB 재생성');
	sh('npm', ['run', 'db:ddl', '--', '-c',
		DUMP_SCHEMAS.map((s) => `DROP SCHEMA IF EXISTS ${s} CASCADE`).join('; ')]);
	execFileSync('sh', ['-c', 'npm run db:ddl < prisma/v2/schema.sql'], { cwd: ROOT, stdio: 'ignore' });

	if (RESTORE_APP_DATA) {
		// **v2:canonical 앞이어야 한다** — 적재기가 app.field_override 와
		// 저작 표 둘을 읽어 굽는다(ADR-08)
		console.log('  app 행 복원');
		execFileSync('sh', ['-c', `npm run db:ddl < ${JSON.stringify(appDataPath)}`],
			{ cwd: ROOT, stdio: 'ignore' });
	}

	sh('npm', ['run', 'v2:load']);
	sh('npm', ['run', 'v2:canonical']);

	// ── 6. 덤프 대조 ─────────────────────────────────────────────
	const dumpAfter = dumpDatabase();
	writeFileSync(join(WORK, 'dump-after.sql'), dumpAfter);
	const dumpSame = dumpBefore === dumpAfter;
	console.log(`  덤프 대조 ${dumpSame ? 'OK' : '실패'} — ${sha(dumpAfter).slice(0, 16)}`);

	console.log('');
	if (filesSame && dumpSame) {
		console.log('재현 성공 — 지우고 다시 만들어도 바이트 단위로 같다');
		return;
	}
	console.error('재현 실패');
	if (!filesSame) console.error('  수집기가 다른 바이트를 냈다 — 상류가 바뀌었을 수 있다');
	if (!dumpSame) console.error('  파이프라인이 다른 결과를 냈다 — 변환기가 비결정적이다');
	console.error(`  산출물: ${WORK}`);
	process.exitCode = 1;
}

await main();
