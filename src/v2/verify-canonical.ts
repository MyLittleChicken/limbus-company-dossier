/**
 * canonical 층 검증 — 팩 계열.
 *
 * 변환기 테스트(packs.test.ts)가 판정 규칙을 보장하고, 이 스크립트가
 * 원본 전량에 대한 결과를 실측 기준값과 대조한다.
 *
 * 실행: npm run v2:verify:canonical
 */
import { PrismaClient } from './generated/client.js';
import { liveRowCount } from './schema-ops.js';
import { readAuthored, unknownRefs, type KnownIds } from './authored.js';

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

		// ── 거울 던전 판본 (앱 전환) ────────────────────────────────
		// 층 표에서 유도한 값이다. 판본이 늘면 여기도 는다
		eq('mirror_dungeon', await prisma.mirrorDungeon.count(), 1);
		// loc-ko · en · ja 가 각각 MirrorDungeonName 을 낸다
		eq('mirror_dungeon_text', await prisma.mirrorDungeonText.count(), 3);

		const md = await prisma.mirrorDungeon.findFirst();
		checks.push({
			name: 'mirror_dungeon 이 실측과 같다 — MD7 · 15 · 5',
			ok: md !== null && md.version === 'MD7' && md.totalFloors === 15 && md.baseFloors === 5,
			detail: md === null
				? '없다'
				: `${md.version} · hard ${md.totalFloors} · normal ${md.baseFloors}`,
		});
		// 난이도 접미사가 붙은 이름(「… [NORMAL]」)이 새면 화면이 그걸 판본명으로 쓴다
		const mdKo = await prisma.mirrorDungeonText.findFirst({ where: { locale: 'ko' } });
		checks.push({
			name: 'mirror_dungeon_text 에 난이도 표기가 안 섞였다',
			ok: mdKo !== null && !mdKo.name.includes('['),
			detail: mdKo === null ? '없다' : mdKo.name,
		});

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
		// status.name.ja 258 · status.name.ko 245 · pack.textColor 61 · skill.levels 9
		// · passive.name 6 · gift.name.ko 6 · association.name.ja 2 · pack.unlockCode 2
