/**
 * 수집기 — 원본 스냅샷을 원격 저장소에서 다시 내려받는다.
 *
 * `data/` 가 비어 있는 상태에서 이것만 돌리면 변환기가 읽을 원본이 그대로 복원된다.
 * 무엇을 어디서 가져올지는 코드에 적지 않고 **`data/manifest.json` 에서 읽는다.**
 * 매니페스트가 파일마다 출처·원본 경로·체크섬을 갖고 있으므로 그것이 곧 레시피다.
 *
 * ADR-02 원칙 1  받지 못한 파일은 조용히 넘기지 않는다. 하나라도 있으면 실패다
 * ADR-02 원칙 2  대상 디렉토리를 지우고 전체를 다시 만든다
 * ADR-02 원칙 3  커밋을 고정해 받으므로 몇 번을 돌려도 같은 바이트가 나온다
 * ADR-04         정본과 보강 출처의 목록도 매니페스트가 정한다
 *
 * 실행: npm run fetch
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DATA, isText, toLf } from './io.js';

interface ManifestSource {
	id: string;
	repo: string;
	branch: string | null;
	commit: string;
	status: string;
}

interface ManifestFile {
	/** `data/` 기준 상대 경로. 우리 트리에서의 자리다. */
	path: string;
	/** 출처 id. `sources[].id` 와 대응한다. */
	source: string;
	/** 원격 저장소 안에서의 경로. 우리 경로는 평탄화되어 있어 이것이 없으면 복원되지 않는다. */
	sourcePath: string;
	bytes: number;
	/** 수집 당시 로컬 파일의 체크섬. 아래 주석 참조 — 이것으로 대조하면 안 된다. */
	sha256: string;
	/**
	 * 상류 원본 바이트의 체크섬.
	 *
	 * **`sha256` 을 쓰면 안 되는 이유.** 최초 수집이 `core.autocrlf=true` 인 Windows에서
	 * 이루어져 로컬 파일의 줄 끝이 CRLF로 바뀌었고, `sha256` 은 그 변환된 바이트를 담고 있다.
	 * 즉 그 값은 상류의 내용이 아니라 **수집한 기계의 산물**이라 다른 환경에서 재현되지 않는다.
	 * 상류 원본과 대조하려면 줄 끝을 LF로 되돌린 값이 필요하고, 그것이 이 필드다.
	 */
	sha256Lf?: string;
}

interface Manifest {
	sources: ManifestSource[];
	files: ManifestFile[];
}

/** 동시 요청 수. 올려도 크게 빨라지지 않고 상대 서버에 부담만 준다. */
const CONCURRENCY = 8;
/** 일시적 실패에 대한 재시도 횟수. 429·5xx 에만 적용한다. */
const RETRIES = 4;

/**
 * 기본 수집 범위.
 *
 * `assets/` 4,737개는 이미지이며 변환기가 읽지 않는다. 226 MB를 받아 쓰지 않는 셈이라
 * 기본에서 뺀다. `--assets` 로 켤 수 있고, 뺐다는 사실은 아래에서 반드시 출력한다.
 */
const DEFAULT_SCOPES = ['entities/', 'meta/'] as const;

function sha256(buf: Buffer): string {
	return createHash('sha256').update(buf).digest('hex');
}

