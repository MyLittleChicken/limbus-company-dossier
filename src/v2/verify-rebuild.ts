/**
 * 등식 검사 — `canonical = f(raw@스냅샷, app.저작, 코드@커밋)` 이 참인가.
 *
 * **`v2:reproduce` 와 다르다.** 그건 수집기부터 전 과정을 다시 밟는 파괴적
 * 시험이다. 이건 `canonical` 만 다시 구워 대조하고 아무것도 안 지운다.
 *
 * **`v2:diff` 와도 다르다.** diff 는 「승격하면 무엇이 바뀌나」(미래)를 보고,
 * 이건 「지금 것을 다시 만들 수 있나」(과거)를 본다. 그리고 diff 는 id 집합만
 * 보지만 이건 **전 컬럼을 해시로 전수 대조**한다 — 재현 검사가 잡아야 할 것이
 * 「id 도 행수도 그대로인 값 변경」이기 때문이다(ADR-07 3절).
 *
 * **검사 203건과도 다르다.** 그건 우리가 정한 규칙의 표본이고, 이건 규칙을
 * 모르는 전수 대조다. 둘은 서로 다른 것을 잡는다.
 *
 * 실행: npm run v2:verify:rebuild
 */
import { execFileSync } from 'node:child_process';
import { PrismaClient } from './generated/client.js';
import { readAuthored, authoredDigest } from './authored.js';
import { DIGEST_EXCLUDE, verdictOf } from './rebuild-verdict.js';
import { schemaExists, tableDigest, tableNames } from './schema-ops.js';

/**
 * 굽는 시점의 코드 판. `load-canonical.ts` 와 **같은 규칙이어야 한다** — 다르면
 * 깨끗한 트리에서 구운 판이 여기서 「코드가 바뀌었다」로 잡힌다.
 */
