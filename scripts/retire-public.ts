/**
 * `public` 스키마를 물러나게 한다 — **지우지 않는다.**
 *
 * 읽는 코드가 0 이 된 뒤에 돈다. 덤프를 저장소 밖에 남기고 이름만 바꾸므로
 * 되돌리기가 `ALTER SCHEMA` 한 줄이다(설계 6절).
 *
 * `DROP SCHEMA` 는 다음 PR 이다. 화면이 아직 미완성이라 되돌릴 일이 생길 수 있다.
 *
 * 실행:
 *   npm run public:retire     덤프 + 이름 바꾸기
 *   npm run public:restore    되돌리기
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const RETIRED = 'public_retired';

/**
 * 덤프를 어디에 두나 — **저장소의 형제 디렉터리**다.
 *
 * `process.cwd()` 로 세면 안 된다. 이 명령은 워크트리에서 도는 일이 잦고
 * (`.claude/worktrees/<이름>/`) 거기서 위로 몇 칸인지가 본 저장소와 다르다.
 * 계획서의 `'..','..','..'` 는 워크트리에서 저장소 **안**을 가리켰다.
 *
 * `--git-common-dir` 은 워크트리에서도 본 저장소의 `.git` 을 낸다. 그 부모가
 * 저장소 루트이고, 덤프는 그 형제로 간다 — 브랜치·워크트리 정리에 안 휩쓸린다.
 */
function backupDir(): string {
	const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
		encoding: 'utf8',
	}).trim();
	const repoRoot = dirname(common);
	return resolve(repoRoot, '..', 'limbus-db-backups');
}

function psql(sql: string): string {
	return execFileSync(
		'docker',
		['exec', 'limbus-postgres', 'psql', '-U', 'postgres', '-d', 'limbus', '-tAc', sql],
		{ encoding: 'utf8' },
	).trim();
}

function schemaExists(name: string): boolean {
	return psql(`SELECT count(*) FROM pg_namespace WHERE nspname = '${name}'`) === '1';
}

/**
 * 확장이 `public` 에 살면 이름을 못 바꾼다 — 확장이 제 스키마를 굳혀 두기 때문이다.
 * 여기서 멈추고 무엇이 걸렸는지 낸다. 억지로 밀지 않는다.
 */
function extensionsInPublic(): string[] {
	const out = psql(
		"SELECT extname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE n.nspname = 'public'",
	);
	return out === '' ? [] : out.split('\n');
}

function retire(): void {
	if (!schemaExists('public')) {
		console.error('public 스키마가 없다. 이미 물러났거나 이름이 다르다.');
		process.exitCode = 1;
		return;
	}

	const blockers = extensionsInPublic();
	if (blockers.length > 0) {
		console.error(`확장이 public 에 산다 — ${blockers.join(', ')}. 이름을 못 바꾼다.`);
		console.error('확장을 먼저 옮겨야 한다. 여기서 멈춘다.');
		process.exitCode = 1;
		return;
	}

	const tables = psql(
		"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
	);
	console.log(`public — ${tables}테이블`);

	// 1. 덤프. 저장소 밖에 둔다 — 브랜치·워크트리 정리에 안 휩쓸린다
	const dir = backupDir();
	mkdirSync(dir, { recursive: true });
	const dump = execFileSync(
		'docker',
		['exec', 'limbus-postgres', 'pg_dump', '-U', 'postgres', '-d', 'limbus',
			'--schema=public', '--no-owner', '--no-privileges'],
		{ encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
	);
	const path = join(dir, 'public-retired.sql');
	writeFileSync(path, dump);
	console.log(`덤프 ${(dump.length / 1024 / 1024).toFixed(1)} MB → ${path}`);

	// 2. 이름 바꾸기. 지우지 않는다
	psql(`ALTER SCHEMA "public" RENAME TO "${RETIRED}"`);
	console.log(`ALTER SCHEMA "public" RENAME TO "${RETIRED}"`);
	console.log('');
	console.log('되돌리려면 npm run public:restore.');
	console.log('DROP 은 안 했다 — 다음 PR 이다.');
}

function restore(): void {
	if (!schemaExists(RETIRED)) {
		console.error(`${RETIRED} 가 없다. 물러난 적이 없거나 이미 되돌렸다.`);
		process.exitCode = 1;
		return;
	}
	if (schemaExists('public')) {
		console.error('public 이 이미 있다. 덮어쓰지 않는다 — 어느 쪽이 진짜인지 사람이 정한다.');
		process.exitCode = 1;
		return;
	}
	psql(`ALTER SCHEMA "${RETIRED}" RENAME TO "public"`);
	console.log(`ALTER SCHEMA "${RETIRED}" RENAME TO "public" — 되돌렸다.`);
}

const mode = process.argv[2];
if (mode === 'restore') restore();
else if (mode === 'retire') retire();
else {
	console.error('쓰임: retire-public.ts <retire|restore>');
	process.exitCode = 1;
}
