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
const DUMP_SCHEMAS = ['raw', 'canonical', 'app'];

function sh(cmd: string, args: string[]): string {
	return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

/** `pg_dump` 산출물. 세션 토큰 줄은 매번 달라지므로 뺀다. */
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
		console.log('    npm run db:ddl -- -c "DROP SCHEMA … CASCADE"');
		console.log('    npm run db:ddl < prisma/v2/schema.sql');
		console.log('    npm run v2:load && npm run v2:canonical');
		console.log('');
		console.log('  **app 스키마도 지워진다.** 수동 보정이 있으면 먼저 백업한다.');
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
	console.log('  DB 재생성');
	sh('npm', ['run', 'db:ddl', '--', '-c',
		DUMP_SCHEMAS.map((s) => `DROP SCHEMA IF EXISTS ${s} CASCADE`).join('; ')]);
	execFileSync('sh', ['-c', 'npm run db:ddl < prisma/v2/schema.sql'], { cwd: ROOT, stdio: 'ignore' });
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
