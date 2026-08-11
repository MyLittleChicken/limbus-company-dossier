/**
 * 거울 던전의 실제 편성 모형으로 다시 검증한다. 조사만 한다.
 *
 * 앞선 12덱 검증은 `roster` 6인 · `field` 같은 6인으로 짰다. 그래서
 *   - `waiting` 분모가 언제나 공집합이었다 — 대기 조건은 전부 불충족으로 나왔다
 *   - 자리 7번이 없어 「[편성 7번 인격 전용]」이 영영 불가로 나왔다
 *   - 「N인 이상」 조건의 분모가 6이라 실제보다 빡빡했다
 * 셋 다 덱 설계의 결함이지 판정의 결함이 아니다.
 *
 * 사용자 확정(2026-08-11): 편성 12인 · 출격 7인 · 대기 5인.
 * 출격 중 사망하면 대기에서 순서대로 나온다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const OUT = process.argv[2] ?? '/tmp/mirror-verify';
mkdirSync(OUT, { recursive: true });

const ROSTER_SIZE = 12;
const FIELD_SIZE = 7;

/** 축별 인격 — 인격 취급(tag·both)만 센다. Profile 과 같은 기준이다 */
const byAxis = await prisma.$queryRaw<Array<{ axisId: string; identityId: string }>>`
	SELECT axis_id AS "axisId", identity_id AS "identityId"
	FROM canonical.identity_axis
	WHERE gate_kind = 'always' AND affects IN ('tag', 'both')
	ORDER BY 1, 2
`;
const byAssoc = await prisma.$queryRaw<Array<{ associationId: string; identityId: string }>>`
	SELECT association_id AS "associationId", identity_id AS "identityId"
	FROM canonical.identity_association ORDER BY 1, 2
`;
const allIds = [...new Set(byAssoc.map((r) => r.identityId))].sort();

const group = <T, K extends string>(rows: T[], key: (r: T) => K, val: (r: T) => string) => {
	const m = new Map<K, string[]>();
	for (const r of rows) {
		const k = key(r);
		m.set(k, [...(m.get(k) ?? []), val(r)]);
	}
	return m;
};
const axisMembers = group(byAxis, (r) => r.axisId, (r) => r.identityId);
const assocMembers = group(byAssoc, (r) => r.associationId, (r) => r.identityId);

/**
 * 핵심 인원을 앞세우고 12인까지 채운다.
 *
 * **핵심은 반드시 출격 7인 안에 넣는다.** 그 축·소속을 시험하려고 짠 덱이므로
 * 대기로 밀어 두면 시험이 안 된다. 남는 자리는 다른 인격으로 채워 12인을 만든다 —
 * 실제 거울 던전이 그렇고, 대기 분모를 가진 조건도 그래야 판정된다.
 */
const buildSquad = (core: string[]): Squad => {
	const picked = [...new Set(core)].slice(0, ROSTER_SIZE);
	const filler = allIds.filter((id) => !picked.includes(id));
	const roster = [...picked, ...filler].slice(0, ROSTER_SIZE);
	// 핵심을 앞에 두었으므로 앞 7인이 곧 출격이다
	const field = roster.slice(0, FIELD_SIZE);
	return { roster: roster.map((identityId) => ({ identityId, egoIds: [] })), field };
};