function codeCommit(): string {
	const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
	return dirty === '' ? head : `${head}-dirty`;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		console.log('등식 검사 — canonical = f(raw@스냅샷, app.저작, 코드@커밋)');
		console.log('');

		// ── 1. 판 표식 ────────────────────────────────────────────
		const n = await prisma.buildInfo.count();
		if (n !== 1) {
			console.error(`판정 불가 — build_info 가 ${n}행이다. 1행이어야 한다.`);
			console.error('  이 canonical 은 판 표식 이전에 구워진 판이거나 표식이 깨졌다.');
			console.error('  npm run v2:build && npm run v2:promote 로 표식을 심어라.');
			process.exitCode = 1;
			return;
		}
		const bi = await prisma.buildInfo.findFirstOrThrow();
		console.log(`  구운 판   스냅샷 ${bi.snapshotId} · 커밋 ${bi.codeCommit.slice(0, 12)}`);
		console.log(`            저작 ${bi.authoredDigest.slice(0, 12)} · ${bi.rowCount.toLocaleString()}행`);
		console.log(`            시각 ${bi.builtAt.toISOString()}`);

		// ── 2. 지금 입력의 지문 ────────────────────────────────────
		const nowAuthored = authoredDigest(await readAuthored(prisma));
		const nowCommit = codeCommit();
		const authoredChanged = nowAuthored !== bi.authoredDigest;
		const commitChanged = nowCommit !== bi.codeCommit;
		const inputChanged = authoredChanged || commitChanged;

		console.log('');
		console.log(`  저작      ${authoredChanged ? `바뀜 → ${nowAuthored.slice(0, 12)}` : '같다'}`);
		console.log(`  코드      ${commitChanged ? `바뀜 → ${nowCommit.slice(0, 12)}` : '같다'}`);

		// ── 3. 다시 굽는다 ────────────────────────────────────────
		if (await schemaExists(prisma, 'wip')) {
			console.error('');
			console.error('판정 불가 — wip 이 이미 있다. 앞선 v2:build 산물을 말없이 덮지 않는다.');
			console.error('  승격할 물건이면 npm run v2:diff 로 대조한 뒤 npm run v2:promote 를 써라.');
			console.error('  버릴 물건이면 DROP SCHEMA "wip" CASCADE 로 지우고 다시 돌려라.');
			process.exitCode = 1;
			return;
		}

		console.log('');
		console.log('  다시 굽는다 — npm run v2:build');
		console.log('');
		try {
			execFileSync('npm', ['run', 'v2:build'], { stdio: 'inherit' });
		} catch {
			// 스택 트레이스를 그대로 뱉으면 무엇이 잘못됐는지 안 보인다.
			// **가장 흔한 원인이 더러운 작업트리다** — 적재기가 -dirty 를 심고
			// 검사가 그걸 실패로 세므로 build 가 거기서 죽는다
			console.error('');
			console.error('판정 불가 — 다시 굽기가 실패했다. 위 출력이 이유다.');
			if (nowCommit.endsWith('-dirty')) {
				console.error('');
				console.error('  작업트리가 더럽다. 커밋하지 않은 코드로 구운 판은 출처가 거짓이라');
				console.error('  재현 검사의 근거가 못 된다 — 먼저 커밋하고 다시 돌려라.');
			}
			process.exitCode = 1;
			return;
		}

		// ── 4. 전수 대조 ──────────────────────────────────────────
		console.log('');
		console.log('  전수 대조 — 표마다 전 컬럼을 해시로 잰다');

		const [live, fresh] = await Promise.all([
			tableNames(prisma, 'canonical'),
			tableNames(prisma, 'wip'),
		]);
		const onlyLive = [...live].filter((t) => !fresh.has(t)).sort();
		const onlyFresh = [...fresh].filter((t) => !live.has(t)).sort();
		const both = [...live].filter((t) => fresh.has(t) && !DIGEST_EXCLUDE.has(t)).sort();

		const differing: string[] = [];
		for (const t of both) {
			const [a, b] = await Promise.all([
				tableDigest(prisma, 'canonical', t),
				tableDigest(prisma, 'wip', t),
			]);
			if (a !== b) differing.push(t);
		}

		const same = onlyLive.length === 0 && onlyFresh.length === 0 && differing.length === 0;
		console.log(`  표 ${both.length}개 대조 · 다른 표 ${differing.length}개`);
		if (onlyLive.length > 0) console.log(`  canonical 에만 있음: ${onlyLive.join(', ')}`);
		if (onlyFresh.length > 0) console.log(`  새 판에만 있음: ${onlyFresh.join(', ')}`);

		// ── 5. 판정 ───────────────────────────────────────────────
		console.log('');
		const verdict = verdictOf({ inputChanged, same });

		if (verdict === 'reproduced') {
			console.log('재현됨 — 입력이 같고 결과가 같다.');
			console.log('  지금 canonical 은 그 스냅샷·그 코드·그 저작으로 다시 만들 수 있다.');
			console.log('');
			console.log('  새로 구운 판은 wip 에 있다. 필요 없으면 DROP SCHEMA "wip" CASCADE 로 지운다.');
			return;
		}

		if (verdict === 'input-changed') {
			console.log('입력이 바뀌었다 — 결과가 다른 것이 정상이다.');
			if (authoredChanged) console.log('  app 저작 표가 달라졌다');
			if (commitChanged) console.log('  코드가 달라졌다');
			console.log('');
			if (same) {
				console.log('  다만 결과는 같다 — 바뀐 입력이 이 판에 영향을 안 준 것이다.');
			} else {
				for (const t of differing) console.log(`    ${t}`);
			}
			console.log('');
			console.log('  npm run v2:diff 로 자세히 보고 v2:promote 로 올린다.');
			return;
		}

		console.error('재현 실패 — 입력이 같은데 결과가 다르다.');
		console.error('  누가 canonical 을 직접 건드렸을 수 있다.');
		for (const t of differing) console.error(`    ${t}`);
		console.error('');
		console.error('  새로 구운 판이 wip 에 있다. npm run v2:diff 로 대조해라.');
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
