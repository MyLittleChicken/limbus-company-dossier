/**
 * 키워드·소속별 덱 12개로 판정 전체를 점검한다. 조사만 한다.
 *
 * 각 덱마다 **그 덱과 관련된 기프트**(트리거가 그 축·소속을 가리키는 것)를 뽑아
 * 판정과 근거를 낸다. 사람이 설명문과 대조할 수 있게 원문도 함께 담는다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const OUT = process.argv[2] ?? '/tmp/deck-audit';

/** 축 8덱 — 그 축을 가진 인격 6인. 소속 4덱 — 게이트를 시험한다 */
const DECKS: Array<{ name: string; kind: 'axis' | 'association'; ref: string; ids: string[] }> = [
	{ name: '출혈', kind: 'axis', ref: 'LACERATION', ids: ['10107', '10109', '10113', '10204', '10208', '10213'] },
	{ name: '파열', kind: 'axis', ref: 'BURST', ids: ['10102', '10106', '10111', '10114', '10116', '10203'] },
	{ name: '호흡', kind: 'axis', ref: 'BREATH', ids: ['10103', '10107', '10113', '10115', '10203', '10208'] },
	{ name: '진동', kind: 'axis', ref: 'VIBRATION', ids: ['10105', '10114', '10207', '10216', '10304', '10309'] },
	{ name: '침잠', kind: 'axis', ref: 'SINKING', ids: ['10101', '10104', '10108', '10110', '10115', '10209'] },
	{ name: '화상', kind: 'axis', ref: 'COMBUSTION', ids: ['10112', '10211', '10216', '10311', '10407', '10415'] },
	{ name: '충전', kind: 'axis', ref: 'CHARGE', ids: ['10106', '10116', '10202', '10210', '10215', '10302'] },
	{ name: '가속', kind: 'axis', ref: 'BULLET', ids: ['10110', '10406', '10414', '10512', '10514', '10611'] },
	{ name: '검계', kind: 'association', ref: 'BLADE_LINEAGE', ids: ['10103', '10208', '10308', '10508', '10815', '11002'] },
	{ name: '흑운회', kind: 'association', ref: 'BLACK_CLOUD', ids: ['10403', '10602', '10712', '10811', '10902', '11208'] },
	{ name: '중지', kind: 'association', ref: 'MIDDLE_FINGER', ids: ['10306', '10507', '10715', '10814', '11012', '11115'] },
	{ name: '약지', kind: 'association', ref: 'RING_FINGER', ids: ['10109', '10215', '10515', '10614', '10915', '11109'] },
];

/** 설명문 (ko · 0단계) */
const descRows = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc"
	FROM canonical.gift_stage_text t
	JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
`;
const descOf = new Map(descRows.map((r) => [r.giftId, r]));

/** 게이트가 붙은 (기프트, 트리거) 짝 */
const gateRows = await prisma.$queryRaw<Array<{ giftId: string; triggerId: string }>>`
	SELECT gift_id AS "giftId", trigger_id AS "triggerId"
	FROM canonical.gift_trigger_param WHERE kind = 'gate'
`;
const gateSet = new Set(gateRows.map((r) => `${r.giftId}|${r.triggerId}`));

mkdirSync(OUT, { recursive: true });
const summary: string[] = ['# 덱 12개 판정 요약', ''];

for (const deck of DECKS) {
	const squad: Squad = { roster: deck.ids.map((identityId) => ({ identityId, egoIds: [] })), field: deck.ids };
	const profile = new Profile(squad, data.capabilities);
	const verdicts = evaluateGifts({
		squad, profile,
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	});

	const alive = verdicts.filter((v) => v.fireable).length;
	/** 이 덱과 관련된 기프트 — 근거 중 하나라도 이 덱의 축·소속을 가리킨다 */
	const related = verdicts.filter((v) => v.reasons.some((r) => r.refId === deck.ref));
	const relatedAlive = related.filter((v) => v.fireable).length;
	/** 게이트를 가진 기프트가 이 덱에서 어떻게 되나 */
	const gated = verdicts.filter((v) => v.reasons.some((r) => gateSet.has(`${v.giftId}|${r.triggerId}`)));
	const gatedAlive = gated.filter((v) => v.fireable).length;

	summary.push(`| ${deck.name} | ${deck.ref} | ${alive}/${verdicts.length} | ${relatedAlive}/${related.length} | ${gatedAlive}/${gated.length} |`);

	const lines: string[] = [
		`# ${deck.name} 덱 — ${deck.ref}`,
		`편성 ${deck.ids.join(' · ')}`,
		'',
		`발동 가능 ${alive} / ${verdicts.length}`,
		`이 축·소속을 가리키는 기프트 ${related.length} 중 ${relatedAlive} 이 켜진다`,
		`게이트를 가진 기프트 ${gated.length} 중 ${gatedAlive} 이 켜진다`,
		'',
		'## 이 덱과 관련된 기프트 — 판정과 근거',
		'',
	];
	for (const v of related.slice(0, 40)) {
		const d = descOf.get(v.giftId);
		lines.push(`### ${v.giftId} ${d?.name ?? ''} — **${v.fireable ? '켜진다' : '켜질 수 없다'}**`);
		lines.push(`설명문: ${(d?.desc ?? '').split('\n').filter((l) => l.trim()).join(' / ')}`);
		for (const r of v.reasons) {
			const g = gateSet.has(`${v.giftId}|${r.triggerId}`) ? ' [게이트]' : '';
			const b = r.blocking ? '막음' : '안막음';
			lines.push(`  - [${r.triggerId}]${g} ${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict}/${r.certainty} · ${b}`);
		}
		lines.push('');
	}
	writeFileSync(`${OUT}/deck-${deck.name}.md`, lines.join('\n'), 'utf8');
	console.log(`${deck.name.padEnd(4)} ${deck.ref.padEnd(14)} 발동가능 ${String(alive).padStart(3)}/${verdicts.length} · 관련 ${relatedAlive}/${related.length} · 게이트 ${gatedAlive}/${gated.length}`);
}

writeFileSync(`${OUT}/SUMMARY.md`, summary.join('\n'), 'utf8');
await prisma.$disconnect();
process.exit(0);
