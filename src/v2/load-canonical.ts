/**
 * canonical 층 적재기.
 *
 * **파일을 읽지 않는다.** raw.raw_object 를 질의해 만든다(스펙 2.1).
 * 재적재는 canonical 만 비운다 — raw 도 app 도 건드리지 않는다.
 *
 * 실행: npm run v2:canonical
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from './generated/client.js';
import { latestSnapshotId, mergeIndexes, readSource, readSourceGroup } from './source.js';
import { Meta } from './canonical/meta.js';
import { buildPacks, type FloorTable } from './canonical/packs.js';
import { buildVocab, buildKeywordLookup } from './canonical/vocab.js';
import { buildGifts } from './canonical/gifts.js';
import { buildSinners } from './canonical/sinners.js';
import { buildSkills } from './canonical/skills.js';
import { buildIdentities } from './canonical/identities.js';
import { buildEgos } from './canonical/egos.js';
import { buildStatuses } from './canonical/statuses.js';
import { buildAxis } from './canonical/axis.js';
import { buildIdentityAxis } from './canonical/identity-axis.js';
import { buildGiftTriggerParam } from './canonical/gift-trigger-param.js';
import { parseCoinTokens } from './canonical/tokens.js';
import { buildMirror } from './canonical/mirror.js';
import { buildEncounters } from './canonical/encounters.js';
import { applyTextOverrides, applyColumnOverrides, type OverrideRow } from './canonical/override.js';
import { readAuthored, unknownRefs, authoredDigest, type KnownIds } from './authored.js';
import { emptyRequiredMessage, hasAnyRow, liveRowCount } from './schema-ops.js';

const CHUNK = 1_000;

async function chunked<T>(
	rows: T[],
	insert: (part: T[]) => Promise<{ count: number }>,
): Promise<number> {
	let n = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const r = await insert(rows.slice(i, i + CHUNK));
		n += r.count;
	}
	return n;
}

/**
 * 굽는 시점의 코드 판. **더러운 작업트리면 `-dirty` 를 붙인다** — 커밋만 적으면
 * 「그 커밋으로 구웠다」가 거짓이 된다. 재현 검사가 그 거짓 위에서 판정한다.
 */
