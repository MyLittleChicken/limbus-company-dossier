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
		// status.name.ja 258 · status.name.ko 245 · pack.textColor 61 · skill.levels 9
		// · passive.name 6 · gift.name.ko 6 · association.name.ja 2 · pack.unlockCode 2
// name 598 · text 478 · item 400 · textColor 61 · levels 9 · unlockCode 2 · battlePool 1
		// 수동 보정이 채운 만큼 줄어든다. 지금 1건 채워져 1,548 이다
		const gapTotal = await prisma.fieldGap.count();
		const overrideCount = await prisma.fieldOverride.count();
		checks.push({
			name: '결손 합계 (보정한 만큼 줄어든다)',
			ok: gapTotal + overrideCount === 1_549,
			detail: `결손 ${gapTotal.toLocaleString()} + 보정 ${overrideCount} = ${(gapTotal + overrideCount).toLocaleString()} / 1,549`,
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
		eq('trigger', await prisma.trigger.count(), 150);
		eq('effect', await prisma.effect.count(), 55);

		eq('gift', await prisma.gift.count(), 582);
		eq('gift (mirror_dungeon)', await prisma.gift.count({ where: { domain: 'mirror_dungeon' } }), 456);
		eq('gift (story_dungeon)', await prisma.gift.count({ where: { domain: 'story_dungeon' } }), 126);
		eq('gift_stage', await prisma.giftStage.count(), 799);
		eq('gift_stage_text', await prisma.giftStageText.count(), 2_391);
		eq('gift_effect', await prisma.giftEffect.count(), 1_122);
		eq('gift_trigger', await prisma.giftTrigger.count(), 1_081);
		eq('gift_pack', await prisma.giftPack.count(), 10_115);
		eq('gift_exclusive_pack', await prisma.giftExclusivePack.count(), 321);
		eq('gift_requirement', await prisma.giftRequirement.count(), 142);
		eq('fusion_recipe', await prisma.fusionRecipe.count(), 68);
		eq('fusion_slot', await prisma.fusionSlot.count(), 179);
		eq('fusion_slot_option', await prisma.fusionSlotOption.count(), 7);
		eq('gift_locked_desc', await prisma.giftLockedDesc.count(), 192);

		// hardOnly 는 합집합이어야 한다 — 백로그 08 이 여기서 해소된다
		eq('hardOnly true (합집합 122)', await prisma.gift.count({ where: { hardOnly: true } }), 122);

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
		eq('skill_stage', await prisma.skillStage.count(), 5_180);
		eq('skill_stage_text', await prisma.skillStageText.count(), 12_316);
		eq('skill_coin', await prisma.skillCoin.count(), 10_419);

		eq('passive', await prisma.passive.count(), 709);
		eq('passive_text', await prisma.passiveText.count(), 1_701);

		eq('identity', await prisma.identity.count(), 184);
		eq('identity_text', await prisma.identityText.count(), 552);
		eq('identity_resist', await prisma.identityResist.count(), 552);
		eq('identity_speed', await prisma.identitySpeed.count(), 184);
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

		// 단계가 있는 스킬은 전부 5단계다 — 전량 전개의 정의
		const badStage = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT skill_id FROM canonical.skill_stage GROUP BY skill_id HAVING count(*) <> 5
			) x
		`;
		checks.push({
			name: '5단계가 아닌 스킬 (0이어야 한다)',
			ok: Number(badStage[0]?.n ?? 1n) === 0,
			detail: `${Number(badStage[0]?.n ?? 0n)} / 0`,
		});

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
		eq('ego_skill', await prisma.egoSkill.count(), 215);
		eq('ego_skill_stage', await prisma.egoSkillStage.count(), 616);
		eq('ego_skill_stage_text', await prisma.egoSkillStageText.count(), 1_848);
		eq('ego_skill_coin', await prisma.egoSkillCoin.count(), 2_745);
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

		// **두 번째 각성 스킬** — mj 만으로는 못 얻는다
		const second = await prisma.egoSkill.findMany({
			where: { role: 'awakening', ordinal: { gt: 0 } },
			select: { id: true },
		});
		checks.push({
			name: '두 번째 각성 스킬 7건 (loc 단독)',
			ok:
				second.length === 7 &&
				second.map((s) => s.id).sort().join(',') ===
					'2010112,2030112,2050112,2060112,2060812,2110112,2120912',
			detail: second.map((s) => s.id).sort().join(' '),
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
		// 수동 보정이 결손을 채우면 행이 늘어난다. 보정 수를 빼고 본다
		const statusTextBase =
			(await prisma.statusText.count()) -
			(await prisma.fieldOverride.count({ where: { entity: 'status', field: 'name' } }));
		checks.push({
			name: 'status_text (보정 제외)',
			ok: statusTextBase === 3_913,
			detail: `${statusTextBase.toLocaleString()} / 3,913`,
		});
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

		// **한국어 결손 245종 (16.6 %)** — 마스터북 상태 편 회차 3 과 같다.
		// 보정으로 채운 만큼 줄어들므로 되더한다.
		const statusKoGap = await prisma.fieldGap.count({
			where: { entity: 'status', field: 'name', locale: 'ko' },
		});
		const statusKoFixed = await prisma.fieldOverride.count({
			where: { entity: 'status', field: 'name', locale: 'ko' },
		});
		checks.push({
			name: '한국어 결손 245종 (마스터북 일치, 보정 되더함)',
			ok: statusKoGap + statusKoFixed === 245,
			detail: `결손 ${statusKoGap} + 보정 ${statusKoFixed} = ${statusKoGap + statusKoFixed} / 245`,
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
			ok: tokenFk === tokenStatus && tokenFk === 14_389,
			detail: `${tokenFk} / ${tokenStatus} (14,389 기대)`,
		});

		// E.G.O·인격의 상태 연결이 100 % 걸렸다 — 결손이 0이어야 한다
		eq(
			'상태 연결 결손 (0이어야 한다)',
			await prisma.fieldGap.count({ where: { field: 'statuses' } }),
			0,
		);

		// ══ 거울 던전·인카운터 계열 ═════════════════════════════════
		eq('choice_event', await prisma.choiceEvent.count(), 159);
		eq('choice_option', await prisma.choiceOption.count(), 372);
		eq('choice_event_gift', await prisma.choiceEventGift.count(), 219);
		eq('achievement (마스터북 183)', await prisma.achievement.count(), 183);
		eq('reward', await prisma.reward.count(), 200);
		eq('adversity', await prisma.adversity.count(), 30);
		// 표시 문자열을 떼어냈다(ADR-03). 영문만 있고 ko·ja 는 결손으로 남는다
		eq('adversity_text', await prisma.adversityText.count(), 30);
		eq('grace', await prisma.grace.count(), 10);
		eq('start_gift', await prisma.startGift.count(), 30);

		eq('encounter', await prisma.encounter.count(), 251);
		eq('encounter_target', await prisma.encounterTarget.count(), 398);
		eq('encounter_target_part', await prisma.encounterTargetPart.count(), 354);
		eq('encounter_part_resist', await prisma.encounterPartResist.count(), 3_540);
		eq('enemy', await prisma.enemy.count(), 1_342);
		eq('enemy_text', await prisma.enemyText.count(), 4_026);

		// 팩 계열에서 미룬 연결이 이어졌다
		eq('pack_boss_encounter (팩 계열 이월)', await prisma.packBossEncounter.count(), 75);

		// **적 저항은 10축이다** — 인격 3축 · E.G.O 7축과 다르다
		const badAxes = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM (
			  SELECT encounter_id, target_index, part_id
			  FROM canonical.encounter_part_resist
			  GROUP BY 1,2,3 HAVING count(*) <> 10
			) x
		`;
		checks.push({
			name: '적 저항 10축이 아닌 부위 (0이어야 한다)',
			ok: Number(badAxes[0]?.n ?? 1n) === 0,
			detail: `${Number(badAxes[0]?.n ?? 0n)} / 0`,
		});

		// 업적은 두 시즌 판본으로 갈린다
		const bySeason = await prisma.achievement.groupBy({ by: ['season'], _count: { _all: true } });
		checks.push({
			name: '업적 시즌 판본 2종',
			ok: bySeason.length === 2,
			detail: bySeason.map((r) => `${r.season}:${r._count._all}`).join(' '),
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

		// 이름이 빈 적도 버리지 않는다 — 원본 398건이 그대로 들어와야 한다
		eq(
			'이름 빈 적 결손 기록',
			await prisma.fieldGap.count({ where: { entity: 'encounter_target', field: 'name' } }),
			1,
		);

		// 계획 7 계열의 한국어 결손이 기록됐나
		for (const [entity, want] of [
			['achievement', 366],
			['grace', 20],
			['adversity', 60],
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
		checks.push({
			name: 'app 스키마가 섰다',
			ok: Number(appTables[0]?.n ?? 0n) === 6,
			detail: `${Number(appTables[0]?.n ?? 0n)} / 6`,
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