type Deck = { name: string; kind: '축' | '소속'; squad: Squad; coreCount: number };
const decks: Deck[] = [];
for (const [axisId, ids] of [...axisMembers].sort()) {
	if (ids.length < FIELD_SIZE) continue;
	decks.push({ name: axisId, kind: '축', squad: buildSquad(ids), coreCount: Math.min(ids.length, ROSTER_SIZE) });
}
/** 소속은 앞 검증이 넷만 다뤘다. 기프트가 실제로 가리키는 소속을 전부 넣는다 */
const ASSOC_DECKS = [
	'BLADE_LINEAGE', 'BLACK_CLOUD', 'MIDDLE_FINGER', 'RING_FINGER', 'INDEX_FINGER',
	'THUMB_FINGER', 'LITTLE_FINGER', 'PEQUOD_CREW', 'DAWN', 'LA_MANCHA_LAND',
	'LIMBUS_COMPANY', 'LIU', 'ZWEI', 'N_CORP', 'W_CORP', 'R_CORP', 'T_CORP',
	'H_CORP', 'L_CORP', 'G_CORP', 'K_CORP', 'S_CORP', 'SPIDER_HOUSE', 'MOLAR',
	'SHI', 'CINQ', 'SEVEN', 'DIECI', 'ATL', 'MULTI_CRACK', 'WUTHERING_HEIGHTS',
	'BLACK_BEAST_RABBIT', 'BLACK_BEAST_CHICKEN', 'TROUBLE_SHOOTER',
];
for (const assocId of ASSOC_DECKS) {
	const ids = assocMembers.get(assocId as never) ?? [];
	if (ids.length === 0) continue;
	decks.push({ name: assocId, kind: '소속', squad: buildSquad(ids), coreCount: ids.length });
}

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
`;
const textOf = new Map(texts.map((t) => [t.giftId, t]));

const aliveIn = new Map<string, string[]>();
const blockers = new Map<string, Set<string>>();
let evaluated = 0;

const rows: string[] = [];
for (const d of decks) {
	const verdicts = evaluateGifts({
		squad: d.squad, profile: new Profile(d.squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	evaluated = verdicts.length;
	let alive = 0;
	for (const v of verdicts) {
		if (v.fireable) {
			alive += 1;
			aliveIn.set(v.giftId, [...(aliveIn.get(v.giftId) ?? []), d.name]);
		} else {
			for (const r of v.reasons) {
				if (r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain') {
					const s = blockers.get(v.giftId) ?? new Set();
					s.add(`${r.refKind}/${r.refId} ${r.have}<${r.need}`);
					blockers.set(v.giftId, s);
				}
			}
		}
	}
	rows.push(`${d.kind}  ${d.name.padEnd(24)} 핵심 ${String(d.coreCount).padStart(2)}인  발동 ${String(alive).padStart(3)} / ${evaluated}`);
}

console.log(`덱 ${decks.length}개 · 편성 ${ROSTER_SIZE}인 / 출격 ${FIELD_SIZE}인 / 대기 ${ROSTER_SIZE - FIELD_SIZE}인\n`);
for (const r of rows) console.log(`  ${r}`);

const dead = [...textOf.keys()].filter((id) => (aliveIn.get(id) ?? []).length === 0).sort();
const always = [...textOf.keys()].filter((id) => (aliveIn.get(id) ?? []).length === decks.length);
console.log(`\n전 덱에서 죽는 기프트  ${dead.length}`);
console.log(`전 덱에서 켜지는 기프트 ${always.length} / ${textOf.size}\n`);

const md: string[] = [
	'# 거울 던전 편성 모형으로 다시 돌린 검증',
	'',
	`편성 ${ROSTER_SIZE}인 · 출격 ${FIELD_SIZE}인 · 대기 ${ROSTER_SIZE - FIELD_SIZE}인 · 덱 ${decks.length}개`,
	'',
	'## 덱별 판정', '', '```', ...rows, '```', '',
	`## 전 덱에서 죽는 기프트 ${dead.length}`, '',
];
for (const id of dead) {
	const t = textOf.get(id);
	md.push(`### ${t?.name ?? ''} (${id})`, '', '```', t?.desc ?? '', '```', '');
	md.push('막는 근거', ...[...(blockers.get(id) ?? [])].map((b) => `  - ${b}`), '', '---', '');
}
writeFileSync(`${OUT}/MIRROR-VERIFY.md`, md.join('\n'), 'utf8');
console.log(`→ ${OUT}/MIRROR-VERIFY.md`);

await prisma.$disconnect();
process.exit(0);