function codeCommit(): string {
	const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
	return dirty === '' ? head : `${head}-dirty`;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		// **살아있는 canonical 을 지우지 않기 위한 가드다**(설계 결정 4).
		// 적재기는 빈 canonical 에만 굽는다. v2:build 가 먼저 옆으로 치워 준다.
		//
		// 테이블 존재가 아니라 **행 존재**로 판정한다. v2:build 3단계(DDL) 직후는
		// canonical 이 테이블 94개·행 0개다 — 테이블 개수로 재면 그 순간에도
		// "안 비었다"고 걸려 v2:build 자체가 못 돈다. 살아있는 판은 테이블 94개·행
		// 152,399개이므로 행 기준이라야 갓 구운 빈 판과 살아있는 판이 갈린다.
		// 환경변수 같은 우회로는 없다 — 조건 자체를 맞게 고쳤으니 우회가 필요 없다.
		if (await hasAnyRow(prisma, 'canonical')) throw new Error(emptyRequiredMessage());

		const snapshotId = await latestSnapshotId(prisma);
		console.log(`스냅샷 ${snapshotId} 를 읽는다`);

		const meta = new Meta();

		// md_floor_packs.json 은 {hard: {...}, normal: {...}} 이고 값이 전부 객체라
		// 스캔 규칙상 map 으로 분류된다 — 즉 id 가 'hard' · 'normal' 인 두 행이다.
		const floorRaw = await readSource(
			prisma,
			snapshotId,
			'mirror-dungeon/limbus-assets/md_floor_packs.json',
		);
		const floorTable: FloorTable = {};
		for (const [difficulty, ranges] of floorRaw) {
			floorTable[difficulty] = ranges as Record<string, string[]>;
		}

		const tables = buildPacks(
			{
				mjPacks: await readSource(prisma, snapshotId, 'packs/limbus-data-mj/packs.json'),
				mjDetail: await readSource(prisma, snapshotId, 'packs/limbus-data-mj/packs_detail.json'),
				assets: await readSource(prisma, snapshotId, 'packs/limbus-assets/md_theme_packs.json'),
				floorTable,
				locKo: await readSource(prisma, snapshotId, 'packs/loc-ko/MirrorDungeonTheme-1.json'),
				locEn: await readSource(prisma, snapshotId, 'packs/loc-en/MirrorDungeonTheme-1.json'),
				locJa: await readSource(prisma, snapshotId, 'packs/loc-ja/MirrorDungeonTheme-1.json'),
			},
			meta,
		);

		// ── 기프트 계열 ──────────────────────────────────────────────
		// 로케일 기프트는 30파일로 흩어져 있다. 성격이 다른 두 파일은 뺀다.
		const EXCLUDE = ['EgoGiftCategory.json', 'MirrorDungeonEgoGiftLockedDesc.json'];
		const locGift = async (locale: string) =>
			readSourceGroup(prisma, snapshotId, 'gifts', `loc-${locale}`, EXCLUDE);
		const catOf = async (locale: string) =>
			readSource(prisma, snapshotId, `gifts/loc-${locale}/EgoGiftCategory.json`);
		const lockedOf = async (locale: string) =>
			readSource(prisma, snapshotId, `gifts/loc-${locale}/MirrorDungeonEgoGiftLockedDesc.json`);

		const assetGifts = await readSource(prisma, snapshotId, 'gifts/limbus-assets/gifts.json');
		const categoryKo = await catOf('ko');
		const categoryEn = await catOf('en');
		const categoryJa = await catOf('ja');

		const vocab = buildVocab({ categoryKo, categoryEn, categoryJa, assets: assetGifts }, meta);

		const gifts = buildGifts(
			{
				mj: await readSource(prisma, snapshotId, 'gifts/limbus-data-mj/gifts.json'),
				mjDetail: await readSource(prisma, snapshotId, 'gifts/limbus-data-mj/gifts_detail.json'),
				assets: assetGifts,
				locKo: await locGift('ko'),
				locEn: await locGift('en'),
				locJa: await locGift('ja'),
				lockedKo: await lockedOf('ko'),
				lockedEn: await lockedOf('en'),
				lockedJa: await lockedOf('ja'),
				keywordDict: buildKeywordLookup(categoryEn),
				knownPacks: new Set(tables.pack.map((p) => p.id)),
			},
			meta,
		);

		// ── 상태·어휘 계열 ─────────────────────────────────────────
		// 인격·E.G.O 보다 먼저 만든다 — 둘이 상태로 외래 키를 건다.
		const mech = (locale: string, prefix: string) =>
			readSourceGroup(prisma, snapshotId, 'mechanics', `loc-${locale}`, { startsWith: [prefix] });
		// **거울 던전 상태의 로케일은 mechanics 가 아니라 mirror-dungeon 에 있다.**
		// BattleKeywords 를 먼저, Bufs 를 뒤에 합쳐 Bufs 가 이기게 한다(mechanics 와 같은 우선순위).
		const mdLoc = async (locale: string) =>
			mergeIndexes([
				await readSourceGroup(prisma, snapshotId, 'mirror-dungeon', `loc-${locale}`, {
					startsWith: ['BattleKeywords_Mirror'],
				}),
				await readSourceGroup(prisma, snapshotId, 'mirror-dungeon', `loc-${locale}`, {
					startsWith: ['Bufs_Mirror'],
				}),
			]);

		const statuses = buildStatuses(
			{
				assets: await readSource(prisma, snapshotId, 'mechanics/limbus-assets/statuses.json'),
				bufsKo: await mech('ko', 'Bufs'),
				bufsEn: await mech('en', 'Bufs'),
				bufsJa: await mech('ja', 'Bufs'),
				bkKo: await mech('ko', 'BattleKeywords'),
				bkEn: await mech('en', 'BattleKeywords'),
				bkJa: await mech('ja', 'BattleKeywords'),
				mirrorKo: await mdLoc('ko'),
				mirrorEn: await mdLoc('en'),
				mirrorJa: await mdLoc('ja'),
				terms: await readSource(prisma, snapshotId, 'mechanics/limbus-data-mj/terms.json'),
				sins: await readSource(prisma, snapshotId, 'mechanics/limbus-data-mj/sins.json'),
			},
			meta,
		);
		const knownStatuses = new Set(statuses.status.map((x) => x.id));

		// ── 인격 계열 ──────────────────────────────────────────────
		const idKo = await readSourceGroup(prisma, snapshotId, 'identities', 'loc-ko');
		const idEn = await readSourceGroup(prisma, snapshotId, 'identities', 'loc-en');
		const idJa = await readSourceGroup(prisma, snapshotId, 'identities', 'loc-ja');

		// **스킬과 패시브는 파일로 갈라야 한다.** 인격도 E.G.O 와 같은 번호 공간
		// 충돌을 갖는다 — 1010101 이 스킬(쳐내기)이자 패시브(정보전달)다. 실측 289건.
		// 합쳐 읽으면 Passives.json 이 이겨 코인 문장이 통째로 사라진다.
		const idLoc = (locale: string, prefix: string) =>
			readSourceGroup(prisma, snapshotId, 'identities', `loc-${locale}`, { startsWith: [prefix] });

		// 인격 하나가 파일 하나다(184). 스킬 단계 수치와 패시브 발동 조건은 여기에만 있다
		const identityDetails = await readSourceGroup(
			prisma,
			snapshotId,
			'identity-details',
			'limbus-assets',
		);

		const mjIdentities = await readSource(prisma, snapshotId, 'identities/limbus-data-mj/identities.json');
		const mjIdentityDetail = await readSource(
			prisma,
			snapshotId,
			'identities/limbus-data-mj/identities_detail.json',
		);
		const sinners = buildSinners(
			{
				mjIdentities,
				associations: await readSource(prisma, snapshotId, 'identities/limbus-data-mj/associations.json'),
				unitKeywordJa: idJa,
			},
			meta,
		);

		const skills = buildSkills(
			{
				mjSkills: await readSource(prisma, snapshotId, 'identities/limbus-data-mj/skills.json'),
				details: identityDetails,
				mjIdentityDetail,
				locKo: await idLoc('ko', 'Skills'),
				locEn: await idLoc('en', 'Skills'),
				locJa: await idLoc('ja', 'Skills'),
			},
			meta,
		);

		const mjPassives = await readSource(prisma, snapshotId, 'identities/limbus-data-mj/passives.json');
		const identities = buildIdentities(
			{
				mj: mjIdentities,
				mjDetail: mjIdentityDetail,
				assets: await readSource(prisma, snapshotId, 'identities/limbus-assets/identities.json'),
				details: identityDetails,
				mjPassives,
				locKo: idKo,
				locEn: idEn,
				locJa: idJa,
				passiveKo: await idLoc('ko', 'Passive'),
				passiveEn: await idLoc('en', 'Passive'),
				passiveJa: await idLoc('ja', 'Passive'),
				knownSkills: new Set(skills.skill.map((s) => s.id)),
				knownAssociations: new Set(sinners.association.map((a) => a.id)),
				knownKeywords: new Set(vocab.keyword.map((k) => k.id)),
				keywordDict: buildKeywordLookup(categoryEn),
				knownStatuses,
			},
			meta,
		);

		// 저작 사실. **app 에 산다**(ADR-08) — 승격이 canonical 을 통째로 갈아
		// 치우므로 재빌드의 입력은 그 밖에 있어야 한다
		const authored = await readAuthored(prisma);
		const { refException, egoGranted } = authored;

		// ── 축 어휘와 트리거·효과 참조 ─────────────────────────────
		// 이름 유도를 여기서 한 번 풀어 굳힌다 — 질의마다 다시 하면 오매칭이 되살아난다.
		// vocab·statuses·sinners·identities 가 모두 만들어진 뒤여야 한다.
		const axisTables = buildAxis({
			statusCategory: statuses.statusCategory.map((s) => ({ statusId: s.statusId, category: s.category })),
			statusTextEn: statuses.statusText
				.filter((s) => s.locale === 'en')
				.map((s) => ({ statusId: s.statusId, name: s.name })),
			associationTextEn: sinners.associationText
				.filter((a) => a.locale === 'en')
				.map((a) => ({ associationId: a.associationId, name: a.name })),
			triggerIds: vocab.trigger.map((t) => t.id),
			effectIds: vocab.effect.map((e) => e.id),
			sinIds: ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'],
			refException,
		}, meta);

		// ── E.G.O 계열 ─────────────────────────────────────────────
		// **파일명으로 가른다.** E.G.O 는 각성 스킬과 패시브가 같은 번호를 쓴다
		// (실측 교집합 110건) — id 자릿수로 가르면 한쪽이 다른 쪽을 덮어쓴다.
		const egoLoc = (locale: string, prefix: string) =>
			readSourceGroup(prisma, snapshotId, 'egos', `loc-${locale}`, { startsWith: [prefix] });

		const egos = buildEgos(
			{
				mj: await readSource(prisma, snapshotId, 'egos/limbus-data-mj/egos.json'),
				mjDetail: await readSource(prisma, snapshotId, 'egos/limbus-data-mj/egos_detail.json'),
				assets: await readSource(prisma, snapshotId, 'egos/limbus-assets/egos.json'),
				// E.G.O 하나가 한 파일이다(110). 스킬 id 집합과 단계별 수치는 여기에만 있다
				details: await readSourceGroup(prisma, snapshotId, 'ego-details', 'limbus-assets'),
				locEgoKo: await egoLoc('ko', 'Egos'),
				locEgoEn: await egoLoc('en', 'Egos'),
				locEgoJa: await egoLoc('ja', 'Egos'),
				locSkillKo: await egoLoc('ko', 'Skills_Ego'),
				locSkillEn: await egoLoc('en', 'Skills_Ego'),
				locSkillJa: await egoLoc('ja', 'Skills_Ego'),
				locPassiveKo: await egoLoc('ko', 'Passive_Ego'),
				locPassiveEn: await egoLoc('en', 'Passive_Ego'),
				locPassiveJa: await egoLoc('ja', 'Passive_Ego'),
				knownSinners: new Set(sinners.sinner.map((s) => s.id)),
				knownStatuses,
			},
			meta,
		);

		// 저작이 가리키는 대상이 실재하는가. **굽기 전에 멈춘다** — 못 닿는 참조를
		// 안고 구우면 조용히 빈 축이 나오고, 그건 검사 203건이 못 잡는 자리다.
		// axisTables 뒤여야 axis_id 를 알 수 있다
		const known: KnownIds = {
			axisIds: new Set(axisTables.axis.map((a) => a.id)),
			unitKeywordIds: new Set(identities.identityUnitKeyword.map((k) => k.keyword)),
			associationIds: new Set(sinners.association.map((a) => a.id)),
		};
		const badRefs = unknownRefs(authored, known);
		if (badRefs.length > 0) {
			console.error('저작이 가리키는 대상이 canonical 에 없다. 굽지 않는다.');
			for (const line of badRefs) console.error(`  ${line}`);
			console.error('');
			console.error('  app.ref_exception · app.ego_granted_axis 를 고치거나,');
			console.error('  가리키는 대상이 원본에 생겼는지 확인한다.');
			throw new Error(`저작 참조 ${badRefs.length}건이 못 닿는다`);
		}

		// 인격 축 프로파일. **egos 뒤여야 한다** — ego_granted 경로가 E.G.O 의
		// 수감자를 보고 장착 후보 인격을 편다
		const identityAxis = buildIdentityAxis({
			identityKeyword: identities.identityKeyword.map((k) => ({ identityId: k.identityId, keywordId: k.keywordId })),
			identityStatus: identities.identityStatus,
			statusCategory: statuses.statusCategory.map((s) => ({ statusId: s.statusId, category: s.category })),
			axisIds: axisTables.axis.map((a) => a.id),
			identity: identities.identity.map((i) => ({ id: i.id, sinnerId: i.sinnerId })),
			ego: egos.ego.map((e) => ({ id: e.id, sinnerId: e.sinnerId })),
			egoGranted,
		}, meta);

		// 트리거 정량자. **level 0 만 본다** — 강화 단계는 조건 문장이 같아 중복이다.
		// 산문을 여기서 한 번 뽑아 구조로 굳힌다. 질의 시점에 desc 를 다시 읽지 않는다
		const giftTriggerParam = buildGiftTriggerParam({
			giftDesc: gifts.giftStageText
				.filter((t) => t.locale === 'ko' && t.level === 0 && t.desc !== null)
				.map((t) => ({ giftId: t.giftId, desc: t.desc as string })),
			giftTrigger: gifts.giftTrigger.map((t) => ({ giftId: t.giftId, triggerId: t.triggerId })),
			triggerRef: axisTables.triggerRef.map((r) => ({
				triggerId: r.triggerId, refKind: r.refKind, refId: r.refId, evaluability: r.evaluability,
			})),
			associationKo: sinners.associationText
				.filter((a) => a.locale === 'ko')
				.map((a) => ({ associationId: a.associationId, name: a.name })),
			giftSlots: gifts.giftRequirement
				.filter((r) => r.kind === 'slots')
				.map((r) => ({ giftId: r.giftId, slots: (r.value as number[]) ?? [] })),
			axisIds: axisTables.axis.map((a) => a.id),
			refException,
		}, meta);

		// ── 거울 던전 구성 ─────────────────────────────────────────
		const mdAsset = (f: string) =>
			readSource(prisma, snapshotId, `mirror-dungeon/limbus-assets/${f}`);
		const evLoc = (locale: string) =>
			readSourceGroup(prisma, snapshotId, 'mirror-dungeon', `loc-${locale}`, {
				startsWith: ['ActionEvents_Mirror', 'AbEvents_Mirror'],
			});
		// 은총 표시명 — `MirrorDungeonUI_5.json` 이 3언어를 갖는다(감사 6.1)
		const graceLoc = (locale: string) =>
			readSource(prisma, snapshotId, `mirror-dungeon/loc-${locale}/MirrorDungeonUI_5.json`);
		// 역경 표시명 — 상태이상 id 로 Mirror6·7 로케일에 있다(감사 6.2).
		// **BattleKeywords 를 뒤에 둬 이기게 한다** — MD7Limit141 의 영문이 Bufs 는
		// 「Inflict Status Effect」, BattleKeywords 는 「Status Infliction」이고
		// `md__details` 가 후자와 같다. 영문 대조 30/30 이 성립하는 쪽이다.
		const advLoc = async (locale: string) =>
			mergeIndexes([
				await readSourceGroup(prisma, snapshotId, 'mirror-dungeon', `loc-${locale}`, {
					startsWith: ['Bufs_Mirror6', 'Bufs_Mirror7'],
				}),
				await readSourceGroup(prisma, snapshotId, 'mirror-dungeon', `loc-${locale}`, {
					startsWith: ['BattleKeywords_Mirror6', 'BattleKeywords_Mirror7'],
				}),
			]);
		const knownGifts = new Set(gifts.gift.map((g) => g.id));
		const mirror = buildMirror(
			{
				choiceEvents: await mdAsset('md_choice_events.json'),
				achievements: await mdAsset('md__achievements.json'),
				achievementsMd6: await mdAsset('md__md6__achievements.json'),
				rewards: await mdAsset('md__rewards.json'),
				rewardsMd6: await mdAsset('md__md6__rewards.json'),
				details: await mdAsset('md__details.json'),
				eventLocKo: await evLoc('ko'),
				eventLocEn: await evLoc('en'),
				eventLocJa: await evLoc('ja'),
				graceLocKo: await graceLoc('ko'),
				graceLocEn: await graceLoc('en'),
				graceLocJa: await graceLoc('ja'),
				adversityLocKo: await advLoc('ko'),
				adversityLocEn: await advLoc('en'),
				adversityLocJa: await advLoc('ja'),
				knownGifts,
				knownKeywords: new Set(vocab.keyword.map((k) => k.id)),
				keywordDict: buildKeywordLookup(categoryEn),
			},
			meta,
		);

		// ── 인카운터 ───────────────────────────────────────────────
		const enemyLocOf = (locale: string) =>
			readSourceGroup(prisma, snapshotId, 'encounters', `loc-${locale}`);
		const encounters = buildEncounters(
			{
				encounters: await readSourceGroup(prisma, snapshotId, 'encounters', 'limbus-assets'),
				groups: await mdAsset('encounters.json'),
				enemyKo: await enemyLocOf('ko'),
				enemyEn: await enemyLocOf('en'),
				enemyJa: await enemyLocOf('ja'),
				knownPacks: new Set(tables.pack.map((p) => p.id)),
				packs: await readSource(prisma, snapshotId, 'packs/limbus-assets/md_theme_packs.json'),
			},
			meta,
		);

		// ── 코인 토큰 분해 — 스펙 6절 「그래프 파생을 위한 조건」 ────────
		// 원문은 skill_coin.effects 에 그대로 남는다. 이것은 분해 결과다.
		const coinToken: Array<{
			skillId: string; uptie: number; coinIdx: number; ordinal: number;
			token: string; kind: string; amount: number | null; statusId: string | null;
		}> = [];
		// **영문 코인만 분해한다.** skill_coin 이 로케일 축을 얻어 같은 코인이 3행이
		// 됐지만 coin_token 의 키에는 로케일이 없다. 토큰은 어느 로케일이든 같은
		// 영문 대괄호이므로 en 한 벌만 읽으면 된다.
		for (const coin of skills.skillCoin.filter((c) => c.locale === 'en')) {
			let ordinal = 0;
			for (const effect of coin.effects) {
				for (const parsed of parseCoinTokens(effect)) {
					const isStatus = knownStatuses.has(parsed.token);
					coinToken.push({
						skillId: coin.skillId,
						uptie: coin.uptie,
						coinIdx: coin.index,
						ordinal,
						token: parsed.token,
						kind: isStatus ? 'status' : 'timing',
						amount: parsed.amount,
						statusId: isStatus ? parsed.token : null,
					});
					ordinal += 1;
				}
			}
		}

		// ── 수동 보정 — 적재의 마지막 판정 ─────────────────────────
		// app.field_override 는 TRUNCATE 범위 밖이라 재적재에 살아남는다.
		// 여기서 canonical 위에 덮고 field_source.rule = 'manual' 로 남긴다.
		const overrides: OverrideRow[] = (
			await prisma.fieldOverride.findMany({
				select: { entity: true, entityId: true, field: true, locale: true, value: true, note: true },
			})
		).map((o) => ({ ...o, value: o.value as unknown }));
		if (overrides.length > 0) console.log(`수동 보정 ${overrides.length}건을 덮는다`);

		statuses.statusText = applyTextOverrides(
			statuses.statusText, overrides,
			{ entity: 'status', idKey: 'statusId', field: 'name' }, meta,
		);
		gifts.giftStageText = applyTextOverrides(
			gifts.giftStageText, overrides,
			{ entity: 'gift', idKey: 'giftId', field: 'name' }, meta,
		);
		tables.packText = applyTextOverrides(
			tables.packText, overrides,
			{ entity: 'pack', idKey: 'packId', field: 'name' }, meta,
		);
		encounters.enemyText = applyTextOverrides(
			encounters.enemyText, overrides,
			{ entity: 'enemy', idKey: 'enemyId', field: 'name' }, meta,
		);
		tables.pack = applyColumnOverrides(
			tables.pack, overrides, { entity: 'pack', idKey: 'id' }, meta,
		);
		// 기프트 hardOnly — 두 출처의 합집합 122 도 assets 단독 116 도 틀렸다.
		// 위키 테마팩의 normal= 로 5건이 갈려 정답은 117 이다(docs/audit/wiki/03-gift.md §2).
		// 변환기에 예외 표를 박지 않고 보정으로 둔다 — 재적재에 살아남고 근거가 note 에 남는다.
		// `fields` 로 좁히지 않으면 위의 gift.name 텍스트 보정이 여기로 새어 들어온다.
		gifts.gift = applyColumnOverrides(
			gifts.gift, overrides, { entity: 'gift', idKey: 'id', fields: ['hardOnly'] }, meta,
		);

		// canonical 만 비운다. **raw 도 app 도 건드리지 않는다.**
		await prisma.$executeRaw`
			TRUNCATE canonical.pack, canonical.gift, canonical.keyword, canonical.trigger,
			         canonical.effect, canonical.sinner, canonical.association,
			         canonical.skill, canonical.passive, canonical.identity,
			         canonical.ego, canonical.ego_passive,
			         canonical.status, canonical.sin_info, canonical.term,
			         canonical.choice_event, canonical.achievement, canonical.reward,
			         canonical.adversity, canonical.grace, canonical.encounter, canonical.enemy,
			         canonical.enemy_part,
			         canonical.axis, canonical.identity_axis, canonical.trigger_ref,
			         canonical.effect_ref, canonical.gift_trigger_param,
			         canonical.field_gap, canonical.field_source,
			         canonical.tool_annotation CASCADE
		`;

		const counts: Array<[string, number]> = [];
		counts.push(['pack', (await prisma.pack.createMany({ data: tables.pack as never })).count]);
		counts.push([
			'pack_text',
			await chunked(tables.packText, (d) => prisma.packText.createMany({ data: d as never })),
		]);
		counts.push([
			'pack_tag',
			await chunked(tables.packTag, (d) => prisma.packTag.createMany({ data: d })),
		]);
		counts.push([
			'pack_category_path',
			await chunked(tables.packCategoryPath, (d) =>
				prisma.packCategoryPath.createMany({ data: d }),
			),
		]);
		counts.push([
			'floor_pack',
			await chunked(tables.floorPack, (d) => prisma.floorPack.createMany({ data: d as never })),
		]);
		// 어휘 차원이 기프트보다 먼저 서야 외래 키가 선다.
		counts.push(['keyword', (await prisma.keyword.createMany({ data: vocab.keyword })).count]);
		counts.push([
			'keyword_text',
			await chunked(vocab.keywordText, (d) => prisma.keywordText.createMany({ data: d as never })),
		]);
		counts.push(['trigger', (await prisma.trigger.createMany({ data: vocab.trigger })).count]);
		counts.push(['effect', (await prisma.effect.createMany({ data: vocab.effect })).count]);

		// 축 어휘와 트리거·효과 참조. trigger·effect 다음이어야 FK 가 안 깨진다.
		// identity_axis 는 identity 가 서야 하므로 뒤에서 적재한다(축이 먼저).
		counts.push(['axis', (await prisma.axis.createMany({ data: axisTables.axis })).count]);
		counts.push(['trigger_ref', await chunked(axisTables.triggerRef, (d) => prisma.triggerRef.createMany({ data: d }))]);
		counts.push(['effect_ref', await chunked(axisTables.effectRef, (d) => prisma.effectRef.createMany({ data: d }))]);

		counts.push([
			'gift',
			await chunked(gifts.gift, (d) => prisma.gift.createMany({ data: d as never })),
		]);
		counts.push([
			'gift_stage',
			await chunked(gifts.giftStage, (d) => prisma.giftStage.createMany({ data: d })),
		]);
		counts.push([
			'gift_stage_text',
			await chunked(gifts.giftStageText, (d) =>
				prisma.giftStageText.createMany({ data: d as never }),
			),
		]);
		counts.push([
			'gift_effect',
			await chunked(gifts.giftEffect, (d) => prisma.giftEffect.createMany({ data: d })),
		]);
		counts.push([
			'gift_trigger',
			await chunked(gifts.giftTrigger, (d) => prisma.giftTrigger.createMany({ data: d })),
		]);
		counts.push([
			'gift_pack',
			await chunked(gifts.giftPack, (d) => prisma.giftPack.createMany({ data: d })),
		]);
		counts.push([
			'gift_exclusive_pack',
			await chunked(gifts.giftExclusivePack, (d) =>
				prisma.giftExclusivePack.createMany({ data: d }),
			),
		]);
		counts.push([
			'gift_requirement',
			await chunked(gifts.giftRequirement, (d) =>
				prisma.giftRequirement.createMany({ data: d as never }),
			),
		]);
		// gift_trigger_param 은 gift 를 FK 로 건다 — gift 가 선 뒤여야 한다
		counts.push([
			'gift_trigger_param',
			await chunked(giftTriggerParam, (d) => prisma.giftTriggerParam.createMany({ data: d })),
		]);
		counts.push([
			'fusion_recipe',
			await chunked(gifts.fusionRecipe, (d) => prisma.fusionRecipe.createMany({ data: d })),
		]);
		counts.push([
			'fusion_slot',
			await chunked(gifts.fusionSlot, (d) => prisma.fusionSlot.createMany({ data: d })),
		]);
		counts.push([
			'fusion_slot_option',
			await chunked(gifts.fusionSlotOption, (d) =>
				prisma.fusionSlotOption.createMany({ data: d }),
			),
		]);
		counts.push([
			'gift_locked_desc',
			await chunked(gifts.giftLockedDesc, (d) =>
				prisma.giftLockedDesc.createMany({ data: d as never }),
			),
		]);
		counts.push([
			'tool_annotation',
			await chunked(gifts.toolAnnotation, (d) =>
				prisma.toolAnnotation.createMany({ data: d as never }),
			),
		]);

		// ── 상태·어휘 적재 — 인격·E.G.O 보다 먼저 ──────────────────
		counts.push(['status', await chunked(statuses.status, (d) => prisma.status.createMany({ data: d as never }))]);
		counts.push(['status_text', await chunked(statuses.statusText, (d) => prisma.statusText.createMany({ data: d as never }))]);
		counts.push(['status_category', await chunked(statuses.statusCategory, (d) => prisma.statusCategory.createMany({ data: d }))]);
		counts.push(['sin_info', await chunked(statuses.sinInfo, (d) => prisma.sinInfo.createMany({ data: d as never }))]);
		counts.push(['sin_text', await chunked(statuses.sinText, (d) => prisma.sinText.createMany({ data: d as never }))]);
		counts.push(['term', await chunked(statuses.term, (d) => prisma.term.createMany({ data: d }))]);
		counts.push(['term_text', await chunked(statuses.termText, (d) => prisma.termText.createMany({ data: d as never }))]);

		// ── 인격 계열 적재 — 뿌리부터 ─────────────────────────────
		counts.push(['sinner', (await prisma.sinner.createMany({ data: sinners.sinner })).count]);
		counts.push(['sinner_text', await chunked(sinners.sinnerText, (d) => prisma.sinnerText.createMany({ data: d as never }))]);
		counts.push(['association', (await prisma.association.createMany({ data: sinners.association })).count]);
		counts.push(['association_text', await chunked(sinners.associationText, (d) => prisma.associationText.createMany({ data: d as never }))]);

		counts.push(['skill', await chunked(skills.skill, (d) => prisma.skill.createMany({ data: d as never }))]);
		counts.push(['skill_stage', await chunked(skills.skillStage, (d) => prisma.skillStage.createMany({ data: d }))]);
		counts.push(['skill_stage_text', await chunked(skills.skillStageText, (d) => prisma.skillStageText.createMany({ data: d as never }))]);
		counts.push(['skill_coin', await chunked(skills.skillCoin, (d) => prisma.skillCoin.createMany({ data: d as never }))]);

		counts.push(['passive', await chunked(identities.passive, (d) => prisma.passive.createMany({ data: d }))]);
		counts.push(['passive_requirement', await chunked(identities.passiveRequirement, (d) => prisma.passiveRequirement.createMany({ data: d as never }))]);
		counts.push(['passive_text', await chunked(identities.passiveText, (d) => prisma.passiveText.createMany({ data: d as never }))]);

		counts.push(['identity', await chunked(identities.identity, (d) => prisma.identity.createMany({ data: d }))]);
		// identity_axis 는 identity·axis 둘 다 FK 로 걸어 여기서 적재한다 — axis 는 이미 위에서 섰다.
		counts.push(['identity_axis', await chunked(identityAxis, (d) => prisma.identityAxis.createMany({ data: d }))]);
		counts.push(['identity_text', await chunked(identities.identityText, (d) => prisma.identityText.createMany({ data: d as never }))]);
		counts.push(['identity_resist', await chunked(identities.identityResist, (d) => prisma.identityResist.createMany({ data: d as never }))]);
		counts.push(['identity_speed', await chunked(identities.identitySpeed, (d) => prisma.identitySpeed.createMany({ data: d }))]);
		counts.push(['identity_skill', await chunked(identities.identitySkill, (d) => prisma.identitySkill.createMany({ data: d }))]);
		counts.push(['identity_passive', await chunked(identities.identityPassive, (d) => prisma.identityPassive.createMany({ data: d }))]);
		counts.push(['identity_association', await chunked(identities.identityAssociation, (d) => prisma.identityAssociation.createMany({ data: d }))]);
		counts.push(['identity_keyword', await chunked(identities.identityKeyword, (d) => prisma.identityKeyword.createMany({ data: d }))]);
		counts.push(['identity_status', await chunked(identities.identityStatus, (d) => prisma.identityStatus.createMany({ data: d }))]);
		counts.push(['coin_token', await chunked(coinToken, (d) => prisma.coinToken.createMany({ data: d }))]);
		counts.push(['identity_unit_keyword', await chunked(identities.identityUnitKeyword, (d) => prisma.identityUnitKeyword.createMany({ data: d }))]);

		// ── E.G.O 계열 적재 ───────────────────────────────────────
		counts.push(['ego_passive', await chunked(egos.egoPassive, (d) => prisma.egoPassive.createMany({ data: d }))]);
		counts.push(['ego_passive_text', await chunked(egos.egoPassiveText, (d) => prisma.egoPassiveText.createMany({ data: d as never }))]);
		counts.push(['ego', await chunked(egos.ego, (d) => prisma.ego.createMany({ data: d as never }))]);
		counts.push(['ego_text', await chunked(egos.egoText, (d) => prisma.egoText.createMany({ data: d as never }))]);
		counts.push(['ego_resist', await chunked(egos.egoResist, (d) => prisma.egoResist.createMany({ data: d as never }))]);
		counts.push(['ego_cost', await chunked(egos.egoCost, (d) => prisma.egoCost.createMany({ data: d as never }))]);
		counts.push(['ego_corrosion', await chunked(egos.egoCorrosion, (d) => prisma.egoCorrosion.createMany({ data: d }))]);
		counts.push(['ego_requirement', await chunked(egos.egoRequirement, (d) => prisma.egoRequirement.createMany({ data: d }))]);
		counts.push(['ego_skill', await chunked(egos.egoSkill, (d) => prisma.egoSkill.createMany({ data: d }))]);
		counts.push(['ego_skill_stage', await chunked(egos.egoSkillStage, (d) => prisma.egoSkillStage.createMany({ data: d }))]);
		counts.push(['ego_skill_stage_text', await chunked(egos.egoSkillStageText, (d) => prisma.egoSkillStageText.createMany({ data: d as never }))]);
		counts.push(['ego_skill_coin', await chunked(egos.egoSkillCoin, (d) => prisma.egoSkillCoin.createMany({ data: d as never }))]);
		counts.push(['ego_passive_link', await chunked(egos.egoPassiveLink, (d) => prisma.egoPassiveLink.createMany({ data: d }))]);
		counts.push(['ego_status', await chunked(egos.egoStatus, (d) => prisma.egoStatus.createMany({ data: d }))]);
		counts.push(['tool_annotation (ego)', await chunked(egos.toolAnnotation, (d) => prisma.toolAnnotation.createMany({ data: d as never }))]);

		// ── 거울 던전·인카운터 적재 ────────────────────────────────
		counts.push(['choice_event', await chunked(mirror.choiceEvent, (d) => prisma.choiceEvent.createMany({ data: d }))]);
		counts.push(['choice_event_text', await chunked(mirror.choiceEventText, (d) => prisma.choiceEventText.createMany({ data: d as never }))]);
		counts.push(['choice_event_gift', await chunked(mirror.choiceEventGift, (d) => prisma.choiceEventGift.createMany({ data: d }))]);
		counts.push(['choice_option', await chunked(mirror.choiceOption, (d) => prisma.choiceOption.createMany({ data: d as never }))]);
		counts.push(['choice_option_text', await chunked(mirror.choiceOptionText, (d) => prisma.choiceOptionText.createMany({ data: d as never }))]);
		// **`thresholds` 는 아직 담을 자리가 없다.** `canonical.achievement` 에 컬럼이 없어
		// 여기서 떨군다 — 28건의 `[count]`·`[floor]`·`[skills]` 치환값이다.
		// 스키마에 `thresholds Json?` 이 생기면 이 map 을 지우면 된다(스키마는 중앙 관리).
		const achievementRows = mirror.achievement.map(({ thresholds: _t, ...a }) => a);
		counts.push(['achievement', await chunked(achievementRows, (d) => prisma.achievement.createMany({ data: d }))]);
		counts.push(['achievement_text', await chunked(mirror.achievementText, (d) => prisma.achievementText.createMany({ data: d as never }))]);
		counts.push(['reward', await chunked(mirror.reward, (d) => prisma.reward.createMany({ data: d }))]);
		counts.push(['adversity', await chunked(mirror.adversity, (d) => prisma.adversity.createMany({ data: d }))]);
		counts.push(['adversity_text', await chunked(mirror.adversityText, (d) => prisma.adversityText.createMany({ data: d as never }))]);
		counts.push(['grace', await chunked(mirror.grace, (d) => prisma.grace.createMany({ data: d }))]);
		counts.push(['grace_text', await chunked(mirror.graceText, (d) => prisma.graceText.createMany({ data: d as never }))]);
		counts.push(['start_gift', await chunked(mirror.startGift, (d) => prisma.startGift.createMany({ data: d }))]);

		counts.push(['encounter', await chunked(encounters.encounter, (d) => prisma.encounter.createMany({ data: d as never }))]);
		counts.push(['encounter_target', await chunked(encounters.encounterTarget, (d) => prisma.encounterTarget.createMany({ data: d }))]);
		counts.push(['encounter_target_part', await chunked(encounters.encounterTargetPart, (d) => prisma.encounterTargetPart.createMany({ data: d }))]);
		counts.push(['encounter_part_resist', await chunked(encounters.encounterPartResist, (d) => prisma.encounterPartResist.createMany({ data: d }))]);
		counts.push(['enemy', await chunked(encounters.enemy, (d) => prisma.enemy.createMany({ data: d }))]);
		// enemy_part 는 enemy 를 참조하므로 enemy 다음 · enemy_text 앞이어야 FK 가 안 깨진다.
		counts.push(['enemy_part', await chunked(encounters.enemyPart, (d) => prisma.enemyPart.createMany({ data: d }))]);
		counts.push(['enemy_text', await chunked(encounters.enemyText, (d) => prisma.enemyText.createMany({ data: d as never }))]);
		counts.push(['enemy_part_text', await chunked(encounters.enemyPartText, (d) => prisma.enemyPartText.createMany({ data: d as never }))]);
		counts.push(['pack_boss_encounter', await chunked(encounters.packBossEncounter, (d) => prisma.packBossEncounter.createMany({ data: d }))]);

		counts.push([
			'field_gap',
			await chunked(meta.gaps, (d) => prisma.fieldGap.createMany({ data: d })),
		]);
		counts.push([
			'field_source',
			await chunked(meta.sources, (d) => prisma.fieldSource.createMany({ data: d })),
		]);

		// 파생 뷰. 테이블이 다 선 뒤에 건다 — 뷰가 컬럼을 참조하므로 순서가 있다.
		// CREATE OR REPLACE 라 재적재에 안전하고, TRUNCATE 는 뷰를 안 지운다.
		await prisma.$executeRawUnsafe(
			await readFile(new URL('../../prisma/v2/views.sql', import.meta.url), 'utf8'),
		);

		// 수동 제약. **파일을 따로 두는 이유는 $executeRawUnsafe 가 다중 문장을
		// 못 받기 때문이다** — 뷰와 같은 파일에 두면 그 자리에서 깨진다.
		await prisma.$executeRawUnsafe(
			await readFile(new URL('../../prisma/v2/constraints.sql', import.meta.url), 'utf8'),
		);

		// ── 판 표식 ────────────────────────────────────────────────
		// **맨 마지막이다.** 행 수가 최종값이어야 하고, 저작 지문도 이번에 실제로
		// 쓴 것이어야 한다(ADR-08).
		const rowCount = await liveRowCount(prisma, 'canonical');
		const commit = codeCommit();
		await prisma.buildInfo.create({
			data: {
				id: 1,
				snapshotId,
				codeCommit: commit,
				authoredDigest: authoredDigest(authored),
				builtAt: new Date(),
				rowCount,
			},
		});
		console.log('');
		console.log(`판 표식  스냅샷 ${snapshotId} · 커밋 ${commit.slice(0, 12)} · ${rowCount.toLocaleString()}행`);

		console.log('');
		for (const [t, n] of counts) console.log(`  ${t.padEnd(22)} ${String(n).padStart(6)}`);

		const s = meta.summary();
		console.log('');
		console.log('판정 규칙별:', JSON.stringify(s.byRule));
		console.log('결손 필드별:', JSON.stringify(s.gapsByField));
	} finally {
		await prisma.$disconnect();
	}
}

await main();