// name 598 · text 478 · item 400 · textColor 61 · levels 9 · unlockCode 2 · battlePool 1
		// 수동 보정이 채운 만큼 줄어든다.
		// **기프트 hardOnly 보정은 세지 않는다** — 결손을 채우는 것이 아니라 값이 있는데
		// 틀린 것을 고치는 것이라 결손 수가 줄지 않는다(docs/audit/wiki/03-gift.md §2).
		//
		// 기준이 1,549 에서 966 으로 내려갔다. **거짓 결손 583건을 걷어낸 것**이다 —
		// 원본에 값이 있는데 「어느 출처에도 없다」고 적혀 있던 것들이다(docs/audit/00-summary.md 4절).
		//   status.name  ko 245 · ja 258   mirror-dungeon/loc-* 의 Bufs_Mirror*·BattleKeywords_Mirror* 를 안 읽었다
		//   grace.name   ko  10 · ja  10   MirrorDungeonUI_5.json 에 3언어가 다 있다
		//   adversity.name ko 30 · ja 30   BattleKeywords_Mirror{6,7} 에 있다
		// 셋 다 영문명 대조 관문을 통과한 것만 채웠다 — 규칙으로 키를 조합해 찾을 때의 안전장치다
		const gapTotal = await prisma.fieldGap.count();
		const overrideCount = await prisma.fieldOverride.count({
			where: { NOT: { entity: 'gift', field: 'hardOnly' } },
		});
		// 966 → 1,137 로 늘었지만 **결손을 새로 만든 게 아니라 몰랐던 것을 기록한 것**이다
		// (인카운터 재설계, 2026-08-03). 966 은 인카운터 값 검사를 넣기 전 숫자다.
		//   +7    Task 4·5 적·부위 분리 — enemy_part 고아 6건 + encounter_target.name
		//         결손이 1 → 2 로(원본 1,371건 전수를 담으며 진짜 빈 이름 1건이 더 드러났다)
		//         966 + 7 = 973 (task-5-report.md)
		//   +42   보스 후보를 모르는 42팩 (encounter.bossPool) — 위키에서 긁지 않기로 한
		//         42팩을 결손으로 명시했다(설계 6절)
		//   +122  encounter_target_part.resists — `resists` 키 자체가 없는 부위 122건.
		//         이전에는 축 루프가 조용히 continue 해 아무 기록도 안 남겼다. 「말없이
		//         버리지 않는다」규칙에 따라 이번에 처음 기록한다
		//   973 + 42 + 122 = 1,137
		//   +5    identity.axis — 축이 없는 인격 5건(10201·10205·10305·10903·11206).
		//         keyword·special_status 어느 경로로도 축을 못 얻는다(설계 13절).
		//         1,137 + 5 = 1,142
		//   +12   gift.min_count — 게이트를 트리거에 못 귄 12건. 11건은 1xxx·2xxx
		//         스토리 던전 기프트로 출처에 트리거가 아예 없고(126종 전부),
		//         1건은 9173 빛바랜 외투 「정신력 -45인 **적**이 3명 이상」이라
		//         편성이 아니라 적을 센다 — 올바른 배제다
		//   +3    gift.denominator — 9220·9270·9829 가 분모 어휘를 안 적었다.
		//         셋 다 중지 소속 게이트다. 추측해 채우지 않고 결손으로 남긴다
		//         1,142 + 15 = 1,157
		//   +1    identity_axis.special_status — keyword 어휘가 BULLET 을 못 담는다는
		//         설계 결손을 한 행으로 고정 기록한다(entity_id='*', identity-axis.ts).
		//         1,157 + 1 = 1,158
		//   +1    gift.supply — 9073 엔도르핀 키트. 조건이 스킬 층(「스킬 효과로 호흡
		//         위력을 획득할 때마다」)을 묻는데 기프트 조건에 그 층을 적을 칸이
		//         없다. 태그 층(축 제한·부여)만 옳게 만드는 이 PR 의 몫이 아니라
		//         결손으로 남긴다(Task 8, identity-axis.ts 끝).
		//         1,158 + 1 = 1,159
		//   +6    Task 9 — 폐기 표시와 함께, 「없다는 것조차 기록하지 않은 것」을 여섯
		//         자리 더 적는다.
		//           passive.effect(*)              패시브 효과-상태 구조화 표가 없다
		//           gift.association_grant(9280)    소속 자체를 바꾸는 효과를 못 담는다
		//           gift.association_grant(9841)    같은 종류
		//           passive.skill_kind_grant(1021504·1061404) 둘   스킬 분류를 바꾸는
		//           effect 를 못 담는다(2행)
		//           coin_token.skill_possession(*)  강화·추가·변신 형태 스킬은 「보유」
		//           판정에서 빠진다는 사실을 coin_token 이 구별 못 해 과대 계산이다
		//           (이번 조사에서 새로 앎, 실측 21건 중 일부의 근거)
		//         1,159 + 6 = 1,165
		//   +1    gift.gate_conjunction — 9282 날개 모양 양초. 발동 조건이 「기프트
		//         보유」 AND 「새벽 사무소 3인 이상」인데 `gate_kind` 가 행당 하나뿐이라
		//         `roster_count` 만 적었다. 게이트를 배열로 넓히는 것은 기프트 능력
		//         PR 의 몫이라 결손으로 남긴다(identity-axis.ts, 2026-08-10 전체 검토).
		//         1,165 + 1 = 1,166
		//   +0    identity_axis.affects_collision — PK(identityId·axisId·source·
		//         gateKind·gateRef)가 affects 를 안 봐서 조용히 접힐 수 있는 자리를
		//         감지하는 결손이다. 지금 데이터(축 부여·제한 저작 18행 전건 대조)엔
		//         충돌이 없어 0건 — 나지 않을 수 있는 결손이라고 실측 전에 이미 적어 뒀다.
		//   +5    게이트 판정(2026-08-11) — 456개 전량 검수가 찾았으나 이 회차가
		//         못 담는 것을 결손으로 남긴다. gift.*.clause_structure(1) ·
		//         gift.{9220,9270}.clause_gate(2) · gift.9052.priority_hint(1) ·
		//         gift.9043.or_condition(1) = 5 (gift-trigger-param.ts 끝)
		//         1,166 + 5 = 1,171
		checks.push({
			name: '결손 합계 (보정한 만큼 줄어든다)',
			ok: gapTotal + overrideCount === 1_171,
			detail: `결손 ${gapTotal.toLocaleString()} + 보정 ${overrideCount} = ${(gapTotal + overrideCount).toLocaleString()} / 1,171`,
		});

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

		// ══ 기프트 계열 ══════════════════════════════════════════════
		eq('keyword', await prisma.keyword.count(), 12);
		eq('keyword_text', await prisma.keywordText.count(), 36);
		// 필터 칩 순서. 12종 전부 원본 등장 순서를 갖고 「범용」(None)이 맨 뒤다
		eq('keyword order 보유', await prisma.keyword.count({ where: { order: { not: null } } }), 12);
		checks.push({
			name: 'keyword order 는 None 이 맨 뒤다',
			ok: (await prisma.keyword.findUnique({ where: { id: 'None' } }))?.order === 11,
			detail: String((await prisma.keyword.findUnique({ where: { id: 'None' } }))?.order),
		});
		eq('trigger', await prisma.trigger.count(), 150);
		eq('effect', await prisma.effect.count(), 55);

		eq('gift', await prisma.gift.count(), 582);
		eq('gift (mirror_dungeon)', await prisma.gift.count({ where: { domain: 'mirror_dungeon' } }), 456);
		eq('gift (story_dungeon)', await prisma.gift.count({ where: { domain: 'story_dungeon' } }), 126);
		eq('gift_stage', await prisma.giftStage.count(), 799);
		eq('gift_stage_text', await prisma.giftStageText.count(), 2_391);
		// 원본 effects 배열 총합이 1,123 이다. 초판 PK 가 9429 의 중복 1건을 삼켜 1,122 였다
		eq('gift_effect', await prisma.giftEffect.count(), 1_123);
		eq('gift_trigger', await prisma.giftTrigger.count(), 1_081);
		// mj 10,115 + 위키가 판정한 결손 1행 (1124 × 9241)
		eq('gift_pack', await prisma.giftPack.count(), 10_116);
		eq('gift_exclusive_pack', await prisma.giftExclusivePack.count(), 321);
		eq('gift_requirement', await prisma.giftRequirement.count(), 142);
		eq('fusion_recipe', await prisma.fusionRecipe.count(), 68);
		eq('fusion_slot', await prisma.fusionSlot.count(), 179);
		eq('fusion_slot_option', await prisma.fusionSlotOption.count(), 7);
		eq('gift_locked_desc', await prisma.giftLockedDesc.count(), 192);

		// hardOnly — 합집합 122 도 assets 단독 116 도 틀렸다. 위키 테마팩의 normal= 로
		// 9212·9249·9427·9428·9431 다섯이 false 로 내려가 117 이 정답이다(wiki/03-gift.md §2)
		eq('hardOnly true (위키 판정 117)', await prisma.gift.count({ where: { hardOnly: true } }), 117);
		const hardFixed = await prisma.gift.findMany({
			where: { id: { in: ['9212', '9249', '9427', '9428', '9431', '9841'] } },
			select: { id: true, hardOnly: true },
			orderBy: { id: 'asc' },
		});
		checks.push({
			name: '하드 전용 보정 5건 + 유지 1건 (9841)',
			ok:
				hardFixed.length === 6 &&
				hardFixed.filter((g) => !g.hardOnly).map((g) => g.id).join(',') ===
					'9212,9249,9427,9428,9431' &&
				hardFixed.find((g) => g.id === '9841')?.hardOnly === true,
			detail: hardFixed.map((g) => `${g.id}:${g.hardOnly ? 't' : 'f'}`).join(' '),
		});

		// 아이콘 파일명 — 거울 던전 456종이 전부 유일값을 갖는다. id 로는 유도되지 않는다
		const sprites = await prisma.gift.findMany({
			where: { sprite: { not: null } },
			select: { sprite: true },
		});
		checks.push({
			name: 'gift.sprite 456종 · 전부 유일',
			ok: sprites.length === 456 && new Set(sprites.map((s) => s.sprite)).size === 456,
			detail: `${sprites.length}행 · 유일 ${new Set(sprites.map((s) => s.sprite)).size} / 456`,
		});

		// 완전 공명 — mj 가 desc 와 requires 를 모순되게 준 6건을 desc 기준으로 세웠다
		const resonance = await prisma.$queryRaw<Array<{ total: bigint; abs: bigint }>>`
			SELECT count(*)::bigint AS total,
			       count(*) FILTER (WHERE value::text LIKE '%absolute%')::bigint AS abs
			FROM canonical.gift_requirement WHERE kind = 'resonance'
		`;
		checks.push({
			name: '완전 공명 23행 중 18행 (보정 전 12행)',
			ok:
				Number(resonance[0]?.total ?? 0n) === 23 && Number(resonance[0]?.abs ?? 0n) === 18,
			detail: `${Number(resonance[0]?.abs ?? 0n)} / ${Number(resonance[0]?.total ?? 0n)}`,
		});

		const bySin = await prisma.gift.groupBy({ by: ['sin'], _count: { _all: true } });
		const sinMap = Object.fromEntries(bySin.filter((r) => r.sin !== null).map((r) => [String(r.sin), r._count._all]));
		const wantSin: Record<string, number> = {
			wrath: 56, lust: 77, sloth: 57, gluttony: 60, gloom: 65, pride: 64, envy: 62,
		};
		checks.push({
			name: '죄악별 기프트 수',
			ok: Object.entries(wantSin).every(([k, v]) => sinMap[k] === v),
			detail: JSON.stringify(sinMap),
		});

		// assets Keywordless 120 = mj null 109 + assets 단독 11
		eq('keyword None (「범용」)', await prisma.gift.count({ where: { keywordId: 'None' } }), 120);
		eq('tierLabel EX', await prisma.gift.count({ where: { tierLabel: 'EX' } }), 2);
		eq('enhanceable true', await prisma.gift.count({ where: { enhanceable: true } }), 110);

		const koGaps = await prisma.fieldGap.findMany({
			where: { entity: 'gift', field: 'name', locale: 'ko' },
			select: { entityId: true },
		});
		checks.push({
			name: '한국어 결손 6건 (마스터북 일치)',
			ok:
				koGaps.length === 6 &&
				koGaps.map((g) => g.entityId).sort().join(',') === '1017,1031,1035,1036,1045,1047',
			detail: koGaps.map((g) => g.entityId).sort().join(' '),
		});

		// ── 전용 팩 쌍은 네 갈래 중 하나여야 한다 (감사 05 §9 · wiki/05 §5) ──
		// ① 팩 풀에 있다(드랍) ② 합성 결과물이다 ③ 팩이 Extreme·Hidden 이다
		// ④ 팩이 삭제된 콜라보다. 어디에도 안 걸리면 팩 풀 결손이다.
		// `canonical.pack` 에 retired 컬럼이 없어 ④ 는 pack_tag 'Collab'(=1122 선의의 순례)로 읽는다.
		const orphanExclusive = await prisma.$queryRaw<
			Array<{ gift_id: string; pack_id: string }>
		>`
			SELECT e.gift_id, e.pack_id
			FROM canonical.gift_exclusive_pack e
			WHERE NOT EXISTS (
			        SELECT 1 FROM canonical.gift_pack g
			        WHERE g.gift_id = e.gift_id AND g.pack_id = e.pack_id)
			  AND NOT EXISTS (
			        SELECT 1 FROM canonical.fusion_recipe f WHERE f.gift_id = e.gift_id)
			  AND NOT EXISTS (
			        SELECT 1 FROM canonical.pack_tag t
			        WHERE t.pack_id = e.pack_id AND t.tag IN ('Extreme', 'Hidden', 'Collab'))
			ORDER BY e.pack_id, e.gift_id
		`;
		checks.push({
			name: '전용 팩인데 어느 경로도 없는 쌍 (0이어야 한다)',
			ok: orphanExclusive.length === 0,
			detail:
				orphanExclusive.length === 0
					? '0 / 0'
					: orphanExclusive.map((r) => `${r.pack_id}×${r.gift_id}`).join(' '),
		});

		// ── 마스터북 완전 일치 쌍 재현 ① 기프트 ↔ 팩 역참조 441/441 ──
		const giftPackXref = await prisma.$queryRaw<Array<{ mj: bigint; ours: bigint; diff: bigint }>>`
			WITH mj AS (
			  SELECT o.id AS gift_id, jsonb_array_elements_text(o.payload->'packs') AS pack_id
			  FROM raw.raw_object o
			  WHERE o.src_path = 'gifts/limbus-data-mj/gifts.json' AND o.payload ? 'packs'
			),
			ours AS (SELECT gift_id, pack_id FROM canonical.gift_pack)
			SELECT (SELECT count(*) FROM mj)::bigint   AS mj,
			       (SELECT count(*) FROM ours)::bigint AS ours,
			       (SELECT count(*) FROM (SELECT * FROM mj EXCEPT SELECT * FROM ours) x)::bigint AS diff
		`;
		const gp = giftPackXref[0];
		checks.push({
			name: '기프트 ↔ 팩 역참조 (raw ↔ canonical)',
			ok: Number(gp?.mj ?? 0n) === 10_115 && Number(gp?.diff ?? 1n) === 0,
			detail: `mj ${Number(gp?.mj ?? 0n)} · 적재 ${Number(gp?.ours ?? 0n)} · 차집합 ${Number(gp?.diff ?? 0n)}`,
		});

		// ── ② 기프트 색 attributeType → sin 441/441 (raw 직접 대조) ──
		const colorXref = await prisma.$queryRaw<Array<{ total: bigint; mismatch: bigint }>>`
			WITH m(color, sin) AS (VALUES
			  ('CRIMSON','wrath'),('SCARLET','lust'),('AMBER','sloth'),('SHAMROCK','gluttony'),
			  ('AZURE','gloom'),('INDIGO','pride'),('VIOLET','envy')),
			d AS (
			  SELECT o.id, o.payload->>'attributeType' AS color
			  FROM raw.raw_object o
			  WHERE o.src_path = 'gifts/limbus-data-mj/gifts_detail.json'
			)
			SELECT count(*)::bigint AS total,
			       count(*) FILTER (WHERE m.sin IS DISTINCT FROM g.sin::text)::bigint AS mismatch
			FROM d JOIN m ON m.color = d.color
			JOIN canonical.gift g ON g.id = d.id
		`;
		const cx = colorXref[0];
		checks.push({
			name: '기프트 색 → 죄악 (attributeType ↔ sin)',
			ok: Number(cx?.total ?? 0n) === 441 && Number(cx?.mismatch ?? 1n) === 0,
			detail: `${Number(cx?.total ?? 0n)}건 중 불일치 ${Number(cx?.mismatch ?? 0n)}`,
		});

		// ── ③ assets affinity 는 4건 틀렸다 (게임 확인) ──
		const affinityXref = await prisma.$queryRaw<Array<{ n: bigint }>>`
			WITH a AS (
			  SELECT o.id, o.payload->>'affinity' AS affinity
			  FROM raw.raw_object o
			  WHERE o.src_path = 'gifts/limbus-assets/gifts.json'
			)
			SELECT count(*)::bigint AS n
			FROM a JOIN canonical.gift g ON g.id = a.id
			WHERE g.sin IS NOT NULL AND a.affinity IS DISTINCT FROM g.sin::text
		`;
		const af = Number(affinityXref[0]?.n ?? 0n);
		checks.push({
			name: 'assets affinity 오류 4건 (mj 가 정답)',
			ok: af === 4,
			detail: `${af} / 4`,
		});

		// ══ 인격 계열 ══════════════════════════════════════════════
		eq('sinner', await prisma.sinner.count(), 12);
		eq('sinner_text', await prisma.sinnerText.count(), 24);
		eq('association', await prisma.association.count(), 64);
		eq('association_text', await prisma.associationText.count(), 185);

		eq('skill', await prisma.skill.count(), 1_045);
		// 1,036스킬 × 5단계 = 5,180 에서 슬롯 3 해금분 206×2 를 뺀다
		eq('skill_stage', await prisma.skillStage.count(), 4_768);
		eq('skill_stage_text', await prisma.skillStageText.count(), 13_264);
		// 로케일 축이 생겨 ko 7,634 · en 9,214 · ja 7,634 이다
		eq('skill_coin', await prisma.skillCoin.count(), 24_482);

		eq('passive', await prisma.passive.count(), 709);
		eq('passive_text', await prisma.passiveText.count(), 1_981);
		eq('passive_requirement', await prisma.passiveRequirement.count(), 534);

		eq('identity', await prisma.identity.count(), 184);
		eq('identity_text', await prisma.identityText.count(), 552);
		eq('identity_resist', await prisma.identityResist.count(), 552);
		// 동기화 축을 갖는다 — 184인격 × 4단계
		eq('identity_speed', await prisma.identitySpeed.count(), 736);
		eq('identity_skill', await prisma.identitySkill.count(), 1_020);
		eq('identity_passive', await prisma.identityPassive.count(), 768);
		eq('identity_association', await prisma.identityAssociation.count(), 241);
		eq('identity_keyword', await prisma.identityKeyword.count(), 266);
		eq('identity_unit_keyword', await prisma.identityUnitKeyword.count(), 391);

		// 수감자 12명이 각각 14–16개 인격을 갖는다
		const perSinner = await prisma.identity.groupBy({ by: ['sinnerId'], _count: { _all: true } });
		checks.push({
			name: '수감자별 인격 수 14–16',
			ok:
				perSinner.length === 12 &&
				perSinner.every((r) => r._count._all >= 14 && r._count._all <= 16),
			detail: perSinner.map((r) => r._count._all).join(' '),
		});

		eq('star=1 인격 (LCB 기본)', await prisma.identity.count({ where: { star: 1 } }), 12);

		// 단계가 있는 스킬은 5단계다 — 전량 전개의 정의.
		// 예외는 동기화 III 에서 해금되는 슬롯 3 스킬 206건이며 3·4·5 만 갖는다.
		const stageShape = await prisma.$queryRaw<Array<{ n: bigint; from3: bigint }>>`
			SELECT count(*)::bigint                                    AS n,
			       count(*) FILTER (WHERE lo = 3 AND cnt = 3)::bigint  AS from3
			FROM (
			  SELECT skill_id, count(*) AS cnt, min(uptie) AS lo
			  FROM canonical.skill_stage GROUP BY skill_id HAVING count(*) <> 5
			) x
		`;
		checks.push({
			name: '5단계가 아닌 스킬은 해금분 206건뿐',
			ok:
				Number(stageShape[0]?.n ?? 0n) === 206 && Number(stageShape[0]?.from3 ?? 0n) === 206,
			detail: `${Number(stageShape[0]?.n ?? 0n)}건 중 3–5단계 ${Number(stageShape[0]?.from3 ?? 0n)} / 206`,
		});

		// 잘라낸 206건이 전부 슬롯 3 이어야 한다 — 위키의 Skill 3 해금 규칙과 겹친다
		const lockedSlot = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n
			FROM (
			  SELECT skill_id FROM canonical.skill_stage
			  GROUP BY skill_id HAVING count(*) = 3 AND min(uptie) = 3
			) x
			JOIN canonical.identity_skill i ON i.skill_id = x.skill_id AND i.slot = 3
		`;
		checks.push({
			name: '잘라낸 206건이 전부 슬롯 3 이다',
			ok: Number(lockedSlot[0]?.n ?? 0n) === 206,
			detail: `${Number(lockedSlot[0]?.n ?? 0n)} / 206`,
		});

		// 단계 수치 — identity-details 에만 있다. mj 만 읽으면 전량 NULL 이 된다
		const stageValues = await prisma.$queryRaw<
			Array<{ bv: bigint; cv: bigint; aw: bigint; lc: bigint; cl: bigint }>
		>`
			SELECT count(base_value)::bigint       AS bv,
			       count(coin_value)::bigint       AS cv,
			       count(atk_weight)::bigint       AS aw,
			       count(level_correction)::bigint AS lc,
			       count(clashable)::bigint        AS cl
			FROM canonical.skill_stage
		`;
		const sv = stageValues[0];
		checks.push({
			name: '단계 수치 4종 각 3,708 · clashable 260',
			ok:
				Number(sv?.bv ?? 0n) === 3_708 &&
				Number(sv?.cv ?? 0n) === 3_708 &&
				Number(sv?.aw ?? 0n) === 3_708 &&
				Number(sv?.lc ?? 0n) === 3_708 &&
				Number(sv?.cl ?? 0n) === 260,
			detail: `위력 ${Number(sv?.bv ?? 0n)} · 코인 ${Number(sv?.cv ?? 0n)} · 가중 ${Number(sv?.aw ?? 0n)} · 보정 ${Number(sv?.lc ?? 0n)} · 합 ${Number(sv?.cl ?? 0n)}`,
		});

		// 코인 한국어 — 초판은 영문 단일이라 한글이 0행이었다
		const coinKo = await prisma.$queryRaw<Array<{ n: bigint; ko: bigint; ub: bigint }>>`
			SELECT count(*) FILTER (WHERE locale = 'ko')::bigint AS n,
			       count(*) FILTER (
			         WHERE locale = 'ko' AND array_to_string(effects, ' ') ~ '[가-힣]'
			       )::bigint AS ko,
			       count(*) FILTER (WHERE type = 'unbreakable')::bigint AS ub
			FROM canonical.skill_coin
		`;
		checks.push({
			name: '코인 한국어 7,634행 중 5,936행에 한글 · 파괴불가 1,500',
			ok:
				Number(coinKo[0]?.n ?? 0n) === 7_634 &&
				Number(coinKo[0]?.ko ?? 0n) === 5_936 &&
				Number(coinKo[0]?.ub ?? 0n) === 1_500,
			detail: `ko ${Number(coinKo[0]?.n ?? 0n)} · 한글 ${Number(coinKo[0]?.ko ?? 0n)} · unbreakable ${Number(coinKo[0]?.ub ?? 0n)}`,
		});

		// 패시브 발동 조건 — assets passiveData 에만 있다
		eq('패시브 condType', await prisma.passive.count({ where: { condType: { not: null } } }), 485);
		eq('패시브 condType res', await prisma.passive.count({ where: { condType: 'res' } }), 146);
		eq('패시브 condType owned', await prisma.passive.count({ where: { condType: 'owned' } }), 339);

		// 체력은 기본값과 레벨당 증가치의 쌍이다
		eq('hp_level 보유', await prisma.identity.count({ where: { hpLevel: { not: null } } }), 184);
		// mj 에 season 키가 없는 2건을 assets 가 갖고 있다 — 위키 확인으로 0 이 맞다
		eq('season NULL (0이어야 한다)', await prisma.identity.count({ where: { season: null } }), 0);

		// changedHere 가 원본 델타 수와 같아야 한다 — 실측 2,561
		eq(
			'changedHere true (원본 델타 2,561)',
			await prisma.skillStage.count({ where: { changedHere: true } }),
			2_561,
		);

		// 유령 패시브 6건
		const ghosts = await prisma.fieldGap.findMany({
			where: { entity: 'passive', field: 'name' },
			select: { entityId: true },
		});
		checks.push({
			name: '유령 패시브 6건 (마스터북 일치)',
			ok:
				ghosts.length === 6 &&
				ghosts.map((g) => g.entityId).sort().join(',') ===
					'1011003,1021202,1031102,1050803,1051102,1100903',
			detail: ghosts.map((g) => g.entityId).sort().join(' '),
		});

		// 공격 스킬은 슬롯·매수를 갖는다 — 덱 구성 정보
		// 공격 스킬 전건이 슬롯·매수를 갖는다
		const atkTotal = await prisma.identitySkill.count({ where: { role: 'attack' } });
		const atkSlot = await prisma.identitySkill.count({
			where: { role: 'attack', slot: { not: null } },
		});
		checks.push({
			name: '공격 스킬 전건이 슬롯을 갖는다',
			ok: atkTotal === 624 && atkSlot === 624,
			detail: `${atkSlot} / ${atkTotal} (624 기대)`,
		});

		// 모든 인격이 저항 3축을 갖는다
		const badResist = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT identity_id FROM canonical.identity_resist GROUP BY identity_id HAVING count(*) <> 3
			) x
		`;
		checks.push({
			name: '저항 3축이 아닌 인격 (0이어야 한다)',
			ok: Number(badResist[0]?.n ?? 1n) === 0,
			detail: `${Number(badResist[0]?.n ?? 0n)} / 0`,
		});

		// ══ E.G.O 계열 ═════════════════════════════════════════════
		eq('ego', await prisma.ego.count(), 115);
		eq('ego (플레이)', await prisma.ego.count({ where: { presentationOnly: false } }), 110);
		eq('ego (연출 전용)', await prisma.ego.count({ where: { presentationOnly: true } }), 5);
		eq('ego_text', await prisma.egoText.count(), 345);
		eq('ego_resist', await prisma.egoResist.count(), 770);
		eq('ego_cost', await prisma.egoCost.count(), 314);
		eq('ego_corrosion', await prisma.egoCorrosion.count(), 330);
		eq('ego_requirement', await prisma.egoRequirement.count(), 314);
		// 스킬은 ego-details 가 정본이다. 초판의 loc 접두 스캔이 연출 전용 E.G.O 의
		// 스킬 5건을 기본 E.G.O 로 끌어와 215였다(감사 §4.3)
		eq('ego_skill', await prisma.egoSkill.count(), 210);
		// loc ∪ ego-details. loc 만 보면 616 이고, loc 이 안 싣는 단계가 29건 있다
		eq('ego_skill_stage', await prisma.egoSkillStage.count(), 640);
		eq('ego_skill_stage_text', await prisma.egoSkillStageText.count(), 1_833);
		// 효과 문구 없는 코인을 버리던 초판이 2,745 였다(감사 §3.5)
		eq('ego_skill_coin', await prisma.egoSkillCoin.count(), 2_832);
		eq('ego_passive', await prisma.egoPassive.count(), 113);
		eq('ego_passive_text', await prisma.egoPassiveText.count(), 339);
		eq('ego_passive_link', await prisma.egoPassiveLink.count(), 113);

		const byRank = await prisma.ego.groupBy({ by: ['rank'], _count: { _all: true } });
		const rankMap = Object.fromEntries(
			byRank.filter((r) => r.rank !== null).map((r) => [String(r.rank), r._count._all]),
		);
		checks.push({
			name: 'E.G.O 등급 분포',
			ok:
				rankMap['ZAYIN'] === 20 &&
				rankMap['TETH'] === 32 &&
				rankMap['HE'] === 40 &&
				rankMap['WAW'] === 18,
			detail: JSON.stringify(rankMap),
		});

		// 저항은 죄악 7축이다 — white·black 은 담기지 않는다
		const badEgoResist = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT ego_id FROM canonical.ego_resist GROUP BY ego_id HAVING count(*) <> 7
			) x
		`;
		checks.push({
			name: '저항 7축이 아닌 E.G.O (0이어야 한다)',
			ok: Number(badEgoResist[0]?.n ?? 1n) === 0,
			detail: `${Number(badEgoResist[0]?.n ?? 0n)} / 0`,
		});

		eq(
			'white·black 이 tool_annotation 으로 격리',
			await prisma.toolAnnotation.count({ where: { entity: 'ego', field: 'legacyResist' } }),
			110,
		);

		// **두 번째 각성 스킬은 2건뿐이다** — mj 의 awakeningSkill 은 스칼라라 못 담고,
		// loc 접두 스캔은 연출 전용 E.G.O 의 스킬 5건까지 끌어와 7건이 됐었다.
		// 위키 대조로 20608 오혈읍루-종 · 21209 눈부시지 않은 영광-광휘 둘만이 진짜다
		const second = await prisma.egoSkill.findMany({
			where: { role: 'awakening', ordinal: { gt: 0 } },
			select: { id: true },
		});
		checks.push({
			name: '두 번째 각성 스킬 2건 (ego-details 단독)',
			ok:
				second.length === 2 &&
				second.map((s) => s.id).sort().join(',') === '2060812,2120912',
			detail: second.map((s) => s.id).sort().join(' '),
		});

		// 연출 전용 E.G.O 의 스킬이 기본 E.G.O 로 새지 않는다
		const strayAwaken = await prisma.egoSkill.count({
			where: { id: { in: ['2010112', '2030112', '2050112', '2060112', '2110112'] } },
		});
		checks.push({
			name: '연출 전용 스킬 오귀속 (0이어야 한다)',
			ok: strayAwaken === 0,
			detail: `${strayAwaken} / 0`,
		});

		// **스킬 수치** — ego-details 에만 있다. 델타 배열이라 전개해야 전 단계가 찬다
		eq(
			'E.G.O 스킬 수치 채움 (spCost)',
			await prisma.egoSkillStage.count({ where: { spCost: { not: null } } }),
			640,
		);
		eq(
			'E.G.O 스킬 수치 채움 (baseValue)',
			await prisma.egoSkillStage.count({ where: { baseValue: { not: null } } }),
			640,
		);

		// 골든 표본 — 위키 {{EGPage}} 와 전 필드 대조해 불일치 0건이었다(위키 조사 §4).
		// 20101 오감도: uptie 1 위력 14 → uptie 3 에서 18 로 오르고 4 는 그대로(델타 상속)
		const crow = await prisma.egoSkillStage.findMany({
			where: { skillId: '2010111' },
			orderBy: { uptie: 'asc' },
		});
		checks.push({
			name: '골든 표본 20101 오감도 (위키 대조값)',
			ok:
				crow.length === 3 &&
				crow.every((s) => s.spCost === 10 && s.coinValue === 6 && s.atkWeight === 1 && s.levelCorrection === -4) &&
				crow.map((s) => s.baseValue).join(',') === '14,18,18',
			detail: crow.map((s) => `u${s.uptie} base ${s.baseValue}`).join(' · '),
		});

		// **효과 문구가 없는 코인도 남아야 한다.** 초판은 이것을 버려 코인 수를 잃었다.
		// 위키 확인 — 2120611 Bygone Days · 2120911 Unbrilliant Glory-Flowing 둘 다 coin=1
		const emptyCoins = await prisma.egoSkillCoin.count({ where: { effects: { isEmpty: true } } });
		checks.push({
			name: '효과 문구 없는 코인 보존 102건 (0이면 되레 버그다)',
			ok: emptyCoins === 102,
			detail: `${emptyCoins} / 102`,
		});
		const noCoinStage = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n
			FROM canonical.ego_skill_stage s
			WHERE NOT EXISTS (SELECT 1 FROM canonical.ego_skill_coin c
			                  WHERE c.skill_id = s.skill_id AND c.uptie = s.uptie)
		`;
		checks.push({
			// 남는 29건은 loc 에 아예 없고 ego-details 에만 있는 단계다 — 문구도 코인도 loc 소관이라 없다
			name: '코인 0개 단계 29건 (loc 에 없는 단계뿐)',
			ok: Number(noCoinStage[0]?.n ?? 0n) === 29,
			detail: `${Number(noCoinStage[0]?.n ?? 0n)} / 29`,
		});

		// 침식 확률표는 E.G.O 마다 3행이다
		const badCorrosion = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT ego_id FROM canonical.ego_corrosion GROUP BY ego_id HAVING count(*) <> 3
			) x
		`;
		checks.push({
			name: '침식 3구간이 아닌 E.G.O (0이어야 한다)',
			ok: Number(badCorrosion[0]?.n ?? 1n) === 0,
			detail: `${Number(badCorrosion[0]?.n ?? 0n)} / 0`,
		});

		// ══ 상태·어휘 계열 ═════════════════════════════════════════
		eq('status', await prisma.status.count(), 1_472);
		// 1,472종 × 3언어 = 4,416. **거울 던전 로케일을 읽고 나서 전량이 찼다** —
		// 예전 3,913 은 `mirror-dungeon/loc-*` 를 안 읽어 생긴 거짓 결손 503건만큼 적었다.
		// 결손이 0이라 수동 보정은 행을 더하지 못하고 덮기만 한다 — 되더할 것이 없다
		eq('status_text (1,472 × 3언어)', await prisma.statusText.count(), 4_416);

		// 자리표시자가 남은 설명. `Bufs` 의 desc 는 게임이 실행 중에 값을 채우는
		// 정의문이라 `{0}` 이 그대로 있다 — 표시용인 `BattleKeywords` 를 앞에 둬서
		// 168건이 사람이 읽는 문장으로 바뀌었다. 남는 5건은 어느 출처에도 채워진
		// 판이 없다(현행 파이프라인도 같은 것을 보여준다).
		//
		// **이 수가 늘면 우선순위가 뒤집힌 것이다.** 용어집 화면이 {0} 을 그린다
		// **역슬래시를 두 번 쓴다.** 템플릿 문자열이 `\{` 를 `{` 로 삼켜 SQL 에는
		// 다른 무늬가 간다 — `\[` 를 그렇게 썼다가 `[[A-Za-z]` 라는 문자 클래스가
		// 되어 모든 글자에 걸린 적이 있다
		const placeholders = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.status_text
			 WHERE "desc" ~ '\\{[0-9]\\}'`;
		eq('설명에 남은 자리표시자 (× 3언어)', Number(placeholders[0]?.n ?? 0n), 15);

		// 표제어 치환이 끝났나. `desc` 는 표시용이고 `desc_raw` 가 원문이다 —
		// 대괄호 표기가 남으면 화면이 그것을 그대로 그린다.
		//
		// **0 이 아니고, 로케일마다 크게 다르다.** 이유가 셋이다.
		//
		//   ko  35     term 에 id 는 있으나 term_text 에 이름이 없는 표제어
		//              (TabExplain 등 29종). 원문을 유지한다 — 지우면 문장이
		//              무너지고 만들어내면 없는 말을 짓는 것이 된다
		//   en  4,105  영어 문장이 원래 대괄호로 인쇄하는 표시가 있다 —
		//              [On Use] 1,649 · [Indiscriminate] 490 · [Combat Start] 398.
		//              표제어가 아니라 게임 표기다. 한국어는 「[사용 시]」라
		//              영문 무늬에 안 걸린다
		//   ja  4,331  사전이 ko·en 뿐이다. 원본이 그렇고 현행도 같다
		//
		// **이 수가 늘면 치환이 빠진 것이다.**
		const tokens = await prisma.$queryRaw<Array<{ locale: string; n: bigint }>>`
			SELECT locale, count(*)::bigint AS n FROM (
				SELECT locale, "desc" FROM canonical.gift_stage_text
				UNION ALL SELECT locale, "desc" FROM canonical.skill_stage_text
				UNION ALL SELECT locale, "desc" FROM canonical.passive_text
				UNION ALL SELECT locale, "desc" FROM canonical.ego_skill_stage_text
				UNION ALL SELECT locale, "desc" FROM canonical.ego_passive_text
				UNION ALL SELECT locale, "desc" FROM canonical.status_text
			) t WHERE "desc" ~ '\\[[A-Za-z]' GROUP BY locale`;
		const tokenOf = (locale: string) =>
			Number(tokens.find((r) => r.locale === locale)?.n ?? 0n);
		eq('한국어에 남은 표제어 표기 (사전에 이름이 없다)', tokenOf('ko'), 35);
		eq('영어에 남은 표제어 표기 (게임 표기 포함)', tokenOf('en'), 4_105);
		eq('일본어에 남은 표제어 표기 (사전이 ko·en 뿐이다)', tokenOf('ja'), 4_331);
		eq('status_category', await prisma.statusCategory.count(), 163);
		eq('sin_info', await prisma.sinInfo.count(), 7);
		eq('sin_text', await prisma.sinText.count(), 14);
		eq('term', await prisma.term.count(), 483);
		eq('identity_status', await prisma.identityStatus.count(), 1_179);
		eq('ego_status', await prisma.egoStatus.count(), 475);

		const byBuff = await prisma.status.groupBy({ by: ['buffType'], _count: { _all: true } });
		const buffMap = Object.fromEntries(byBuff.map((r) => [String(r.buffType), r._count._all]));
		checks.push({
			name: '상태 성격 분포',
			ok: buffMap['Positive'] === 678 && buffMap['Neutral'] === 416 && buffMap['Negative'] === 378,
			detail: JSON.stringify(buffMap),
		});

		// **한국어 결손 245종은 거짓 결손이었다.** 전부 거울 던전 상태(MD*)이고
		// 로케일이 `mechanics/loc-*` 가 아니라 `mirror-dungeon/loc-*` 에 있었다.
		// 이제 ko·ja 모두 0 이어야 한다 — 다시 늘면 그 출처를 놓친 것이다.
		const statusKoGap = await prisma.fieldGap.count({
			where: { entity: 'status', field: 'name', locale: 'ko' },
		});
		const statusJaGap = await prisma.fieldGap.count({
			where: { entity: 'status', field: 'name', locale: 'ja' },
		});
		checks.push({
			name: '상태 표시명 결손 (ko·ja 0이어야 한다)',
			ok: statusKoGap === 0 && statusJaGap === 0,
			detail: `ko ${statusKoGap} · ja ${statusJaGap} / 0`,
		});

		// ── 스펙 6절 — 코인 토큰이 그래프 투영 준비를 끝냈나 ──────────
		const byKind = await prisma.$queryRaw<Array<{ kind: string; n: bigint; kinds: bigint }>>`
			SELECT kind, count(*)::bigint AS n, count(DISTINCT token)::bigint AS kinds
			FROM canonical.coin_token GROUP BY kind
		`;
		const st = byKind.find((r) => r.kind === 'status');
		const tm = byKind.find((r) => r.kind === 'timing');
		checks.push({
			name: '코인 토큰이 상태 189 · 시점 26 으로 갈린다',
			ok: Number(st?.kinds ?? 0n) === 189 && Number(tm?.kinds ?? 0n) === 26,
			detail: `상태 ${Number(st?.kinds ?? 0n)}종 ${Number(st?.n ?? 0n)}건 · 시점 ${Number(tm?.kinds ?? 0n)}종 ${Number(tm?.n ?? 0n)}건`,
		});

		const tokenFk = await prisma.coinToken.count({ where: { statusId: { not: null } } });
		const tokenStatus = await prisma.coinToken.count({ where: { kind: 'status' } });
		checks.push({
			name: 'status 토큰 전건이 FK 를 갖는다',
			ok: tokenFk === tokenStatus && tokenFk === 12_521,
			detail: `${tokenFk} / ${tokenStatus} (12,521 기대)`,
		});

		// E.G.O·인격의 상태 연결이 100 % 걸렸다 — 결손이 0이어야 한다
		eq(
			'상태 연결 결손 (0이어야 한다)',
			await prisma.fieldGap.count({ where: { field: 'statuses' } }),
			0,
		);

		// ══ 메카닉 축 ═══════════════════════════════════════════════
		// 축은 8종이다. status_category 의 카테고리 중 트리거가 참조하는 것만이며,
		// 주살·마탄·원호 방어 등은 트리거가 하나도 참조하지 않아 축이 아니다
		eq('axis', await prisma.axis.count(), 8);
		eq('trigger_ref', await prisma.triggerRef.count(), 150);
		eq('effect_ref', await prisma.effectRef.count(), 55);
		// 293 = keyword 266 + special_status(BULLET 하나) 13 + granted 14(axis-grant 설계).
		// ego_id·ego_granted 경로는 폐기됐다 — app.axis_grant 18행이 정본이다(ADR-08).
		// special_status 는 keyword 어휘가 못 담는 축(BULLET)만 보강한다. 제한의 사정거리는
		// keyword 가 표현하는 축까지다(2026-08-10, 사용자 확정) — 「화상, 진동으로만
		// 취급됨」은 부여 키워드에 대한 말이지 가속탄(자원, 어휘 밖)에 대한 말이 아니라
		// 10916 도 BULLET 13짝에 포함된다.
		eq('identity_axis', await prisma.identityAxis.count(), 293);
		eq('identity_axis (special_status)',
			await prisma.identityAxis.count({ where: { source: 'special_status' } }), 13);
		eq('identity_axis (granted)',
			await prisma.identityAxis.count({ where: { source: 'granted' } }), 14);

		// ── 저작 축 부여·제한 (Task 3, ADR-08) ────────────────────────
		// 18 = 17 + 1. 새 행 10104:SINKING(restrict) 은 sourceKind='system' 이다 —
		// 게임 텍스트에 근거가 없는 유저 관측이라는 사실을 데이터가 스스로 말한다
		// (2026-08-10, 사용자 확정)
		eq('axis_grant (저작, app 스키마)', await prisma.axisGrant.count(), 18);
		eq('axis_restrict', await prisma.axisRestrict.count(), 8);

		// affects 칸 값 — v2:diff 는 표 집합·행수·엔티티 id 만 보고 칸 값 변경은
		// 못 잡는다. 제한 패시브 넷 중 둘(1010902·1110902)만 스킬 취급까지 부정해
		// affects='both' 고, 나머지 둘(1041502·1091603)은 인격 취급만 제한해 'tag' 다
		// (f2901af, 2026-08-10). 10104:SINKING 도 스킬 부정 문장이 없어 'tag' 다 —
		// tag 5→6. 저작 원본 axis_grant 도 같은 사각이라 함께 지킨다
		const restrictAffects = await prisma.axisRestrict.groupBy({
			by: ['affects'], _count: { _all: true },
		});
		const raMap = Object.fromEntries(restrictAffects.map((r) => [r.affects, r._count._all]));
		checks.push({
			name: 'axis_restrict 의 affects 분포 (tag 6 · both 2)',
			ok: raMap['tag'] === 6 && raMap['both'] === 2 && Object.keys(raMap).length === 2,
			detail: JSON.stringify(raMap),
		});
		const grantAffects = await prisma.axisGrant.groupBy({
			by: ['affects'], _count: { _all: true },
		});
		const gaMap = Object.fromEntries(grantAffects.map((r) => [r.affects, r._count._all]));
		checks.push({
			name: 'axis_grant 의 affects 분포 (tag 6 · skill 4 · both 8)',
			ok: gaMap['tag'] === 6 && gaMap['skill'] === 4 && gaMap['both'] === 8
				&& Object.keys(gaMap).length === 3,
			detail: JSON.stringify(gaMap),
		});

		// (가) 지운 불변식의 대체 — 원래 ego_id 를 보던 원시 SQL 검사가 칸이 없어지며
		// 함께 지워졌다. 실제로 구운 293행 전체에 걸어 되살린다.
		// keyword·special_status 경로는 identity-axis.ts 가 항상 always/'' 로 적는다
		// (조건이 없다는 뜻). 조건부 게이트(ego_equipped 등)는 granted 에만 있다
		const conditionalNonGranted = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.identity_axis
			WHERE source IN ('keyword', 'special_status')
			  AND NOT (gate_kind = 'always' AND gate_ref = '')
		`;
		checks.push({
			name: 'keyword·special_status 는 항상 always/무조건이다 (0이어야 한다)',
			ok: Number(conditionalNonGranted[0]?.n ?? 1n) === 0,
			detail: `${Number(conditionalNonGranted[0]?.n ?? 0n)} / 0`,
		});

		// (나) 제한이 실제로 걸렸는가 — canonical.keyword 어휘가 표현하는 축으로 한정한다.
		// 어휘를 하드코딩하지 않고 keyword 테이블을 질의해 대조한다. 어휘 밖 축(BULLET)은
		// 제한이 손대지 않으므로(identity-axis.ts 39-44행) 이 검사 밖에 둔다 — 안 그러면
		// 10916 이 BULLET 을 갖고 있다는 사실만으로 반드시 실패한다.
		//
		// **채널마다 따진다.** `affects='both'` 인 행만 보면(예전 판) 좁혀진 행(10104
		// 의 VIBRATION 처럼 tag 는 막히고 skill 은 남는 행)이 검사 밖으로 빠진다 —
		// `applyRestrict` 가 두 채널을 다 막아야 하는데 한 채널로만 좁혀 내보내는
		// 버그가 생겨도 이 검사가 못 잡는다는 뜻이다. 이 PR 이 지키려는 불변식이
		// 정확히 그것이니 검사가 채널 단위로 덮어야 한다.
		//
		// 행이 주장하는 채널(both → tag·skill 둘, 그 밖 → 자기 자신)마다 「그 채널을
		// 덮는 axis_restrict 가 있는데 이 축은 그 인격의 그 채널 허용 목록에 없다」를
		// 찾는다. `r.affects = 'both'` 인 restrict 행은 tag·skill 두 채널을 다 덮는다.
		const leaked = await prisma.$queryRaw<Array<{ n: bigint }>>`
			WITH vocab AS (SELECT upper(id) AS axis_id FROM canonical.keyword),
			     ch AS (
			       SELECT ia.identity_id, ia.axis_id,
			              unnest(CASE WHEN ia.affects = 'both'
			                          THEN ARRAY['tag','skill'] ELSE ARRAY[ia.affects] END) AS channel
			       FROM canonical.identity_axis ia
			       JOIN vocab v ON v.axis_id = ia.axis_id
			     )
			SELECT count(*)::bigint AS n
			FROM ch
			WHERE EXISTS (
			        SELECT 1 FROM canonical.axis_restrict r
			        WHERE r.identity_id = ch.identity_id
			          AND (r.affects = ch.channel OR r.affects = 'both'))
			  AND NOT EXISTS (
			        SELECT 1 FROM canonical.axis_restrict r
			        WHERE r.identity_id = ch.identity_id
			          AND (r.affects = ch.channel OR r.affects = 'both')
			          AND r.axis_id = ch.axis_id)
		`;
		checks.push({
			name: '어느 채널에서도 제한 밖 축이 남지 않는다 (어휘 안 축으로 한정)',
			ok: Number(leaked[0]?.n ?? 1n) === 0,
			detail: `${Number(leaked[0]?.n ?? 0n)} / 0`,
		});

		// special_status 로 온 축 13행 — **축 이름을 하드코딩하지 않는다.** `canonical.keyword`
		// 를 질의해 「special_status 로 온 축 ∩ 어휘 = ∅」로 잰다(위 leaked 검사와 같은
		// 방식). 지금은 그 교집합이 비는 유일한 축이 BULLET 이라 결과가 같지만, 어휘가
		// 늘거나 축이 늘어도 이 검사는 자동으로 따라간다. 행수 단정(13)만 남긴다
		const specialStatusRows = await prisma.identityAxis.findMany({
			where: { source: 'special_status' },
			select: { axisId: true },
		});
		const keywordAxisIds = new Set(
			(await prisma.keyword.findMany({ select: { id: true } })).map((k) => k.id.toUpperCase()),
		);
		const specialStatusInVocab = specialStatusRows.filter((r) => keywordAxisIds.has(r.axisId));
		checks.push({
			name: 'special_status 로 온 축 13행 — keyword 어휘와 교집합이 없다',
			ok: specialStatusRows.length === 13 && specialStatusInVocab.length === 0,
			detail: `${specialStatusRows.length}행 · 어휘와 겹침 ${specialStatusInVocab.length} · ` +
				`축 ${[...new Set(specialStatusRows.map((r) => r.axisId))].join(',')}`,
		});

		// (다) 제한 넷 + 1 의 축 실측 대조 — 게임 문장(넷)과 유저 관측(10104)에서 온
		// 값이다. 10916 은 BULLET 이 어휘 밖이라 제한이 안 닿아 여전히 갖는다(설계
		// 41-44행). 10104 는 원문에 근거가 없는 미문서화 예외다(2026-08-10, 사용자
		// 확정) — SINKING·VIBRATION 축 집합 자체는 그대로 남고 affects 만 갈린다
		const RESTRICTED_EXPECTED: Record<string, string[]> = {
			'10104': ['SINKING', 'VIBRATION'],
			'10109': ['LACERATION'],
			'10415': ['BREATH', 'COMBUSTION', 'LACERATION'],
			'10916': ['BULLET', 'COMBUSTION', 'VIBRATION'],
			'11109': ['LACERATION'],
		};
		for (const [identityId, want] of Object.entries(RESTRICTED_EXPECTED)) {
			const got = (await prisma.identityAxis.findMany({
				where: { identityId }, select: { axisId: true },
			})).map((r) => r.axisId);
			const uniq = [...new Set(got)].sort();
			checks.push({
				name: `제한 인격 ${identityId} 의 축`,
				ok: JSON.stringify(uniq) === JSON.stringify(want),
				detail: `${uniq.join(' ')} / ${want.join(' ')}`,
			});
		}

		// 10104 는 축 집합이 아니라 채널이 갈리는 첫 실사례다 — SINKING 은 원문이
		// 직접 말하는 축이라 both 로 남고, VIBRATION 은 restrict 가 tag 채널만 막아
		// 태그에서는 빠지고 스킬 채널로 좁혀진다(사라지지 않는다, Task 3 채널 좁히기)
		const dongbaek = await prisma.identityAxis.findMany({
			where: { identityId: '10104' }, select: { axisId: true, affects: true },
		});
		const dongbaekMap = Object.fromEntries(dongbaek.map((r) => [r.axisId, r.affects]));
		checks.push({
			name: '10104 개화 E.G.O::동백 이상 — SINKING both · VIBRATION skill(좁혀짐)',
			ok: dongbaekMap['SINKING'] === 'both' && dongbaekMap['VIBRATION'] === 'skill',
			detail: JSON.stringify(dongbaekMap),
		});

		// 게이트 어휘 — identity_axis.gate_kind 는 다섯 갈래 밖으로 안 샌다
		const badGate = await prisma.identityAxis.count({
			where: { gateKind: { notIn: ['always', 'ego_equipped', 'gift_held', 'roster_count', 'status_held'] } },
		});
		checks.push({
			name: 'identity_axis 의 gate_kind 어휘 (0이어야 한다)',
			ok: badGate === 0,
			detail: `${badGate} / 0`,
		});

		// gate_min 은 roster_count 게이트에만 있다 — 다른 게이트 종류에 값이 있거나
		// roster_count 인데 값이 없으면 게이트 계약이 깨진 것이다
		const badMin = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.identity_axis
			WHERE (gate_kind = 'roster_count') <> (gate_min IS NOT NULL)
		`;
		checks.push({
			name: 'gate_min 은 roster_count 일 때만 있다 (0이어야 한다)',
			ok: Number(badMin[0]?.n ?? 1n) === 0,
			detail: `${Number(badMin[0]?.n ?? 0n)} / 0`,
		});

		// **소속 트리거가 상태에 걸리면 안 된다.** 이름 매칭에서 실재하는 오매칭이다 —
		// 'Dawn Office Identities' 가 DawnTeam(Dawn Office) 상태에,
		// 'N Corp. Fanatic Identities' 가 AssemblePersonality(Fanatic) 에 걸린다
		const misMatched = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.trigger_ref
			WHERE trigger_id LIKE '% Identities' AND ref_kind = 'axis'
		`;
		checks.push({
			name: '소속 트리거가 축에 잘못 걸렸다 (0이어야 한다)',
			ok: Number(misMatched[0]?.n ?? 1n) === 0,
			detail: `${Number(misMatched[0]?.n ?? 0n)} / 0`,
		});

		// trigger_ref·effect_ref 의 axis 참조가 전부 axis 테이블에 있어야 한다
		const orphanAxis = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT (SELECT count(*) FROM canonical.trigger_ref r
			        WHERE r.ref_kind='axis' AND NOT EXISTS
			          (SELECT 1 FROM canonical.axis a WHERE a.id = r.ref_id))
			     + (SELECT count(*) FROM canonical.effect_ref r
			        WHERE r.ref_kind='axis' AND NOT EXISTS
			          (SELECT 1 FROM canonical.axis a WHERE a.id = r.ref_id)) AS n
		`;
		checks.push({
			name: '축 테이블에 없는 축을 가리킨다 (0이어야 한다)',
			ok: Number(orphanAxis[0]?.n ?? 1n) === 0,
			detail: `${Number(orphanAxis[0]?.n ?? 0n)} / 0`,
		});

		// evaluability 5갈래 — 한 갈래도 0이면 안 된다. 규칙이 퇴화하면 전부 한 값으로 쏠린다
		const evalDist = await prisma.$queryRaw<Array<{ evaluability: string; n: bigint }>>`
			SELECT evaluability, count(*)::bigint AS n
			FROM canonical.trigger_ref GROUP BY 1
		`;
		const ed = Object.fromEntries(evalDist.map((r) => [r.evaluability, Number(r.n)]));
		checks.push({
			name: 'evaluability 5갈래가 전부 나온다',
			ok: ['roster', 'roster_gated', 'runtime', 'always', 'unclassified']
				.every((k) => (ed[k] ?? 0) > 0),
			detail: Object.entries(ed).map(([k, v]) => `${k} ${v}`).join(' · '),
		});

		// 골든 표본 — 검계 살수 파우스트(10208)는 출혈·호흡 인격이다. mj 의 keyword 가
		// 홍매화(특수 출혈)를 이미 반영해 담아 keyword 경로만으로 LACERATION 에 닿는다
		const faust = await prisma.identityAxis.findMany({
			where: { identityId: '10208' },
			select: { axisId: true },
		});
		const faustAxes = [...new Set(faust.map((r) => r.axisId))].sort().join(' · ');
		checks.push({
			name: '10208 검계 살수 파우스트 = BREATH · LACERATION',
			ok: faustAxes === 'BREATH · LACERATION',
			detail: faustAxes,
		});

		// 골든 — 착영휘도(20509)는 「검계 우두머리 뫼르소(10508) 전용 상시 효과」다.
		// app.axis_grant 가 대상을 그 인격 하나로 콕 집으므로(ADR-08), 축은 20509 를
		// 장착했을 때만 서는 조건부 행 하나씩으로 남는다
		const yisang = await prisma.identityAxis.findMany({
			where: { identityId: '10508', source: 'granted' },
			select: { axisId: true, gateKind: true, gateRef: true },
		});
		const yisangAxes = yisang.map((r) => `${r.axisId}:${r.gateKind}:${r.gateRef}`).sort().join(' · ');
		checks.push({
			name: '10508 뫼르소 + 착영휘도(20509) = BREATH · LACERATION (ego_equipped 게이트)',
			ok: yisangAxes === 'BREATH:ego_equipped:20509 · LACERATION:ego_equipped:20509',
			detail: yisangAxes,
		});

		// ── 파생 뷰 ─────────────────────────────────────────────────
		// **이 뷰가 「구조만으로 푼다」의 증거물이다.** 인격 성질을 trigger_ref 와
		// 같은 어휘로 정규화하므로 판정이 분기 없는 조인 하나가 된다
		const capKinds = await prisma.$queryRaw<Array<{ ref_kind: string; n: bigint }>>`
			SELECT ref_kind, count(*)::bigint AS n
			FROM canonical.v_identity_capability GROUP BY 1
		`;
		const wantKinds = ['association', 'attack_type', 'axis', 'coin',
			'resonance', 'sin', 'skill_kind', 'unit_keyword'];
		checks.push({
			name: 'v_identity_capability 종류 8갈래',
			ok: capKinds.map((r) => r.ref_kind).sort().join(',') === wantKinds.join(','),
			detail: capKinds.map((r) => `${r.ref_kind} ${Number(r.n)}`).sort().join(' · '),
		});

		// 어휘가 어긋나면 조인이 조용히 0을 낸다. **근거 없는 참조를 세어 고정한다** —
		// none 31(참조 대상 없음) + deployment 1(사용자 입력)
		// + Any/Any Absolute Resonance 2(죄악별 최댓값이라 이 조인으로는 안 닿는다)
		const unbacked = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.trigger_ref tr
			WHERE NOT EXISTS (SELECT 1 FROM canonical.v_identity_capability ic
			                  WHERE ic.ref_kind = tr.ref_kind AND ic.ref_id = tr.ref_id)
		`;
		checks.push({
			name: '편성으로 근거를 못 대는 trigger_ref 34 (150 중 116 이 닿는다)',
			ok: Number(unbacked[0]?.n ?? 0n) === 34,
			detail: `${Number(unbacked[0]?.n ?? 0n)} / 34`,
		});

		// ── 트리거 정량자 ───────────────────────────────────────────
		// 숫자는 어느 출처에도 구조화돼 있지 않다 — raw 를 전수로 확인했다.
		// `gift_stage_text.desc` 산문에서 적재 시점에 한 번 뽑아 굳힌 것이다
		// 188 + 49(kind='gate', 2026-08-11 게이트 판정 도입) = 237
		eq('gift_trigger_param', await prisma.giftTriggerParam.count(), 237);
		eq('gift_trigger_param (min_count)',
			await prisma.giftTriggerParam.count({ where: { kind: 'min_count' } }), 69);
		eq('gift_trigger_param (denominator)',
			await prisma.giftTriggerParam.count({ where: { kind: 'denominator' } }), 59);
		// gift_requirement.slots 60행을 Deployment Position 에 귄다. 실측 60/60 유일
		eq('gift_trigger_param (slot)',
			await prisma.giftTriggerParam.count({ where: { kind: 'slot' } }), 60);

		// ── 게이트 (2026-08-11) ────────────────────────────────────
		const gateGifts = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(DISTINCT gift_id)::bigint AS n
			FROM canonical.gift_trigger_param WHERE kind = 'gate'
		`;
		eq('게이트를 가진 기프트', Number(gateGifts[0]?.n ?? 0), 49);

		// 게이트는 언제나 같은 짝의 min_count 와 함께 온다 — 같은 문장에서 왔다
		const orphan = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n
			FROM canonical.gift_trigger_param g
			WHERE g.kind = 'gate' AND NOT EXISTS (
				SELECT 1 FROM canonical.gift_trigger_param m
				WHERE m.gift_id = g.gift_id AND m.trigger_id = g.trigger_id AND m.kind = 'min_count')
		`;
		checks.push({
			name: 'min_count 없는 게이트가 없다',
			ok: Number(orphan[0]?.n ?? 1) === 0,
			detail: `${orphan[0]?.n ?? 0} / 0`,
		});

		// **분모를 틀리면 전부 틀린다.** 49건이 출전(대기 인원 제외)이라 편성 12 로
		// 세면 과대 판정이 된다. waiting 1건은 9778 통상 작전용 장비뿐이다
		const denom = await prisma.giftTriggerParam.groupBy({
			by: ['value'], where: { kind: 'denominator' }, _count: { _all: true },
		});
		const dm = Object.fromEntries(denom.map((r) => [String(r.value), r._count._all]));
		checks.push({
			name: '분모 field 49 · roster 9 · waiting 1',
			ok: dm['field'] === 49 && dm['roster'] === 9 && dm['waiting'] === 1,
			detail: JSON.stringify(dm),
		});

		// 다단 임계 6건. tier 를 PK 에 안 넣으면 뒤엣단이 조용히 사라진다
		const tiered = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
				SELECT gift_id, trigger_id FROM canonical.gift_trigger_param
				WHERE kind = 'min_count' GROUP BY 1, 2 HAVING count(*) > 1
			) x
		`;
		checks.push({
			name: '다단 임계 6건 (9206·9211·9235·9270·9802·9803)',
			ok: Number(tiered[0]?.n ?? 0n) === 6,
			detail: `${Number(tiered[0]?.n ?? 0n)} / 6`,
		});

		// 골든 — 진혼(9088). 설계가 처음부터 예시로 든 기프트다
		const requiem = await prisma.giftTriggerParam.findMany({
			where: { giftId: '9088' }, select: { triggerId: true, kind: true, value: true },
		});
		const rq = requiem.map((r) => `${r.triggerId}|${r.kind}|${r.value}`).sort().join(' · ');
		// 9088 설명문 첫 문단이 「…5인 이상이면 … 발동」이라 게이트 정의(첫 문단 +
		// 「발동」)를 그대로 충족한다 — 2026-08-11 게이트 도입으로 gate 행이 붙었다
		checks.push({
			name: '9088 진혼 = 화상 5인 · 출전 분모 · 게이트',
			ok: rq === 'Allies have Burn Skill|denominator|field · Allies have Burn Skill|gate|5 · Allies have Burn Skill|min_count|5',
			detail: rq,
		});

		// min_count 는 반드시 그 트리거가 실제로 가리키는 것을 센다. 귀속이 어긋나면
		// 「화상 5인」이 소속 트리거에 붙는 식으로 조용히 틀린 답이 나온다
		const badAttr = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.gift_trigger_param p
			WHERE p.kind = 'min_count' AND NOT EXISTS (
				SELECT 1 FROM canonical.trigger_ref tr
				WHERE tr.trigger_id = p.trigger_id
				  AND tr.ref_kind IN ('axis', 'association', 'unit_keyword'))
		`;
		checks.push({
			name: 'min_count 가 축·소속·유닛 트리거에만 붙었다 (0이어야 한다)',
			ok: Number(badAttr[0]?.n ?? 1n) === 0,
			detail: `${Number(badAttr[0]?.n ?? 0n)} / 0`,
		});

		// ══ 거울 던전·인카운터 계열 ═════════════════════════════════
		eq('choice_event', await prisma.choiceEvent.count(), 159);
		eq('choice_option', await prisma.choiceOption.count(), 372);
		eq('choice_event_gift', await prisma.choiceEventGift.count(), 219);
		eq('achievement (마스터북 183)', await prisma.achievement.count(), 183);
		eq('reward', await prisma.reward.count(), 200);
		eq('adversity', await prisma.adversity.count(), 30);
		// **30 × 3언어.** 예전 30(en 만)은 거짓 결손이었다 — 역경 표시명이 상태이상 id
		// `MD6Limit1{층-11}{n}` · `MD7Limit1{층-11}1` 로 Mirror6·7 로케일에 있다
		eq('adversity_text', await prisma.adversityText.count(), 90);
		eq('grace', await prisma.grace.count(), 10);
		// 같은 이유로 은총도 3언어다 — `MirrorDungeonUI_5` 의 `..._title_{99+index}`
		eq('grace_text', await prisma.graceText.count(), 30);
		eq('start_gift', await prisma.startGift.count(), 30);

		eq('encounter', await prisma.encounter.count(), 251);
		// 초판은 최상위 targets 만 담아 398이었다. waves(26팩)·battles(16팩)·phases(2팩)를
		// 통째로 건너뛰어 보스 데이터가 있는 44팩이 한 줄도 없었다(설계 3.1). 실측 1,371 —
		// 감사 문서의 1,384 는 중첩 battle 계수 방식 차이였다(task-5-report.md).
		eq('encounter_target', await prisma.encounterTarget.count(), 1_371);
		// 초판(354)은 top 갈래에 딸린 부위만 셌다. 네 갈래를 다 펼치면 1,302다
		eq('encounter_target_part', await prisma.encounterTargetPart.count(), 1_302);
		// 부위 저항도 같은 이유로 3,540 이었다. **실측은 감사 문서의 추정(14,850)과도 다르다**
		// — 1,302부위 중 1,180부위 × 10축 = 11,800. 나머지 122부위는 원본에 `resists` 키
		// 자체가 없다(장식·비전투 부위로 보인다). 14,850 은 감사가 어림잡은 사전 추정치였다
		// (task-5-report.md 「수치가 다른 두 건의 해석」).
		eq('encounter_part_resist', await prisma.encounterPartResist.count(), 11_800);
		// loc Enemies*.json 이 적 행과 부위 행을 섞는데 초판이 무차별 적재해 1,342 였다.
		// 4·5자리(적)만 골라내면 870이다
		eq('enemy', await prisma.enemy.count(), 870);
		eq('enemy_text', await prisma.enemyText.count(), 2_610);
		// loc 의 6자리 부위 id 는 472종이지만, 그중 6종은 부모 적 id 가 loc 어디에도
		// 없는 고아다(부모 없이는 FK 를 못 세운다). 472 − 6 = 466 이 무결성을 지킨 값이고,
		// 고아 6건은 field_gap 의 enemy_part.enemy_id 로 기록된다(task-5-report.md)
		eq('enemy_part', await prisma.enemyPart.count(), 466);
		// 형제 텍스트 테이블(enemy_text 등)엔 다 있는 행 수 검사가 여기만 없었다.
		// 466부위 × 3로케일 = 1,398. 로케일 루프가 퇴화해도 enemy_part 466은 그대로
		// 통과해 아무것도 못 잡는다 — 이번 재설계가 고친 「행 수만 맞고 갈래가
		// 통째로 없던」 실패와 같은 모양이라 추가한다(최종 검토 Important 3)
		eq('enemy_part_text', await prisma.enemyPartText.count(), 1_398);

		// 팩 계열에서 미룬 연결이 이어졌다
		eq('pack_boss_encounter (팩 계열 이월)', await prisma.packBossEncounter.count(), 75);

		// 네 갈래가 각각 얼마나 담겼나. 한 갈래가 0이면 그 갈래를 다시 잃은 것이다
		const kindDist = await prisma.$queryRaw<Array<{ kind: string; n: bigint }>>`
			SELECT kind::text AS kind, count(*)::bigint AS n
			FROM canonical.encounter_target GROUP BY 1 ORDER BY 1
		`;
		const dist = Object.fromEntries(kindDist.map((r) => [r.kind, Number(r.n)]));
		checks.push({
			name: '타깃 kind 분포 (한 갈래도 0이면 안 된다)',
			ok: dist['top'] === 398 && dist['wave'] === 461 && dist['phase'] === 67 && dist['battle'] === 445,
			detail: `top ${dist['top']} · wave ${dist['wave']} · phase ${dist['phase']} · battle ${dist['battle']}`,
		});

		// **이 도메인의 소비자 요구다** — 「이 팩의 마지막 보스가 누구인가」에
		// 답할 수 있는 팩. 초판은 31이었다(설계 3.1)
		const bossPacks = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(DISTINCT b.pack_id)::bigint AS n
			FROM canonical.pack_boss_encounter b
			JOIN canonical.encounter_target t ON t.encounter_id = b.encounter_id
		`;
		checks.push({
			name: '보스 이름을 낼 수 있는 팩 (초판 31)',
			ok: Number(bossPacks[0]?.n ?? 0n) === 75,
			detail: `${Number(bossPacks[0]?.n ?? 0n)} / 75`,
		});

		// 부위는 id // 100 이 부모 적이다. 부모가 없는 부위가 있으면 분리가 틀렸다
		const orphanPart = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.enemy_part p
			WHERE NOT EXISTS (SELECT 1 FROM canonical.enemy e WHERE e.id = p.enemy_id)
		`;
		checks.push({
			name: '부모 없는 부위 (0이어야 한다)',
			ok: Number(orphanPart[0]?.n ?? 1n) === 0,
			detail: `${Number(orphanPart[0]?.n ?? 0n)} / 0`,
		});

		// 적 id 는 4·5자리, 부위 id 는 6자리다. 섞이면 분리가 안 된 것이다
		const badLen = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT (SELECT count(*) FROM canonical.enemy WHERE length(id) > 5)
			     + (SELECT count(*) FROM canonical.enemy_part WHERE length(id) <> 6) AS n
		`;
		checks.push({
			name: '적·부위 id 자릿수가 섞였다 (0이어야 한다)',
			ok: Number(badLen[0]?.n ?? 1n) === 0,
			detail: `${Number(badLen[0]?.n ?? 0n)} / 0`,
		});

		// 위키 「Possible Bosses」와 대조된 표본이다(docs/audit/wiki/06-encounter.md §2)
		const canto12 = await prisma.encounterTarget.findMany({
			where: { encounterId: 'md__canto-1-2', kind: 'battle', index: 0 },
			orderBy: { groupIndex: 'asc' },
			select: { name: true },
		});
		checks.push({
			name: 'md__canto-1-2 보스 후보 3종 (위키 Possible Bosses)',
			ok: canto12.map((r) => r.name).join(' · ')
				=== "Ebony Queen's Apple · Doomsday Calendar · Golden Apple",
			detail: canto12.map((r) => r.name).join(' · '),
		});

		// 봉봉 세 변형. 중복 행이 아니라 Swarm Movement Prep 1/2/3 이다(§6)
		const walpu8 = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.enemy_part
			WHERE id IN ('137001','137101','137201')
		`;
		checks.push({
			name: 'md__walpu-8 봉봉 부위 3종이 적 1370·1371·1372 로 갈린다',
			ok: Number(walpu8[0]?.n ?? 0n) === 3,
			detail: `${Number(walpu8[0]?.n ?? 0n)} / 3`,
		});

		// 위키에서 긁지 않기로 했다. 42팩이 결손으로 기록돼 있어야 한다(설계 6절)
		eq('보스 미확보 팩 결손 기록',
			await prisma.fieldGap.count({ where: { entity: 'encounter', field: 'bossPool' } }),
			42);

		// **적 저항은 10축이다** — 인격 3축 · E.G.O 7축과 다르다.
		// PK 는 (encounter_id, kind, group_index, target_index, part_id, axis) 다.
		// **kind·group_index 를 빼고 세면 다른 갈래의 같은 target_index·part_id 가
		// 한 그룹으로 섞여 거짓 위반이 35건 나온다**(4키 확장 전의 3키 질의가 남아 있었다).
		// 4키를 다 넣으면 위반이 0으로 떨어진다 — 실측 1,180부위 전부 정확히 10축이다.
		const badAxes = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT encounter_id, kind, group_index, target_index, part_id
			  FROM canonical.encounter_part_resist
			  GROUP BY 1,2,3,4,5 HAVING count(*) <> 10
			) x
		`;
		checks.push({
			name: '적 저항 10축이 아닌 부위 (0이어야 한다)',
			ok: Number(badAxes[0]?.n ?? 1n) === 0,
			detail: `${Number(badAxes[0]?.n ?? 0n)} / 0`,
		});

		// 설계 4절이 회귀 가드로 요구했는데 빠져 있던 셋(최종 검토 Minor 6). 값은
		// 실측으로 이미 맞았고, 여기서는 그 값을 지키는 가드만 추가한다.

		// 거울 던전 몫 — encounter_target 중 encounter_id 가 'md__'로 시작하는 것
		eq(
			'거울 던전 몫 (encounter_id LIKE md__%)',
			await prisma.encounterTarget.count({ where: { encounterId: { startsWith: 'md__' } } }),
			575,
		);

		// kind 교집합 — 한 인카운터가 top·wave·phase·battle 중 두 갈래를 동시에 쓰면
		// 배타성이 깨진 것이다(top 주석 「네 갈래가 배타적」 참고)
		const mixedKind = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT encounter_id FROM canonical.encounter_target
			  GROUP BY encounter_id HAVING count(DISTINCT kind) > 1
			) x
		`;
		checks.push({
			name: '한 인카운터가 두 갈래를 쓰는 경우 (0이어야 한다)',
			ok: Number(mixedKind[0]?.n ?? 1n) === 0,
			detail: `${Number(mixedKind[0]?.n ?? 0n)} / 0`,
		});

		// 보스 후보 총 — 팩마다 낼 수 있는 보스 후보 수를 다 더한 값. kind='battle'
		// 인 팩은 (encounter_id, group_index) 유일 조합 수(후보 슬롯 수)만큼, 그 밖의
		// 단일 보스 팩은 1씩 센다. 59팩(단일) + 16팩(복수, 합 41후보) = 100
		const bossCandidates = await prisma.$queryRaw<Array<{ n: bigint }>>`
			WITH pack_enc AS (
			  SELECT DISTINCT pack_id, encounter_id FROM canonical.pack_boss_encounter
			),
			kinds AS (
			  SELECT pe.pack_id, pe.encounter_id, et.kind,
			         count(DISTINCT et.group_index) AS n_groups
			  FROM pack_enc pe
			  JOIN canonical.encounter_target et ON et.encounter_id = pe.encounter_id
			  GROUP BY pe.pack_id, pe.encounter_id, et.kind
			)
			SELECT sum(CASE WHEN kind = 'battle' THEN n_groups ELSE 1 END)::bigint AS n
			FROM kinds
		`;
		checks.push({
			name: '보스 후보 총 (59팩 단일 + 16팩 복수 = 100)',
			ok: Number(bossCandidates[0]?.n ?? 0n) === 100,
			detail: `${Number(bossCandidates[0]?.n ?? 0n)} / 100`,
		});

		// 업적은 두 시즌 판본으로 갈린다. **번호는 원본 `__Season__` 이 정한다** —
		// 예전에는 md__* 를 0 으로 박아 넣었는데 원본이 "7" 이고 아이템명도 `Season 7 …` 이다
		const bySeason = await prisma.achievement.groupBy({ by: ['season'], _count: { _all: true } });
		const seasons = bySeason.map((r) => r.season).sort((a, b) => a - b);
		checks.push({
			name: '업적 시즌 판본 = 6 · 7 (0 이면 하드코딩 회귀)',
			ok: seasons.length === 2 && seasons[0] === 6 && seasons[1] === 7,
			detail: bySeason.map((r) => `${r.season}:${r._count._all}`).join(' '),
		});
		const rewardSeasons = await prisma.reward.groupBy({ by: ['season'], _count: { _all: true } });
		checks.push({
			name: '보상 트랙 시즌 = 6 · 7',
			ok: rewardSeasons.map((r) => r.season).sort((a, b) => a - b).join(',') === '6,7',
			detail: rewardSeasons.map((r) => `${r.season}:${r._count._all}`).join(' '),
		});

		// **JSON null 이 아니라 SQL NULL 이어야 한다.** 아카이브가 「없음」을 거짓말하면 안 된다
		const jsonNull = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.encounter
			WHERE waves = 'null'::jsonb OR phases = 'null'::jsonb OR battles = 'null'::jsonb
		`;
		checks.push({
			name: 'JSON null 로 들어간 행 (0이어야 한다)',
			ok: Number(jsonNull[0]?.n ?? 1n) === 0,
			detail: `${Number(jsonNull[0]?.n ?? 0n)} / 0`,
		});

		// 이름이 빈 적도 버리지 않는다. top 만 담던 초판은 1건(story__9-5-24)뿐이었다 —
		// 네 갈래를 다 펼치니 phase 갈래에서 reflectrial__9-5-2 가 하나 더 나와 2건이다
		eq(
			'이름 빈 적 결손 기록',
			await prisma.fieldGap.count({ where: { entity: 'encounter_target', field: 'name' } }),
			2,
		);

		// 계획 7 계열의 한국어 결손이 기록됐나.
		// **`grace` 20 · `adversity` 60 은 거짓 결손이라 0 이 됐다** — 원본에 3언어가 있다.
		// `achievement` · `reward` 는 진짜 결손이다(loc 파일 자체가 없다)
		for (const [entity, want] of [
			['achievement', 366],
			['grace', 0],
			['adversity', 0],
			['reward', 400],
		] as const) {
			eq(`${entity} 한국어·일본어 결손`, await prisma.fieldGap.count({ where: { entity } }), want);
		}

		// **전투 풀 2,525종은 여전히 못 잇는다** — backlog/10 이 살아 있다
		eq(
			'전투 풀 미해결이 기록됐다',
			await prisma.fieldGap.count({ where: { field: 'battlePool' } }),
			1,
		);

		// ══ 마스터북 완전 일치 쌍 — 나머지 3쌍 ══════════════════════
		// raw 를 직접 맞댄다. 이것이 깨지면 곧 회귀 신호다(마스터북 §4.1).

		// ⑤ E.G.O 스킬 — mj awakening+corrosion 208 ↔ canonical.ego_skill
		const egoSkillXref = await prisma.$queryRaw<Array<{ mj: bigint; diff: bigint }>>`
			WITH mj AS (
			  SELECT payload->>'awakeningSkill' AS id FROM raw.raw_object
			  WHERE src_path = 'egos/limbus-data-mj/egos_detail.json' AND payload->>'awakeningSkill' IS NOT NULL
			  UNION
			  SELECT payload->>'corrosionSkill' FROM raw.raw_object
			  WHERE src_path = 'egos/limbus-data-mj/egos_detail.json' AND payload->>'corrosionSkill' IS NOT NULL
			)
			SELECT (SELECT count(*) FROM mj)::bigint AS mj,
			       (SELECT count(*) FROM (SELECT id FROM mj EXCEPT SELECT id FROM canonical.ego_skill) x)::bigint AS diff
		`;
		const es = egoSkillXref[0];
		checks.push({
			name: 'E.G.O 스킬 mj 208 ↔ 적재 (차집합 0)',
			ok: Number(es?.mj ?? 0n) === 208 && Number(es?.diff ?? 1n) === 0,
			detail: `mj ${Number(es?.mj ?? 0n)} · 차집합 ${Number(es?.diff ?? 0n)}`,
		});

		// ⑥ E.G.O 패시브 — mj awakeningPassives 113 ↔ canonical.ego_passive
		const egoPassiveXref = await prisma.$queryRaw<Array<{ mj: bigint; diff: bigint }>>`
			WITH mj AS (
			  SELECT DISTINCT jsonb_array_elements_text(payload->'awakeningPassives') AS id
			  FROM raw.raw_object
			  WHERE src_path = 'egos/limbus-data-mj/egos_detail.json' AND payload ? 'awakeningPassives'
			)
			SELECT (SELECT count(*) FROM mj)::bigint AS mj,
			       (SELECT count(*) FROM (SELECT id FROM mj EXCEPT SELECT id FROM canonical.ego_passive) x)::bigint AS diff
		`;
		const ep = egoPassiveXref[0];
		checks.push({
			name: 'E.G.O 패시브 mj 113 ↔ 적재 (차집합 0)',
			ok: Number(ep?.mj ?? 0n) === 113 && Number(ep?.diff ?? 1n) === 0,
			detail: `mj ${Number(ep?.mj ?? 0n)} · 차집합 ${Number(ep?.diff ?? 0n)}`,
		});

		// ⑦ 시작 기프트 — assets startGiftPool 30 ↔ mj start_gifts 30
		const startGiftXref = await prisma.$queryRaw<Array<{ a: bigint; m: bigint; d1: bigint; d2: bigint }>>`
			WITH assets AS (
			  SELECT lower(k.key) AS kw, jsonb_array_elements_text(k.value) AS gift
			  FROM raw.raw_object o
			  CROSS JOIN LATERAL jsonb_each(o.payload->'startGiftPool') k
			  WHERE o.src_path = 'mirror-dungeon/limbus-assets/md__details.json'
			),
			mj AS (
			  SELECT lower(payload->>'keyword') AS kw,
			         jsonb_array_elements_text(payload->'gifts') AS gift
			  FROM raw.raw_object
			  WHERE src_path = 'gifts/limbus-data-mj/start_gifts.json'
			)
			SELECT (SELECT count(*) FROM assets)::bigint AS a,
			       (SELECT count(*) FROM mj)::bigint AS m,
			       (SELECT count(*) FROM (SELECT * FROM assets EXCEPT SELECT * FROM mj) x)::bigint AS d1,
			       (SELECT count(*) FROM (SELECT * FROM mj EXCEPT SELECT * FROM assets) y)::bigint AS d2
		`;
		const sg = startGiftXref[0];
		checks.push({
			name: '시작 기프트 assets ↔ mj 30/30 (차집합 0)',
			ok:
				Number(sg?.a ?? 0n) === 30 && Number(sg?.m ?? 0n) === 30 &&
				Number(sg?.d1 ?? 1n) === 0 && Number(sg?.d2 ?? 1n) === 0,
			detail: `assets ${Number(sg?.a ?? 0n)} · mj ${Number(sg?.m ?? 0n)} · 차집합 ${Number(sg?.d1 ?? 0n)}/${Number(sg?.d2 ?? 0n)}`,
		});

		// ④ 팩 ↔ 인카운터 — 행 수만 보던 것을 차집합 대조로 강화
		const bossXref = await prisma.$queryRaw<Array<{ raw: bigint; diff: bigint }>>`
			WITH src AS (
			  SELECT o.id AS pack_id,
			         replace(jsonb_array_elements_text(o.payload->'bossEncounters'), '|', '__') AS enc
			  FROM raw.raw_object o
			  WHERE o.src_path = 'packs/limbus-assets/md_theme_packs.json' AND o.payload ? 'bossEncounters'
			)
			SELECT (SELECT count(*) FROM src)::bigint AS raw,
			       (SELECT count(*) FROM (
			          SELECT pack_id, enc FROM src
			          EXCEPT SELECT pack_id, encounter_id FROM canonical.pack_boss_encounter
			        ) x)::bigint AS diff
		`;
		const bx = bossXref[0];
		checks.push({
			name: '팩 ↔ 인카운터 75/75 (차집합 0)',
			ok: Number(bx?.raw ?? 0n) === 75 && Number(bx?.diff ?? 1n) === 0,
			detail: `raw ${Number(bx?.raw ?? 0n)} · 차집합 ${Number(bx?.diff ?? 0n)}`,
		});

		// ══ app 층이 재생성에 살아남나 ══════════════════════════════
		const appTables = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM information_schema.tables WHERE table_schema = 'app'
		`;
		// 6 → 8 은 ref_exception · ego_granted_axis 다(ADR-08). 8 → 9 는 axis_grant 다
		// (Task 3, 저작 18행). 저작 사실이 app 으로 내려오면서 늘었다
		checks.push({
			name: 'app 스키마가 섰다',
			ok: Number(appTables[0]?.n ?? 0n) === 9,
			detail: `${Number(appTables[0]?.n ?? 0n)} / 9`,
		});

		// ══ 판 표식 — 이 판이 무엇에서 나왔나 (ADR-08) ═════════════
		eq('build_info 행 수', await prisma.buildInfo.count(), 1);

		const bi = await prisma.buildInfo.findFirst();
		checks.push({
			name: 'build_info 가 실재하는 스냅샷을 가리킨다',
			ok: bi !== null && (await prisma.snapshot.count({ where: { id: bi.snapshotId } })) === 1,
			detail: bi === null ? '없다' : bi.snapshotId,
		});
		// 더러운 트리로 구우면 「그 커밋으로 구웠다」가 거짓이 된다. 개발 중에는
		// 걸릴 수 있고, 그때가 바로 다시 구울 때다
		checks.push({
			name: 'build_info 의 커밋이 더럽지 않다',
			ok: bi !== null && !bi.codeCommit.endsWith('-dirty'),
			detail: bi === null ? '없다' : bi.codeCommit.slice(0, 20),
		});
		const liveRows = await liveRowCount(prisma, 'canonical');
		checks.push({
			name: 'build_info 의 행 수가 실제와 같다',
			ok: bi !== null && bi.rowCount === liveRows,
			detail: bi === null ? '없다' : `${bi.rowCount.toLocaleString()} / ${liveRows.toLocaleString()}`,
		});

		// ══ 출처 스냅샷 — M6 증분의 기준점 (ADR-08) ════════════════
		eq('field_source snapshot_id 결손', await prisma.fieldSource.count({ where: { snapshotId: '' } }), 0);

		const fsSnaps = await prisma.fieldSource.groupBy({
			by: ['snapshotId'], _count: { _all: true },
		});
		const knownSnaps = new Set(
			(await prisma.snapshot.findMany({ select: { id: true } })).map((s) => s.id),
		);
		checks.push({
			name: 'field_source 의 스냅샷이 전부 raw 에 있다',
			ok: fsSnaps.every((s) => knownSnaps.has(s.snapshotId)),
			detail: fsSnaps.map((s) => `${s.snapshotId} ${s._count._all.toLocaleString()}`).join(' · '),
		});
		// 지금은 한 판을 통째로 굽는다. M6 증분이 오면 이 검사가 깨지고, 깨지는
		// 것이 옳다 — 그때 「무엇이 갱신됐나」를 세는 검사로 바꾼다
		checks.push({
			name: 'field_source 가 아직 한 스냅샷에서만 왔다 (증분 전)',
			ok: fsSnaps.length === 1,
			detail: `${fsSnaps.length}종`,
		});

		// ══ 저작 사실 — app 에 산다 (ADR-08) ═══════════════════════
		eq('ref_exception (trigger)', await prisma.refException.count({ where: { kind: 'trigger' } }), 2);
		eq('ref_exception (token)', await prisma.refException.count({ where: { kind: 'token' } }), 1);
		eq('ego_granted_axis', await prisma.egoGrantedAxis.count(), 4);

		// 저작이 가리키는 대상이 실재하는가. 적재기가 굽기 전에도 보지만,
		// 살아있는 판에 대고도 물어야 한다 — 승격 뒤에 대상이 사라질 수 있다
		const authoredNow = await readAuthored(prisma);
		const knownNow: KnownIds = {
			axisIds: new Set((await prisma.axis.findMany({ select: { id: true } })).map((a) => a.id)),
			unitKeywordIds: new Set(
				(await prisma.identityUnitKeyword.findMany({ select: { keyword: true } })).map((k) => k.keyword),
			),
			associationIds: new Set(
				(await prisma.association.findMany({ select: { id: true } })).map((a) => a.id),
			),
		};
		const badNow = unknownRefs(authoredNow, knownNow);
		checks.push({
			name: '저작이 가리키는 대상이 전부 canonical 에 있다',
			ok: badNow.length === 0,
			detail: badNow.length === 0 ? '0건' : badNow.join(' · '),
		});

		// ══ 감사에서 찾은 것 — 회귀 검사 ═══════════════════════════
		// ① 흐트러짐 구간은 배열이다. 스칼라로 읽으면 184건이 통째로 사라진다
		const staggerTotal = await prisma.$queryRaw<Array<{ n: bigint; s: bigint }>>`
			SELECT count(*)::bigint AS n, sum(array_length(stagger, 1))::bigint AS s
			FROM canonical.identity WHERE array_length(stagger, 1) > 0
		`;
		checks.push({
			name: '흐트러짐 구간 184인격 · 값 421개',
			ok: Number(staggerTotal[0]?.n ?? 0n) === 184 && Number(staggerTotal[0]?.s ?? 0n) === 421,
			detail: `${Number(staggerTotal[0]?.n ?? 0n)}인격 · ${Number(staggerTotal[0]?.s ?? 0n)}구간`,
		});

		// ② passive.cost 는 비용이 아니라 발동 조건 코드 배열이다
		const condTotal = await prisma.$queryRaw<Array<{ n: bigint; s: bigint }>>`
			SELECT count(*)::bigint AS n, sum(array_length(conditions, 1))::bigint AS s
			FROM canonical.passive WHERE array_length(conditions, 1) > 0
		`;
		// 원본 604건이 배열이지만 그중 5건은 빈 배열이라 599 가 맞다
		checks.push({
			name: '패시브 발동 조건 599건 · 코드 599개',
			ok: Number(condTotal[0]?.n ?? 0n) === 599 && Number(condTotal[0]?.s ?? 0n) === 599,
			detail: `${Number(condTotal[0]?.n ?? 0n)}건 · ${Number(condTotal[0]?.s ?? 0n)}코드`,
		});

		// ③ illustId 는 숫자다. 문자열로 읽으면 null 이 된다
		eq('선택지 삽화 id', await prisma.choiceEvent.count({ where: { illustId: { not: null } } }), 1);

		// ④ 마크업이 desc 에 남으면 안 된다. 원문은 desc_raw 에 있다
		const markupLeft = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT (
			  (SELECT count(*) FROM canonical.skill_stage_text WHERE "desc" ~ '</?(style|color|noparse|link|sprite|mark|size)\M')
			+ (SELECT count(*) FROM canonical.gift_stage_text  WHERE "desc" ~ '</?(style|color|noparse|link|sprite|mark|size)\M')
			+ (SELECT count(*) FROM canonical.status_text      WHERE "desc" ~ '</?(style|color|noparse|link|sprite|mark|size)\M')
			+ (SELECT count(*) FROM canonical.passive_text     WHERE "desc" ~ '</?(style|color|noparse|link|sprite|mark|size)\M')
			+ (SELECT count(*) FROM canonical.ego_skill_stage_text WHERE "desc" ~ '</?(style|color|noparse|link|sprite|mark|size)\M')
			+ (SELECT count(*) FROM canonical.choice_event_text WHERE "desc" ~ '</?(style|color|noparse|link|sprite|mark|size)\M')
			)::bigint AS n
		`;
		checks.push({
			name: 'desc 에 남은 마크업 (0이어야 한다)',
			ok: Number(markupLeft[0]?.n ?? 1n) === 0,
			detail: `${Number(markupLeft[0]?.n ?? 0n)} / 0`,
		});

		// ⑤ **리터럴 꺾쇠는 지우면 안 된다.** <Bloodfiend> 는 게임 텍스트다.
		//
		// 기준이 41 에서 35 로 내려갔다. 회귀가 아니라 **지어낸 행이 사라진 것**이다 —
		// 슬롯 3 스킬 1051303 · 1051305 · 1100503 이 원본에서 동기화 3부터 시작하는데
		// 초판이 1·2 단계를 앞채우기로 만들어 넣었다(게임은 Tier III 에서 해금한다).
		// 3종 × 2단계 = 6행이 빠져 정확히 35 가 됐다. 로케일은 en 뿐이다 —
		// loc-ko·loc-ja 원본에는 이 리터럴이 0건이라 ko·ja 행이 세어지면 그게 폴백 누출이다
		const literal = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.skill_stage_text
			WHERE "desc" ~ '<Bloodfiend|<La |<Mechanical'
		`;
		checks.push({
			name: '리터럴 꺾쇠 보존 35건 (지우면 안 된다)',
			ok: Number(literal[0]?.n ?? 0n) === 35,
			detail: `${Number(literal[0]?.n ?? 0n)} / 35`,
		});

		// E.G.O 패시브 설명에 마크업이 있다 — ko 6 · ja 6 · en 3 (원본과 일치).
		// 반면 Egos*.json 에는 0건이라 ego_text.desc_raw 가 전량 null 인 것이 정상이다
		eq(
			'E.G.O 패시브 마크업 원문 보존',
			await prisma.egoPassiveText.count({ where: { descRaw: { not: null } } }),
			15,
		);
		eq(
			'E.G.O 설명에는 마크업이 없다 (desc_raw 전량 null)',
			await prisma.egoText.count({ where: { descRaw: { not: null } } }),
			0,
		);

		// ⑥ 마크업이 있던 것은 원문이 남아야 한다
		const rawKept = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT (
			  (SELECT count(*) FROM canonical.skill_stage_text WHERE desc_raw IS NOT NULL)
			+ (SELECT count(*) FROM canonical.gift_stage_text  WHERE desc_raw IS NOT NULL)
			+ (SELECT count(*) FROM canonical.status_text      WHERE desc_raw IS NOT NULL)
			+ (SELECT count(*) FROM canonical.passive_text     WHERE desc_raw IS NOT NULL)
			+ (SELECT count(*) FROM canonical.ego_skill_stage_text WHERE desc_raw IS NOT NULL)
			+ (SELECT count(*) FROM canonical.choice_event_text WHERE desc_raw IS NOT NULL)
			)::bigint AS n
		`;
		checks.push({
			name: '마크업 원문이 desc_raw 에 보존됐다',
			ok: Number(rawKept[0]?.n ?? 0n) > 4_000,
			detail: `${Number(rawKept[0]?.n ?? 0n)}건`,
		});

		// 모든 기프트가 최소 한 단계 텍스트를 갖는다
		const noText = await prisma.gift.count({ where: { stages: { none: { texts: { some: {} } } } } });
		checks.push({ name: '텍스트 없는 기프트 (0이어야 한다)', ok: noText === 0, detail: `${noText} / 0` });
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
