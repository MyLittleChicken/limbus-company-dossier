/**
 * 거울 던전 기프트 전량을 사람이 읽을 형태로 쏟는다. 조사용이다.
 *
 * 각 기프트마다 이름 · 단계별 설명문(ko) · 지금 붙어 있는 제3자 트리거/효과 태그를
 * 함께 낸다. 태그가 못 담는 메카닉을 찾는 것이 목적이므로 둘을 나란히 둔다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';

const prisma = new PrismaClient();
const OUT = process.argv[2] ?? '/tmp/gift-audit';
const BATCH = Number(process.argv[3] ?? 57);

type Row = { giftId: string; name: string; level: number; desc: string };
const rows = await prisma.$queryRaw<Row[]>`
	SELECT t.gift_id AS "giftId", t.name, t.level, t."desc"
	FROM canonical.gift_stage_text t
	JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon' AND length(t."desc") > 0
	ORDER BY t.gift_id, t.level
`;

type Tag = { giftId: string; kind: string; label: string };
const tags = await prisma.$queryRaw<Tag[]>`
	SELECT gt.gift_id AS "giftId", '트리거' AS kind,
	       gt.trigger_id || ' → ' || coalesce(tr.ref_kind || '/' || tr.ref_id, '(참조없음)')
	       || coalesce(' min=' || p.value::text, '') AS label
	FROM canonical.gift_trigger gt
	LEFT JOIN canonical.trigger_ref tr ON tr.trigger_id = gt.trigger_id
	LEFT JOIN canonical.gift_trigger_param p
	       ON p.gift_id = gt.gift_id AND p.trigger_id = gt.trigger_id AND p.kind = 'min_count'
	UNION ALL
	SELECT ge.gift_id, '효과',
	       ge.effect_id || ' → ' || coalesce(er.ref_kind || '/' || er.ref_id || ':' || er.mode, '(참조없음)')
	FROM canonical.gift_effect ge
	LEFT JOIN canonical.effect_ref er ON er.effect_id = ge.effect_id
`;
const tagsOf = new Map<string, string[]>();
for (const t of tags) {
	const list = tagsOf.get(t.giftId) ?? [];
	list.push(`${t.kind}  ${t.label}`);
	tagsOf.set(t.giftId, list);
}

const byGift = new Map<string, Row[]>();
for (const r of rows) {
	const list = byGift.get(r.giftId) ?? [];
	list.push(r);
	byGift.set(r.giftId, list);
}

const ids = [...byGift.keys()].sort();
console.log(`거울 던전 기프트 ${ids.length} · 단계 문장 ${rows.length}`);

mkdirSync(OUT, { recursive: true });
let batch = 0;
for (let i = 0; i < ids.length; i += BATCH) {
	batch += 1;
	const slice = ids.slice(i, i + BATCH);
	const lines: string[] = [`# 기프트 검수 묶음 ${batch} — ${slice.length}개 (${slice[0]}~${slice[slice.length - 1]})`, ''];
	for (const id of slice) {
		const levels = byGift.get(id) ?? [];
		lines.push(`## ${id} ${levels[0]?.name ?? ''}`);
		for (const l of levels) lines.push(`### 강화 ${l.level}\n${l.desc}`);
		const t = tagsOf.get(id);
		lines.push('', '### 지금 붙어 있는 태그');
		lines.push(t === undefined ? '  (없음)' : t.map((x) => `  ${x}`).join('\n'));
		lines.push('', '---', '');
	}
	const path = `${OUT}/batch-${String(batch).padStart(2, '0')}.md`;
	writeFileSync(path, lines.join('\n'), 'utf8');
	console.log(`  ${path}  ${slice.length}개`);
}

await prisma.$disconnect();
process.exit(0);
