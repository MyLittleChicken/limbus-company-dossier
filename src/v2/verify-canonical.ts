/**
 * canonical 층 검증 — 팩 계열.
 *
 * 변환기 테스트(packs.test.ts)가 판정 규칙을 보장하고, 이 스크립트가
 * 원본 전량에 대한 결과를 실측 기준값과 대조한다.
 *
 * 실행: npm run v2:verify:canonical
 */
import { PrismaClient } from './generated/client.js';

interface Check {
	name: string;
	ok: boolean;
	detail: string;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	const checks: Check[] = [];
	const eq = (name: string, got: number, want: number): void => {
		checks.push({
			name,
			ok: got === want,
			detail: `${got.toLocaleString()} / ${want.toLocaleString()}`,
		});
	};

	try {
		eq('pack', await prisma.pack.count(), 117);
		eq('pack_text', await prisma.packText.count(), 351);
		eq('pack_tag', await prisma.packTag.count(), 184);
		eq('pack_category_path', await prisma.packCategoryPath.count(), 202);
		eq('floor_pack', await prisma.floorPack.count(), 288);

		eq(
			'tag 유일 종수',
			(await prisma.packTag.findMany({ distinct: ['tag'], select: { tag: true } })).length,
			47,
		);

		const byCategory = await prisma.pack.groupBy({ by: ['category'], _count: { _all: true } });
		const cat = Object.fromEntries(byCategory.map((r) => [String(r.category), r._count._all]));
		const wantCat: Record<string, number> = {
			canto: 27,
			sin: 21,
			extreme: 21,
			event: 18,
			keyword: 14,
			railway: 6,
			attack_type: 6,
			walpurgis: 4,
		};
		const catOk = Object.entries(wantCat).every(([k, v]) => cat[k] === v);
		checks.push({
			name: '분류별 팩 수',
			ok: catOk && Object.keys(cat).length === 8,
			detail: JSON.stringify(cat),
		});

		eq('chapter 보유', await prisma.pack.count({ where: { chapter: { not: null } } }), 27);
		eq('variant 보유', await prisma.pack.count({ where: { variant: { not: null } } }), 27);
		eq('bokgak true', await prisma.pack.count({ where: { bokgak: true } }), 6);
		eq(
			'overlaySprite 보유',
			await prisma.pack.count({ where: { overlaySprite: { not: null } } }),
			41,
		);
		eq('textColor 보유', await prisma.pack.count({ where: { textColor: { not: null } } }), 56);
		eq('unlockCode 보유', await prisma.pack.count({ where: { unlockCode: { not: null } } }), 115);

		eq('결손 textColor', await prisma.fieldGap.count({ where: { field: 'textColor' } }), 61);
		eq('결손 unlockCode', await prisma.fieldGap.count({ where: { field: 'unlockCode' } }), 2);
		eq('결손 합계', await prisma.fieldGap.count(), 63);

		// 마스터북이 실측한 것 — 1309 는 loc 후행 공백을 쓰지 않는다
		const p1309 = await prisma.packText.findUnique({
			where: { packId_locale: { packId: '1309', locale: 'ko' } },
		});
		checks.push({
			name: '1309 한국어에 후행 공백이 없다',
			ok: p1309 !== null && p1309.name === p1309.name.trimEnd(),
			detail: JSON.stringify(p1309?.name),
		});

		// sprite 는 두 출처가 전건 일치해야 한다
		const disagreed = await prisma.fieldSource.count({
			where: { field: 'sprite', rule: 'disagreed' },
		});
		checks.push({
			name: 'sprite 출처 간 불일치 (0이어야 한다)',
			ok: disagreed === 0,
			detail: `${disagreed} / 0`,
		});

		// 6층 이상 구간과 mj 플래그가 정확히 대응한다
		const ranges = await prisma.$queryRaw<
			Array<{ floor_range: string; n: bigint; sup: bigint; ext: bigint }>
		>`
			SELECT f.floor_range,
			       count(*)::bigint                                AS n,
			       count(*) FILTER (WHERE p.superposition)::bigint AS sup,
			       count(*) FILTER (WHERE p.extreme)::bigint       AS ext
			FROM canonical.floor_pack f
			JOIN canonical.pack p ON p.id = f.pack_id
			WHERE f.floor_range IN ('6-10', '11-15')
			GROUP BY f.floor_range
		`;
		const r610 = ranges.find((r) => r.floor_range === '6-10');
		const r1115 = ranges.find((r) => r.floor_range === '11-15');
		checks.push({
			name: '6-10 구간은 전부 superposition',
			ok: Number(r610?.n ?? 0n) === 46 && Number(r610?.sup ?? 0n) === 46,
			detail: `${Number(r610?.sup ?? 0n)} / ${Number(r610?.n ?? 0n)} (46 기대)`,
		});
		checks.push({
			name: '11-15 구간은 전부 extreme',
			ok: Number(r1115?.n ?? 0n) === 24 && Number(r1115?.ext ?? 0n) === 24,
			detail: `${Number(r1115?.ext ?? 0n)} / ${Number(r1115?.n ?? 0n)} (24 기대)`,
		});

		// ── 마스터북 완전 일치 쌍 재현 — 1–5층에서 mj 와 assets 가 218/218 ──
		// canonical 이 아니라 raw 를 직접 맞댄다. 이 층의 존재 이유다(스펙 2.1).
		const floors = await prisma.$queryRaw<
			Array<{ mj: bigint; assets: bigint; only_mj: bigint; only_assets: bigint }>
		>`
			WITH mj AS (
			  SELECT id AS pack_id, 'normal' AS difficulty,
			         jsonb_array_elements_text(payload->'normalFloors') AS floor
			  FROM raw.raw_object
			  WHERE src_path = 'packs/limbus-data-mj/packs.json' AND payload ? 'normalFloors'
			  UNION ALL
			  SELECT id, 'hard', jsonb_array_elements_text(payload->'hardFloors')
			  FROM raw.raw_object
			  WHERE src_path = 'packs/limbus-data-mj/packs.json' AND payload ? 'hardFloors'
			),
			assets AS (
			  SELECT o.id AS difficulty, r.key AS floor,
			         jsonb_array_elements_text(r.value) AS pack_id
			  FROM raw.raw_object o
			  CROSS JOIN LATERAL jsonb_each(o.payload) r
			  WHERE o.src_path = 'mirror-dungeon/limbus-assets/md_floor_packs.json'
			),
			a15 AS (SELECT pack_id, difficulty, floor FROM assets WHERE floor IN ('1','2','3','4','5'))
			SELECT (SELECT count(*) FROM mj)::bigint  AS mj,
			       (SELECT count(*) FROM a15)::bigint AS assets,
			       (SELECT count(*) FROM (SELECT * FROM mj EXCEPT SELECT * FROM a15) x)::bigint AS only_mj,
			       (SELECT count(*) FROM (SELECT * FROM a15 EXCEPT SELECT * FROM mj) y)::bigint AS only_assets
		`;
		const f = floors[0];
		checks.push({
			name: '1–5층 mj ↔ assets 완전 일치',
			ok:
				Number(f?.mj ?? 0n) === 218 &&
				Number(f?.assets ?? 0n) === 218 &&
				Number(f?.only_mj ?? 1n) === 0 &&
				Number(f?.only_assets ?? 1n) === 0,
			detail: `mj ${Number(f?.mj ?? 0n)} · assets ${Number(f?.assets ?? 0n)} · 차집합 ${Number(f?.only_mj ?? 0n)}/${Number(f?.only_assets ?? 0n)}`,
		});

		// 모든 팩이 최소 한 로케일 이름을 갖는다
		const noName = await prisma.pack.count({ where: { texts: { none: {} } } });
		checks.push({
			name: '이름 없는 팩 (0이어야 한다)',
			ok: noName === 0,
			detail: `${noName} / 0`,
		});
	} finally {
		await prisma.$disconnect();
	}

	console.log('');
	for (const c of checks) console.log(`${c.ok ? '  OK  ' : '  실패'} ${c.name.padEnd(36)} ${c.detail}`);
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