function rawUrl(source: ManifestSource, sourcePath: string): string {
	const repo = source.repo.replace(/^github\.com\//, '');
	const encoded = sourcePath.split('/').map(encodeURIComponent).join('/');
	return `https://raw.githubusercontent.com/${repo}/${source.commit}/${encoded}`;
}

/** 받은 파일 하나의 결과. 실패 사유를 문자열로 남겨 리포트에서 그대로 쓴다. */
interface Outcome {
	file: ManifestFile;
	error?: string;
}

async function download(
	source: ManifestSource,
	file: ManifestFile,
	outRoot: string,
): Promise<Outcome> {
	const url = rawUrl(source, file.sourcePath);
	let lastError = '';
	for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
		let response: Response;
		try {
			response = await fetch(url);
		} catch (cause) {
			lastError = `네트워크 오류: ${(cause as Error).message}`;
			await sleep(attempt * 500);
			continue;
		}
		if (response.status === 429 || response.status >= 500) {
			lastError = `HTTP ${response.status}`;
			await sleep(attempt * 1000);
			continue;
		}
		if (!response.ok) return { file, error: `HTTP ${response.status} — ${url}` };

		const body = Buffer.from(await response.arrayBuffer());
		// 기대값이 없으면 검증할 수 없다. 통과시키지 않고 실패로 본다.
		const expected = file.sha256Lf;
		if (expected === undefined) {
			return { file, error: '매니페스트에 상류 체크섬(sha256Lf)이 없다' };
		}
		// **줄 끝을 정규화한 내용끼리 비교한다.** 상류 저장소마다 규약이 달라
		// 같은 내용이 LF로도 CRLF로도 들어 있다(실측: mj 17개는 CRLF, 나머지는 LF).
		// 줄 끝은 JSON 의 내용이 아니므로 그것 때문에 검증이 갈리면 안 된다.
		const canonical = isText(body) ? toLf(body) : body;
		const actual = sha256(canonical);
		if (actual !== expected) {
			return {
				file,
				error: `체크섬 불일치 — 기대 ${expected.slice(0, 12)} / 받음 ${actual.slice(0, 12)} (${body.length} bytes)`,
			};
		}
		const target = join(outRoot, file.path);
		mkdirSync(dirname(target), { recursive: true });
		// 정규화한 바이트를 쓴다. 상류 규약이 무엇이든 로컬 트리는 늘 LF 로 같아지며,
		// 그래야 다시 받아도 같은 결과가 나온다(ADR-02 원칙 3).
		writeFileSync(target, canonical);
		return { file };
	}
	return { file, error: `${RETRIES}회 재시도 실패 — ${lastError}` };
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const withAssets = args.includes('--assets');
	const outRoot = readOption(args, '--out') ?? DATA;

	const manifestPath = join(DATA, 'manifest.json');
	if (!existsSync(manifestPath)) {
		console.error(`매니페스트가 없다: ${manifestPath}`);
		console.error('이 파일은 git 이 추적하므로 저장소를 클론하면 함께 온다.');
		process.exitCode = 1;
		return;
	}
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
	const sources = new Map(manifest.sources.map((s) => [s.id, s]));

	const scopes = withAssets ? [...DEFAULT_SCOPES, 'assets/'] : [...DEFAULT_SCOPES];
	const wanted = manifest.files.filter((f) => scopes.some((s) => f.path.startsWith(s)));
	const skipped = manifest.files.length - wanted.length;

	// 원격에서 받을 수 없는 출처가 섞여 있으면 미리 걸러 내고 반드시 알린다.
	const local = wanted.filter((f) => {
		const s = sources.get(f.source);
		return s === undefined || !s.repo.startsWith('github.com/');
	});
	const fetchable = wanted.filter((f) => !local.includes(f));

	const repos = new Map<string, ManifestSource[]>();
	for (const id of new Set(fetchable.map((f) => f.source))) {
		const s = sources.get(id);
		if (s === undefined) continue;
		const list = repos.get(s.repo) ?? [];
		list.push(s);
		repos.set(s.repo, list);
	}

	console.log(`매니페스트 ${manifestPath}`);
	console.log(`받을 파일 ${fetchable.length}개 · 원격 저장소 ${repos.size}곳`);
	for (const [repo, list] of repos) {
		const detail = list
			.map((s) => `${s.id}@${s.commit.slice(0, 8)}${s.branch ? ` (${s.branch})` : ''}`)
			.join(', ');
		console.log(`  ${repo}  ${detail}`);
	}
	if (skipped > 0) {
		console.log(`제외 ${skipped}개 — 범위 밖 (${withAssets ? '' : 'assets/ 이미지 포함. '}--assets 로 포함)`);
	}
	if (local.length > 0) {
		console.log(`제외 ${local.length}개 — 원격 출처가 아니라 내려받을 수 없다`);
		for (const f of local.slice(0, 5)) console.log(`    ${f.path} (${f.source})`);
	}

	// 전체를 다시 만든다(ADR-02 원칙 2). 남은 파일이 섞이면 결과가 실행 이력에 의존한다.
	for (const scope of scopes) {
		const dir = join(outRoot, scope);
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	}

	const queue = fetchable.slice();
	const failures: Outcome[] = [];
	let done = 0;
	const total = queue.length;

	const worker = async (): Promise<void> => {
		for (;;) {
			const file = queue.shift();
			if (file === undefined) return;
			const source = sources.get(file.source);
			if (source === undefined) {
				failures.push({ file, error: `매니페스트에 출처 정의가 없다: ${file.source}` });
				continue;
			}
			const outcome = await download(source, file, outRoot);
			if (outcome.error !== undefined) failures.push(outcome);
			done += 1;
			if (done % 200 === 0 || done === total) {
				process.stdout.write(`\r  받는 중 ${done}/${total}`);
			}
		}
	};
	const started = Date.now();
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));
	process.stdout.write('\n');

	const bySource = new Map<string, number>();
	for (const f of fetchable) bySource.set(f.source, (bySource.get(f.source) ?? 0) + 1);
	console.log('\n출처별 결과');
	for (const [id, n] of [...bySource].sort()) {
		const bad = failures.filter((o) => o.file.source === id).length;
		console.log(`  ${id.padEnd(16)} ${String(n - bad).padStart(5)} / ${n}${bad ? `  실패 ${bad}` : ''}`);
	}
	console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}초`);

	if (failures.length > 0) {
		console.error(`\n받지 못한 파일 ${failures.length}개`);
		for (const o of failures.slice(0, 30)) console.error(`  ${o.file.path}\n    ${o.error}`);
		if (failures.length > 30) console.error(`  … 외 ${failures.length - 30}개`);
		process.exitCode = 1;
		return;
	}

	console.log(`수집 완료 — ${fetchable.length}개 전부 체크섬 일치 (${outRoot})`);
}

function readOption(args: string[], name: string): string | undefined {
	const hit = args.find((a) => a.startsWith(`${name}=`));
	return hit?.slice(name.length + 1);
}

await main();
