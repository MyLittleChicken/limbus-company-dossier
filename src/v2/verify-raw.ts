/**
 * raw 층 검증.
 *
 * 적재가 끝난 DB 를 실측 기준값과 대조한다. 스캔 단계 테스트(scan.test.ts)가
 * 파일에서 메모리까지를 보장하고, 이 스크립트가 메모리에서 DB 까지를 보장한다.
 *
 * 실행: npm run v2:verify
 */
import { PrismaClient } from './generated/client.js';

const EXPECTED_ROWS = 43_270;
const EXPECTED_SOURCES: Record<string, number> = {
	'loc-ja': 11_218,
	'loc-en': 11_013,
	'loc-ko': 10_919,
	'limbus-data-mj': 4_032,
	'limbus-assets': 3_830,
	'shared-library': 2_258,
};

interface Check {
	name: string;
	ok: boolean;
	detail: string;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	const checks: Check[] = [];
	try {
		const snapshot = await prisma.snapshot.findFirst({ orderBy: { version: 'desc' } });
		if (snapshot === null) throw new Error('스냅샷이 없다. npm run v2:load 를 먼저 돌린다.');
		console.log(`검증 대상 스냅샷 ${snapshot.id} (version ${snapshot.version})`);

		const total = await prisma.rawObject.count({ where: { snapshotId: snapshot.id } });
		checks.push({
			name: '개체 행 수',
			ok: total === EXPECTED_ROWS,
			detail: `${total.toLocaleString()} / ${EXPECTED_ROWS.toLocaleString()}`,
		});

		const perSource = await prisma.rawObject.groupBy({
			by: ['source'],
			where: { snapshotId: snapshot.id },
			_count: { _all: true },
		});
		for (const [source, expected] of Object.entries(EXPECTED_SOURCES)) {
			const got = perSource.find((r) => r.source === source)?._count._all ?? 0;
			checks.push({
				name: `출처 ${source}`,
				ok: got === expected,
				detail: `${got.toLocaleString()} / ${expected.toLocaleString()}`,
			});
		}

		const files = await prisma.rawObject.findMany({
			where: { snapshotId: snapshot.id },
			distinct: ['srcPath'],
			select: { srcPath: true },
		});
		checks.push({
			name: '고유 srcPath',
			ok: files.length === 1_664,
			detail: `${files.length.toLocaleString()} / 1,664`,
		});

		// 마스터북이 게임으로 판정한 기프트 9427 이 두 출처에 다르게 들어 있어야 한다.
		const mj = await prisma.rawObject.findFirst({
			where: { snapshotId: snapshot.id, srcPath: 'gifts/limbus-data-mj/gifts.json', id: '9427' },
		});
		const assets = await prisma.rawObject.findFirst({
			where: { snapshotId: snapshot.id, srcPath: 'gifts/limbus-assets/gifts.json', id: '9427' },
		});
		const mjHard = (mj?.payload as Record<string, unknown> | undefined)?.['hardOnly'];
		const assetsHard = (assets?.payload as Record<string, unknown> | undefined)?.['hardonly'];
		checks.push({
			name: '기프트 9427 이 두 출처에 모순인 채로 있다',
			ok: mjHard === true && assetsHard === undefined,
			detail: `mj.hardOnly=${String(mjHard)} · assets.hardonly=${String(assetsHard)}`,
		});

		// 출처 대조가 SQL 로 되는지 — raw 층의 존재 이유다.
		const diff = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n
			FROM raw.raw_object a
			JOIN raw.raw_object b USING (snapshot_id, entity, id)
			WHERE a.snapshot_id = ${snapshot.id}
			  AND a.src_path = 'gifts/limbus-data-mj/gifts.json'
			  AND b.src_path = 'gifts/limbus-assets/gifts.json'
			  AND coalesce((a.payload ->> 'hardOnly')::boolean, false)
			   IS DISTINCT FROM coalesce((b.payload ->> 'hardonly')::boolean, false)
		`;
		const mismatch = Number(diff[0]?.n ?? 0n);
		checks.push({
			name: 'hardOnly 출처 간 불일치 (마스터북 실측 65건)',
			ok: mismatch === 65,
			detail: `${mismatch} / 65`,
		});
	} finally {
		await prisma.$disconnect();
	}

	console.log('');
	for (const c of checks) {
		console.log(`${c.ok ? '  OK  ' : '  실패'} ${c.name.padEnd(44)} ${c.detail}`);
	}
	const failed = checks.filter((c) => !c.ok);
	console.log('');
	if (failed.length === 0) {
		console.log(`검사 ${checks.length}건 전부 통과`);
		return;
	}
	console.error(`검사 ${failed.length}건 실패`);
	process.exitCode = 1;
}

await main();
