/**
 * 설명문을 절로 나누는 프롬프트를 낸다. **LLM 을 부르지 않는다.**
 *
 * 빌드가 LLM 을 부르면 같은 입력에 다른 결과가 나올 수 있어 `v2:verify:rebuild`
 * 가 성립하지 않는다(ADR-08). 그래서 이 도구는 프롬프트 파일까지만 만들고,
 * 사람이 그것을 모델에 넣어 받은 결과를 `--pass N` 파일로 저장한다.
 *
 * 실행
 *   npm run gift:extract -- --from 0 --count 50 --out /tmp/batch-0.md
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { SCOPES, SUPPLIES, OPS, TIMINGS, MAX_SLOT } from '../src/v2/ability-payload.js';

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const from = Number(arg('from', '0'));
const count = Number(arg('count', '50'));
const out = arg('out', '/tmp/gift-ability-batch.md');

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id, t.level
	OFFSET ${from} LIMIT ${count}
`;

const lines: string[] = [
	'# 기프트 설명문을 절(節)로 나눠라',
	'',
	'각 기프트의 설명문을 **문단 단위 능력**으로 나누고, 능력마다 발동 조건을 적어라.',
	'jsonl 로 낸다 — 한 줄이 능력 하나다. 설명 문장을 덧붙이지 마라.',
	'',
	'## 절은 네 종류다',
	'',
	'```',
	'기본 효과   조건 없이 돈다                unconditional=true · conds 없음',
	'조건 효과   기본이지만 공급 조건이 붙는다    unconditional=false · conds 있음',
	'추가 효과   「- N인 이상」 티어            독립 능력이다. refines 를 쓰지 마라',
	'배수 효과   크기가 (편성 수 × k)          문턱값으로 적어라. 크기는 안 담는다',
	'```',
	'',
	'**「- N인 이상」 티어를 refines 로 적지 마라.** 티어는 원 능력과 독립으로 켜지고 꺼진다.',
	'`refines` 는 「효과가 강화되어」처럼 앞 절의 결과를 전제하는 것에만 쓴다.',
	'',
	'**「효과가 변경되어」는 담지 마라.** 조건이 같고 주는 효과만 갈리는 것이라 발동 판정과 무관하다.',
	'',
	'**크기를 문턱값으로 옮겨라.** 「(편성된 수 - 2)만큼 얻음」은 3명은 있어야 1을 준다는 뜻이니',
	'`op=gte · threshold=3` 이다. 0개를 주는 것은 안 주는 것이다.',
	'',
	'## 조건이 아닌 것',
	'',
	'```',
	'우선순위 주석  「(… 인격을 우선으로 지정)」   누구에게 먼저 줄지일 뿐이다',
	'적용 범위     「… 인격에게 효과 적용」        누구에게 적용되는지이지 켜지는 조건이 아니다',
	'횟수 제한     「(턴 당 1회 발동)」 · 「(최대 3)」',
	'효과 수량     「호흡 위력 3」',
	'대상 수       「(출혈을 보유한 적 수)명에게」   몇에게 주는지이지 켜지는 조건이 아니다',
	'```',
	'',
	'## 칸',
	'',
	'```',
	`timing    ${TIMINGS.join(' · ')}`,
	'          어휘 밖이면 other 로 두고 note 에 원문을 적어라',
	`op        ${OPS.join(' · ')}   has 는 수가 아니라 존재를 묻는다`,
	'threshold 문장에 없으면 null. **1 로 가정하지 마라**',
	`scope     ${SCOPES.join(' · ')}`,
	'          field=출격 7인 · roster=편성 12인 · waiting=대기 5인',
	'          설명문이 직접 말한다 — 「출격 인원을 기준」(field) · 「편성 인원을 기준」(roster) ·',
	'          「대기 인원 포함」(roster) · 「대기 인원 제외」(field) · 「대기 인원에」(waiting)',
	`supply    ${SUPPLIES.join(' · ')}`,
	'          skill 은 「스킬 효과로 …할 때」처럼 스킬이 실제로 주는지 묻는 것.',
	'          refKind 가 axis 일 때만 쓸 수 있다',
	`slot      scope=slot 일 때 1~${MAX_SLOT}. 출격이 7인이라 7번 자리가 있다`,
	'runtime   전투 중에만 아는가. 적 상태 · 정신력 · 지금 걸린 버프 등',
	'          **공명은 runtime 이 아니다** — 상한이 출격 인원 중 그 속성 스킬',
	'          보유 수라서 편성으로 정해진다',
	'refKind   axis · sin · resonance · attack_type · skill_kind · coin ·',
	'          deployment · association · unit_keyword · enemy_state · other',
	'          어휘에 못 담으면 other 로 두고 refId 에 원문 조각을 그대로 넣어라',
	'refId     axis   COMBUSTION · LACERATION · BURST · BREATH · VIBRATION · SINKING · CHARGE · BULLET',
	'          sin    wrath · lust · sloth · gluttony · gloom · pride · envy',
	'          attack_type  slash · pierce · blunt',
	'          skill_kind   counter · evade · guard',
	'          association · unit_keyword 는 canonical 의 id 를 쓴다',
	'resonanceMode  activate(일반 공명) · absolute(완전 공명). resonance 에만',
	'```',
	'',
	'## group 이 AND/OR 를 가른다',
	'',
	'**같은 group 안은 OR, group 끼리는 AND.**',
	'「분노 완전 공명을 발동하였**거나** 충전 스킬을 사용할 경우」는 group 0 에 조건 2개다.',
	'',
	'## 낼 모양',
	'',
	'```json',
	'{"giftId":"9262","level":0,"ordinal":0,"payload":{"timing":"none","unconditional":false,"refines":null,"sourceText":"약지 소속 인격 공격 종료시 …","conds":[{"group":0,"idx":0,"refKind":"association","refId":"RING_FINGER","op":"has","threshold":null,"scope":"roster","supply":"tag","slot":null,"runtime":false,"resonanceMode":null}]},"note":"두 문단 다 약지를 요구한다"}',
	'```',
	'',
	'`sourceText` 는 그 능력에 해당하는 **설명문 원문 그대로**여야 한다. 요약하지 마라.',
	'`ordinal` 은 그 (기프트, 단계) 안에서 0부터 센다.',
	'',
	'---',
	'',
	`## 대상 ${rows.length}건 (offset ${from})`,
	'',
];
for (const r of rows) {
	lines.push(`### ${r.name} — giftId ${r.giftId} · level ${r.level}`, '', '```', r.desc, '```', '');
}
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`${rows.length}건 → ${out}`);
console.log('이 파일을 모델에 넣고 받은 jsonl 을 src/v2/authored/gift-ability.pass1.jsonl 등에 이어붙여라.');

await prisma.$disconnect();
process.exit(0);
