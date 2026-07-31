/**
 * raw 층 적재기.
 *
 * 스펙 1절  재적재는 raw · canonical 에만 닿는다. app 은 건드리지 않는다
 * 스펙 2.4  스냅샷은 덮어쓰지 않고 쌓는다 — 같은 id 로 다시 넣으면 그 스냅샷만 지우고
 *           다시 넣는다. 다른 스냅샷은 남는다
 *
 * DDL 은 이 스크립트가 적용하지 않는다. `prisma/v2/schema.sql` 을 psql 로 직접 넣는다.
 *
 * 실행: npm run v2:load
 */
import { PrismaClient, Prisma } from './generated/client.js';
import { scanAll } from './scan.js';
import { parseSnapshot, readManifest } from './snapshot.js';

/** 한 번에 보내는 행 수. 43,270행을 한 문장에 넣으면 파라미터 한도를 넘는다. */
const CHUNK = 1_000;

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		const manifest = readManifest();

		// 우리 스냅샷 일련은 기존 최대값 + 1 이다. 같은 id 를 다시 넣는 경우 그 값을 잇는다.
		const previous = await prisma.snapshot.findFirst({ orderBy: { version: 'desc' } });
		const meta = parseSnapshot(manifest, (previous?.version ?? 0) + 1);
		const existing = await prisma.snapshot.findUnique({ where: { id: meta.snapshot.id } });
		if (existing !== null) {
			console.log(`스냅샷 ${meta.snapshot.id} 이(가) 이미 있다. 지우고 다시 넣는다.`);
			// raw_object · snapshot_source 는 onDelete: Cascade 로 함께 지워진다.
			await prisma.snapshot.delete({ where: { id: meta.snapshot.id } });
			meta.snapshot.version = existing.version;
		}

		const scan = scanAll();
		console.log(
			`스캔 완료 — 파일 ${scan.fileCount.toLocaleString()} · 개체 ${scan.rows.length.toLocaleString()}`,
		);
		console.log(
			`  모양  dataList ${scan.shapeCounts.dataList} · 단일 ${scan.shapeCounts.single} ` +
				`· map ${scan.shapeCounts.map} · list ${scan.shapeCounts.list}`,
		);

		await prisma.snapshot.create({ data: meta.snapshot });
		await prisma.snapshotSource.createMany({ data: meta.sources });
		console.log(
			`스냅샷 ${meta.snapshot.id} (version ${meta.snapshot.version}) · 출처 ${meta.sources.length}`,
		);

		const snapshotId = meta.snapshot.id;
		let inserted = 0;
		for (let i = 0; i < scan.rows.length; i += CHUNK) {
			const chunk = scan.rows.slice(i, i + CHUNK).map((row) => ({
				snapshotId,
				source: row.source,
				srcPath: row.srcPath,
				id: row.id,
				entity: row.entity,
				// 실측 payload 는 객체 43,096 · 문자열 174 · null 0 이다.
				// null 이 없으므로 Prisma.JsonNull 을 쓸 일이 없다.
				payload: row.payload as Prisma.InputJsonValue,
			}));
			const r = await prisma.rawObject.createMany({ data: chunk });
			inserted += r.count;
		}
		console.log(`raw_object 적재 ${inserted.toLocaleString()}행`);

		if (inserted !== scan.rows.length) {
			throw new Error(`적재 수 불일치 — 스캔 ${scan.rows.length} · 적재 ${inserted}`);
		}
	} finally {
		await prisma.$disconnect();
	}
}

await main();
