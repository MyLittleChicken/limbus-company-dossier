/**
 * 과소 판정 13건의 설명문 전문과, 아직 검수되지 않은 자리를 함께 낸다. 조사만 한다.
 *
 * 앞선 12덱 검수는 각 덱의 「관련 기프트」(그 축·소속을 가리키는 것)만 봤다.
 * 나머지 400여 개는 아무도 안 봤다. 그중 **언제나 켜지는** 기프트가 위험하다 —
 * 진짜 편성 조건이 있는데 태그가 못 담으면 과대 판정이 되고, 과대 판정은
 * 사용자를 잘못된 선택으로 이끈다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const OUT = process.argv[2] ?? '/tmp/full-audit';
mkdirSync(OUT, { recursive: true });

const DECKS: Array<[string, string[]]> = [
	['출혈', ['10107', '10109', '10113', '10204', '10208', '10213']],
	['파열', ['10102', '10106', '10111', '10114', '10116', '10203']],
	['호흡', ['10103', '10107', '10113', '10115', '10203', '10208']],
	['진동', ['10105', '10114', '10207', '10216', '10304', '10309']],
	['침잠', ['10101', '10104', '10108', '10110', '10115', '10209']],
	['화상', ['10112', '10211', '10216', '10311', '10407', '10415']],
	['충전', ['10106', '10116', '10202', '10210', '10215', '10302']],
	['가속', ['10110', '10406', '10414', '10512', '10514', '10611']],
	['검계', ['10103', '10208', '10308', '10508', '10815', '11002']],
	['흑운회', ['10403', '10602', '10712', '10811', '10902', '11208']],
	['중지', ['10306', '10507', '10715', '10814', '11012', '11115']],
	['약지', ['10109', '10215', '10515', '10614', '10915', '11109']],
];

const texts = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
`;
const textOf = new Map(texts.map((t) => [t.giftId, t]));

/** 덱마다 판정을 모은다 */
const aliveCount = new Map<string, number>();
const blockersOf = new Map<string, Set<string>>();
const reasonShape = new Map<string, string>();
for (const [deckName, ids] of DECKS) {
	const squad: Squad = { roster: ids.map((identityId) => ({ identityId, egoIds: [] })), field: ids };
	const verdicts = evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});
	for (const v of verdicts) {
		if (v.fireable) aliveCount.set(v.giftId, (aliveCount.get(v.giftId) ?? 0) + 1);
		for (const r of v.reasons) {
			if (r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain') {
				const s = blockersOf.get(v.giftId) ?? new Set();
				s.add(`${r.refKind}/${r.refId} ${r.have}<${r.need} (${deckName})`);
				blockersOf.set(v.giftId, s);
			}
		}
		if (!reasonShape.has(v.giftId)) {
			const kinds = v.reasons.map((r) => `${r.refKind}:${r.verdict}${r.blocking ? '' : '(안막음)'}`);
			reasonShape.set(v.giftId, kinds.join(' · ') || '(근거 없음)');
		}
	}
}

// ── ① 과소 판정 13건 전문 ─────────────────────────────────
const FLAGGED = ['9802', '9803', '9804', '9115', '9239', '9049', '9123', '9261', '9747', '9104', '9043', '9052', '9828'];
const a: string[] = ['# 과소 판정 13건 — 설명문 전문', ''];
for (const id of FLAGGED) {
	const t = textOf.get(id);
	a.push(`## ${id} ${t?.name ?? ''}`);
	a.push(`**켜지는 덱 ${aliveCount.get(id) ?? 0} / 12**`, '');
	a.push('```');
	a.push(t?.desc ?? '(설명문 없음)');
	a.push('```', '');
	a.push('막는 근거');
	for (const b of [...(blockersOf.get(id) ?? [])]) a.push(`  - ${b}`);
	a.push('', '전체 근거 모양', `  ${reasonShape.get(id) ?? ''}`, '', '---', '');
}
writeFileSync(`${OUT}/UNDERJUDGED.md`, a.join('\n'), 'utf8');

// ── ② 아직 안 본 자리 — 12덱 전부에서 켜지는 기프트 ────────
/** 편성 조건을 말하는 문형. 있으면 「언제나 켜진다」가 의심스럽다 */
const ROSTER_PHRASE = /[0-9]인 이상|[0-9]명 이상|보유한 인격|소속 인격이|인격이 [0-9]|편성된 수|편성 인원/;
const always = [...textOf.keys()].filter((id) => (aliveCount.get(id) ?? 0) === 12);
const suspect = always.filter((id) => ROSTER_PHRASE.test(textOf.get(id)?.desc ?? ''));

const b: string[] = [
	'# 12덱 전부에서 켜지는데 설명문에 편성 조건이 있는 기프트',
	'',
	`12덱 전부에서 켜지는 기프트 ${always.length} / ${textOf.size}`,
	`그중 설명문이 편성 조건을 말하는 것 **${suspect.length}**`,
	'',
	'이 목록이 과대 판정 후보다 — 진짜 조건이 있는데 태그가 못 담으면 언제나 켜진다.',
	'',
];
for (const id of suspect) {
	const t = textOf.get(id);
	b.push(`## ${id} ${t?.name ?? ''}`);
	b.push('```');
	b.push(t?.desc ?? '');
	b.push('```');
	b.push(`근거 모양: ${reasonShape.get(id) ?? ''}`, '', '---', '');
}
writeFileSync(`${OUT}/ALWAYS-ALIVE.md`, b.join('\n'), 'utf8');

console.log(`과소 판정 13건 전문        → ${OUT}/UNDERJUDGED.md`);
console.log(`12덱 전부 켜지는 기프트    ${always.length} / ${textOf.size}`);
console.log(`  그중 편성 조건 문형 있음  ${suspect.length}  → ${OUT}/ALWAYS-ALIVE.md`);
const dead = [...textOf.keys()].filter((id) => (aliveCount.get(id) ?? 0) === 0).sort();
console.log(`\n12덱 전부에서 죽는 기프트  ${dead.length}\n`);
for (const id of dead) {
	const t = textOf.get(id);
	console.log(`${id} ${t?.name ?? ''}`);
	console.log(`   ${(t?.desc ?? '').split('\n').filter((l) => l.trim())[0]?.slice(0, 86) ?? ''}`);
	console.log(`   막음: ${[...(blockersOf.get(id) ?? [])].map((x) => x.split(' (')[0]).filter((v, i, a) => a.indexOf(v) === i).join(' | ')}\n`);
}

await prisma.$disconnect();
process.exit(0);
