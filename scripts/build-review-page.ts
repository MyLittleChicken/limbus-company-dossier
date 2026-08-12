/**
 * 검수 페이지를 만든다. 절 단위로 보고 「맞다 / 틀리다」를 누르는 창구다.
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막히므로 기프트
 * 자료를 페이지 안에 통째로 넣는다. 456건이라 크지만 텍스트뿐이라 감당된다.
 *
 * 판정은 localStorage 에 남는다 — 여러 날에 나눠 봐도 이어진다. 내보내기는
 * 사용자가 누를 때만 일어나고(`window.claude.downloads`), 그 파일을
 * `npm run gift:import` 가 받아 progress.json 에 반영한다.
 *
 * 실행: npm run gift:page -- --out /tmp/gift-review.html
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { validatePayload, type AbilityPayload } from '../src/v2/ability-payload.js';

const AUTHORED = 'src/v2/authored/gift-ability.jsonl';
const PROGRESS = 'src/v2/authored/gift-ability.progress.json';
const PRIORITY = 'src/v2/authored/gift-ability.priority.json';

const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/gift-review.html';

const prisma = new PrismaClient();
const texts = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id, t.level
`;

interface Authored { giftId: string; level: number; ordinal: number; payload: AbilityPayload; note: string }
const authored: Authored[] = existsSync(AUTHORED)
	? readFileSync(AUTHORED, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l !== '')
		.map((l) => JSON.parse(l) as Authored)
	: [];

const progress: { round: number; verdicts: Record<string, { state: string; why?: string }> } =
	existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')) : { round: 1, verdicts: {} };
const priority: string[] = existsSync(PRIORITY) ? JSON.parse(readFileSync(PRIORITY, 'utf8')) : [];

/**
 * 조건을 사람 문장으로 읽으려면 이름표가 필요하다.
 *
 * `association/RING_FINGER` 를 그대로 보이면 검수자가 머릿속에서 「약지」로
 * 옮겨야 한다 — 456번 그러면 회차가 끝나지 않는다. DB 가 이름을 갖고 있으니
 * 페이지에 함께 넣는다.
 */
const assocNames = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
	SELECT association_id AS id, name FROM canonical.association_text WHERE locale = 'ko'
`;
const keywordNames = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
	SELECT keyword_id AS id, name FROM canonical.keyword_text WHERE locale = 'ko'
`;
const unitKeywords = await prisma.$queryRaw<Array<{ keyword: string; n: bigint }>>`
	SELECT keyword, count(*)::bigint AS n FROM canonical.identity_unit_keyword GROUP BY 1
`;

/**
 * 축 id 는 대문자, keyword id 는 파스칼케이스라 맞춰 준다.
 *
 * **BULLET 은 `keyword_text` 에 없다.** 게임 어휘 12종이 죄악속성 대비 부여
 * 키워드만 담고 탄환은 안 담기 때문이다(`canonical.axis` 가 `kind='bullet'`
 * 로 따로 둔다). 이름표가 비어 id 가 그대로 보이던 자리라 우리가 붙인다 —
 * 탄환을 **소모하는** 인격을 가리키고, 마침표 사무소 · 동부 엄지 · R사 계열
 * 13인이다.
 */
const axisLabel: Record<string, string> = {};
for (const k of keywordNames) axisLabel[k.id.toUpperCase()] = k.name;
axisLabel.BULLET = '탄환';

const LABELS = {
	axis: axisLabel,
	association: Object.fromEntries(assocNames.map((a) => [a.id, a.name])),
	/** 유닛 키워드는 ko 이름표가 없다 — 아는 것만 적고 나머지는 id 를 그대로 보인다 */
	unit_keyword: { BLOODFIEND: '혈귀' } as Record<string, string>,
	sin: {
		wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '폭식',
		gloom: '우울', pride: '오만', envy: '질투',
	} as Record<string, string>,
	attack_type: { slash: '참격', pierce: '관통', blunt: '타격' } as Record<string, string>,
	skill_kind: { counter: '반격', evade: '회피', guard: '방어' } as Record<string, string>,
	coin: { minus: '빼기 코인', plus: '더하기 코인', single: '단일 코인' } as Record<string, string>,
};
LABELS.resonance = LABELS.sin;
/** 유닛 키워드 공급 수 — 「혈귀 5명 중」처럼 모수를 함께 보이면 판단이 쉬워진다 */
const SUPPLY_N: Record<string, number> = Object.fromEntries(
	unitKeywords.map((u) => [`unit_keyword/${u.keyword}`, Number(u.n)]),
);
for (const a of assocNames) SUPPLY_N[`association/${a.id}`] = 0;
const assocCounts = await prisma.$queryRaw<Array<{ id: string; n: bigint }>>`
	SELECT association_id AS id, count(*)::bigint AS n FROM canonical.identity_association GROUP BY 1
`;
for (const a of assocCounts) SUPPLY_N[`association/${a.id}`] = Number(a.n);

const gifts = [...new Set(texts.map((t) => t.giftId))].map((id) => ({
	id,
	name: texts.find((t) => t.giftId === id)?.name ?? '',
	stages: texts.filter((t) => t.giftId === id).map((t) => ({ level: t.level, desc: t.desc })),
	abilities: authored.filter((a) => a.giftId === id)
		.sort((x, y) => x.level - y.level || x.ordinal - y.ordinal)
		.map((a) => ({
			level: a.level, ordinal: a.ordinal, note: a.note,
			timing: a.payload.timing, unconditional: a.payload.unconditional,
			refines: a.payload.refines, sourceText: a.payload.sourceText,
			conds: a.payload.conds, problems: validatePayload(a.payload),
		})),
	priority: priority.includes(id),
	seeded: progress.verdicts[id]?.state ?? null,
	why: progress.verdicts[id]?.why ?? null,
}));
// 어긋난 것을 앞에, 그다음 절이 뽑힌 것을 앞에 — 볼 수 있는 것부터 보게 한다
gifts.sort((a, b) =>
	Number(b.priority) - Number(a.priority) ||
	Number(b.abilities.length > 0) - Number(a.abilities.length > 0) ||
	a.id.localeCompare(b.id));

/** `</script>` 로 페이지가 끊기는 것과 줄 구분자를 막는다 */
const DATA = JSON.stringify({ round: progress.round, gifts, labels: LABELS, supplyN: SUPPLY_N })
	.replaceAll('<', '\\u003c')
	.replaceAll(' ', '\\u2028')
	.replaceAll(' ', '\\u2029');

writeFileSync(out, renderPage(DATA), 'utf8');
const withAbilities = gifts.filter((g) => g.abilities.length > 0).length;
console.log(`기프트 ${gifts.length} (절이 뽑힌 것 ${withAbilities}) · 능력 ${authored.length}`);
console.log(`→ ${out}`);

await prisma.$disconnect();
process.exit(0);

function renderPage(data: string): string {
	return `<title>기프트 절 검수</title>
<style>
  :root {
    --panel:#fff; --panel-2:#f6f6f4; --line:#dddcd6; --ink:#0e1116;
    --text:#1a1e25; --dim:#666e7a; --faint:#9aa1ab;
    --ok:#2f7f6f; --bad:#b4423a; --warn:#b07d22; --struct:#4f5f92;
    --ok-bg:#e7f3f0; --bad-bg:#fbeceb; --warn-bg:#fbf3e3;
    --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{
    --panel:#14181e; --panel-2:#0f1318; --line:#29303a; --ink:#f2f1ee;
    --text:#e6e7ea; --dim:#939aa5; --faint:#6b737e;
    --ok:#5fb8a5; --bad:#e0736a; --warn:#d9a545; --struct:#8e9dd0;
    --ok-bg:#16261f; --bad-bg:#2b1a19; --warn-bg:#2a2216;}}
  :root[data-theme="dark"]{
    --panel:#14181e; --panel-2:#0f1318; --line:#29303a; --ink:#f2f1ee;
    --text:#e6e7ea; --dim:#939aa5; --faint:#6b737e;
    --ok:#5fb8a5; --bad:#e0736a; --warn:#d9a545; --struct:#8e9dd0;
    --ok-bg:#16261f; --bad-bg:#2b1a19; --warn-bg:#2a2216;}
  :root[data-theme="light"]{
    --panel:#fff; --panel-2:#f6f6f4; --line:#dddcd6; --ink:#0e1116;
    --text:#1a1e25; --dim:#666e7a; --faint:#9aa1ab;
    --ok:#2f7f6f; --bad:#b4423a; --warn:#b07d22; --struct:#4f5f92;
    --ok-bg:#e7f3f0; --bad-bg:#fbeceb; --warn-bg:#fbf3e3;}

  body{background:var(--panel-2);color:var(--text);font-family:var(--sans);
    line-height:1.6;margin:0;padding:0 16px 110px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:940px;margin:0 auto}
  code{font-family:var(--mono);font-variant-numeric:tabular-nums}
  h1{font-size:24px;margin:0;letter-spacing:-.02em}

  header{position:sticky;top:0;z-index:10;background:var(--panel-2);
    border-bottom:2px solid var(--ink);padding:16px 0 11px;margin-bottom:18px}
  .bar{height:6px;background:var(--line);margin:11px 0 9px;display:flex;overflow:hidden}
  .bar i{display:block;height:100%}
  .bar .b-ok{background:var(--ok)} .bar .b-bad{background:var(--bad)}
  .tally{display:flex;gap:15px;font-family:var(--mono);font-size:12.5px;
    color:var(--dim);font-variant-numeric:tabular-nums;flex-wrap:wrap;align-items:center}
  .tally b{font-weight:700}
  .tally .t-ok b{color:var(--ok)} .tally .t-bad b{color:var(--bad)}
  .filters{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
  button{font-family:inherit;font-size:12.5px;padding:5px 11px;border:1px solid var(--line);
    background:var(--panel);color:var(--text);cursor:pointer;border-radius:2px}
  button:hover{border-color:var(--dim)}
  button[aria-pressed="true"]{background:var(--ink);color:var(--panel-2);border-color:var(--ink)}
  button:focus-visible{outline:2px solid var(--struct);outline-offset:2px}
  .export{border-color:var(--struct);color:var(--struct);font-weight:600}

  .gift{background:var(--panel);border:1px solid var(--line);margin-bottom:13px}
  .gift.v-ok{border-left:4px solid var(--ok)}
  .gift.v-bad{border-left:4px solid var(--bad)}
  .gift > .top{padding:13px 18px 11px;border-bottom:1px solid var(--line);
    display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .gift h2{font-size:16px;font-weight:680;margin:0}
  .gift h2 em{font-family:var(--mono);font-style:normal;font-size:10.5px;
    color:var(--faint);font-weight:400;margin-left:6px}
  .flag{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
    padding:2px 7px;border-radius:2px;background:var(--warn-bg);color:var(--warn)}
  .body{padding:13px 18px 15px;display:grid;gap:12px}
  .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--faint);margin-bottom:6px}
  pre{margin:0;padding:11px 14px;background:var(--panel-2);border:1px solid var(--line);
    overflow-x:auto;font-family:var(--mono);font-size:12px;line-height:1.7;
    white-space:pre-wrap;word-break:break-word;color:var(--text)}

  .ab{border:1px solid var(--line);padding:10px 14px;background:var(--panel-2)}
  .ab + .ab{margin-top:8px}
  .ab .hd{font-family:var(--mono);font-size:11.5px;color:var(--dim);
    display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}
  .ab .hd b{color:var(--text)}
  .ab .src{font-size:13px;margin-bottom:7px}
  /* 조건 — 사람 문장이 먼저, 기계말은 작게 아래 */
  .cond{font-size:13px;padding:6px 0 6px 12px;border-left:2px solid var(--struct);
    color:var(--text);margin:4px 0}
  .cond b{font-weight:680}
  .cond .rt{color:var(--warn)}
  .cond .sub{color:var(--dim);font-size:12px}
  .cond .or{font-family:var(--mono);font-size:10.5px;color:var(--struct);
    letter-spacing:.08em;margin-right:4px}
  .cond .raw{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:3px}
  .grp + .grp{margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)}
  .verdict-line{font-size:12.5px;color:var(--dim);margin:5px 0}
  .verdict-line b{color:var(--text)}
  .verdict-line.ok-line{color:var(--ok)}
  .verdict-line.ok-line b{color:var(--ok)}
  .summary{font-size:13px;background:var(--panel);border:1px solid var(--line);
    border-left:3px solid var(--struct);padding:9px 13px;margin-bottom:9px}
  .summary b{font-weight:680}
  .none{font-size:12.5px;color:var(--bad)}
  .warn{font-family:var(--mono);font-size:11.5px;color:var(--bad);margin-top:5px}
  .note{font-size:12.5px;color:var(--dim);margin-top:7px;padding-top:6px;
    border-top:1px dashed var(--line)}

  .verdict{display:flex;gap:8px;align-items:center;padding:11px 18px;
    border-top:1px solid var(--line);flex-wrap:wrap}
  .verdict .y[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#fff}
  .verdict .n[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
  .whybox{width:100%;margin-top:10px;border:1px solid var(--bad);border-left-width:3px;
    background:var(--bad-bg);padding:9px 11px}
  .whylbl{font-size:12.5px;font-weight:650;color:var(--bad);margin-bottom:6px}
  .whylbl span{font-weight:400;color:var(--dim)}
  .why{width:100%;box-sizing:border-box;font-family:inherit;font-size:13px;padding:8px 10px;
    border:1px solid var(--line);background:var(--panel);color:var(--text);resize:vertical;
    line-height:1.55}
  .why:focus-visible{outline:2px solid var(--bad);outline-offset:-1px}
  .whyfoot{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:5px}
  .hint{font-size:12px;color:var(--faint)}
  .t-why b{color:var(--bad)}
  footer{position:fixed;left:0;right:0;bottom:0;background:var(--panel);
    border-top:1px solid var(--line);padding:9px 16px;font-family:var(--mono);
    font-size:11.5px;color:var(--dim);display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
</style>

<div class="wrap">
<header>
  <h1>기프트 절 검수</h1>
  <div class="bar"><i class="b-ok"></i><i class="b-bad"></i></div>
  <div class="tally">
    <span class="t-ok">맞다 <b id="n-ok">0</b></span>
    <span class="t-bad">틀리다 <b id="n-bad">0</b></span>
    <span class="t-why">서술 <b id="n-why">0 / 0</b></span>
    <span>미판정 <b id="n-pending">0</b></span>
    <span>합계 <b id="n-all">0</b></span>
    <span class="filters">
      <button data-filter="picked" aria-pressed="true">절이 뽑힌 것</button>
      <button data-filter="all" aria-pressed="false">전체</button>
      <button data-filter="pending" aria-pressed="false">미판정</button>
      <button data-filter="bad" aria-pressed="false">틀리다</button>
      <button data-filter="ok" aria-pressed="false">맞다</button>
      <button id="export" class="export">내보내기</button>
    </span>
  </div>
</header>
<main id="list"></main>
</div>
<footer><span>판정은 이 브라우저에 남는다 — 나눠 봐도 이어진다</span><span>다 보면 「내보내기」를 눌러 파일을 전달한다</span></footer>

<script>
const DATA = JSON.parse(${JSON.stringify(data)});
const KEY = 'gift-ability-verdicts-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
let V = load();
// 파일에 이미 있던 판정을 초깃값으로 — 다른 기계에서 이어받을 수 있게
for (const g of DATA.gifts) if (g.seeded && !V[g.id]) V[g.id] = { state: g.seeded, why: g.why || '' };
const save = () => localStorage.setItem(KEY, JSON.stringify(V));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
let filter = 'picked';

const TIMING_KO = {
  combat_start: '전투 시작 시', turn_start: '턴 시작 시', turn_end: '턴 종료 시',
  on_use: '스킬 사용 시', on_hit: '적중 시', on_kill: '처치 시', on_clash: '합 시',
  floor_start: '층·스테이지 시작 시', none: '시점 표지 없음', other: '어휘 밖 시점',
};
const SCOPE_KO = {
  field: '출격 7인', roster: '편성 12인', waiting: '대기 5인',
  slot: '그 자리', enemy: '적', none: '',
};

/** 조건 하나를 사람 문장으로 — 「편성 12인 중에 약지 소속이 한 명이라도 있어야 한다」 */
function condSentence(c) {
  const label = (DATA.labels[c.refKind] || {})[c.refId] || c.refId;
  const kindKo = {
    axis: '을(를) 주는 인격', association: ' 소속 인격', unit_keyword: ' 인격',
    sin: ' 속성 스킬 보유자', resonance: ' 속성 스킬 보유자',
    attack_type: ' 스킬 보유자', skill_kind: ' 스킬 보유자', coin: ' 보유자',
  }[c.refKind];

  if (c.refKind === 'other') return '조건을 어휘로 못 담았다 — 원문: 「' + esc(c.refId) + '」';
  if (c.refKind === 'deployment') return '편성 자리 조건';
  if (c.refKind === 'enemy_state') return '적 상태 조건 — ' + esc(c.refId);

  const who = '<b>' + esc(label) + '</b>' + (kindKo || '');
  const where = SCOPE_KO[c.scope] || c.scope;
  const slotPart = c.scope === 'slot' ? '<b>' + c.slot + '번 자리</b>의 인격이 ' : '';
  const howMany = c.op === 'has'
    ? '<b>한 명이라도</b> 있어야 한다'
    : c.op === 'eq'
      ? '<b>정확히 ' + c.threshold + '명</b>이어야 한다'
      : c.threshold === null
        ? '있어야 한다 <span class="rt">(몇 명인지 못 찾았다)</span>'
        : '<b>' + c.threshold + '명 이상</b> 있어야 한다';

  const supplyNote = c.supply === 'skill'
    ? ' <span class="sub">— 태그가 아니라 <b>실제로 그 스킬을 가진</b> 인격으로 센다</span>'
    : '';
  const resoNote = c.resonanceMode === 'absolute'
    ? ' <span class="sub">— <b>완전 공명</b>은 슬롯에서 연속 3개 이상이라야 선다</span>'
    : c.resonanceMode === 'activate'
      ? ' <span class="sub">— 일반 공명</span>' : '';
  const pool = DATA.supplyN[c.refKind + '/' + c.refId];
  const poolNote = pool !== undefined
    ? ' <span class="sub">(게임 전체에 ' + pool + '명)</span>' : '';
  const rtNote = c.runtime
    ? ' <span class="rt">— 전투 중에만 아는 조건이라 편성만 보고 배제하지 않는다</span>' : '';

  return (slotPart !== '' ? slotPart : (where ? esc(where) + ' 중에 ' : '')) +
    who + '이(가) ' + howMany + poolNote + supplyNote + resoNote + rtNote;
}

function condLine(c, many) {
  const raw = c.refKind + '/' + c.refId + ' ' + c.op +
    (c.threshold === null ? '' : ' ' + c.threshold) +
    ' · ' + c.scope + ' · ' + c.supply +
    (c.slot === null ? '' : ' · slot ' + c.slot) +
    (c.resonanceMode ? ' · ' + c.resonanceMode : '') + (c.runtime ? ' · runtime' : '');
  return '<div class="cond">' + (many ? '<span class="or">또는</span> ' : '') +
    condSentence(c) + '<div class="raw">' + esc(raw) + '</div></div>';
}

function abilityBlock(a) {
  const head = '<div class="hd"><b>절 ' + (a.ordinal + 1) + '</b>' +
    '<span>' + esc(TIMING_KO[a.timing] || a.timing) + '</span>' +
    (a.level > 0 ? '<span>강화 ' + a.level + '단계</span>' : '') +
    (a.refines === null ? '' : '<span class="rt">절 ' + (a.refines + 1) + '의 강화판 — 그 절이 죽으면 같이 죽는다</span>') +
    '</div>';
  const src = '<div class="src">' + esc(a.sourceText) + '</div>';

  let conds;
  if (a.unconditional) {
    conds = '<div class="verdict-line ok-line">조건이 없다 — <b>편성과 무관하게 언제나 돈다</b>. ' +
      '이 절 하나만으로도 기프트는 켜진다</div>';
  } else if (a.conds.length === 0) {
    conds = '<div class="none">조건이 있다고 적혔는데 <b>하나도 못 뽑았다</b> — 결손이다</div>';
  } else {
    // group 이 여럿이면 group 끼리는 그리고, 같은 group 안은 또는
    const byGroup = new Map();
    for (const c of a.conds) byGroup.set(c.group, [...(byGroup.get(c.group) || []), c]);
    const groups = [...byGroup.entries()].sort((x, y) => x[0] - y[0]);
    const head2 = groups.length > 1
      ? '<div class="verdict-line">아래 <b>' + groups.length + '가지가 전부</b> 서야 이 절이 돈다 (그리고)</div>'
      : '';
    conds = head2 + groups.map(([, list]) =>
      '<div class="grp">' +
      (list.length > 1 ? '<div class="verdict-line">아래 중 <b>하나만</b> 서면 된다 (또는)</div>' : '') +
      list.map((c, i) => condLine(c, list.length > 1 && i > 0)).join('') +
      '</div>').join('');
  }

  const note = a.note ? '<div class="note">왜 이렇게 봤나 · ' + esc(a.note) + '</div>' : '';
  const warn = a.problems.map((p) => '<div class="warn">⚠ ' + esc(p) + '</div>').join('');
  return '<div class="ab">' + head + src + conds + note + warn + '</div>';
}

/** 기프트 한 줄 요약 — 「절 셋 중 하나라도 서면 켜진다」 */
function summary(g) {
  const indep = g.abilities.filter((a) => a.refines === null);
  if (indep.length === 0) return '';
  const uncond = indep.filter((a) => a.unconditional).length;
  const txt = uncond > 0
    ? '조건 없는 절이 ' + uncond + '개 있으므로 <b>이 기프트는 언제나 켜진다</b>'
    : '독립된 절 ' + indep.length + '개 중 <b>하나라도 서면 켜진다</b>. 전부 안 서면 죽는다';
  return '<div class="summary">' + txt + '</div>';
}

function card(g) {
  const v = V[g.id] || {};
  const cls = v.state === 'ok' ? ' v-ok' : v.state === 'bad' ? ' v-bad' : '';
  const stages = g.stages.map((s) =>
    '<div><div class="lbl">강화 ' + s.level + '단계 설명문</div><pre>' + esc(s.desc) + '</pre></div>').join('');
  const abilities = g.abilities.length > 0
    ? summary(g) + g.abilities.map(abilityBlock).join('')
    : '<div class="none">뽑힌 절이 없다 — 아직 안 뽑혔거나 추출이 빠뜨렸다</div>';
  return '<article class="gift' + cls + '" id="g-' + g.id + '">' +
    '<div class="top"><h2>' + esc(g.name) + '<em>' + g.id + '</em></h2>' +
    (g.priority ? '<span class="flag">두 판 어긋남</span>' : '') + '</div>' +
    '<div class="body">' + stages +
      '<div><div class="lbl">설명문을 이렇게 절로 나눴다</div>' + abilities + '</div>' +
    '</div>' +
    '<div class="verdict">' +
      '<button class="y" data-v="ok" data-g="' + g.id + '" aria-pressed="' + (v.state === 'ok') + '">맞다</button>' +
      '<button class="n" data-v="bad" data-g="' + g.id + '" aria-pressed="' + (v.state === 'bad') + '">틀리다</button>' +
      '<span class="hint">같은 것을 다시 누르면 미판정으로 돌아간다</span>' +
      (v.state === 'bad'
        ? '<div class="whybox">' +
            '<div class="whylbl">무엇이 틀렸나 <span>— 안 적어도 된다. 적으면 고칠 때 바로 쓴다</span></div>' +
            '<textarea class="why" data-g="' + g.id + '" rows="3" ' +
              'placeholder="예) 2문단은 소속 조건이 아니다 · 「우선으로 지정」을 조건으로 읽었다 · 절을 하나로 합쳐야 한다 · 문턱값이 3이 아니라 5다">' +
              esc(v.why || '') + '</textarea>' +
            '<div class="whyfoot" data-count="' + g.id + '">' + (v.why || '').length + '자 · 내보내기에 함께 담긴다</div>' +
          '</div>'
        : '') +
    '</div></article>';
}

function tally() {
  const n = { ok: 0, bad: 0, pending: 0 };
  let withWhy = 0;
  for (const g of DATA.gifts) {
    const v = V[g.id] || {};
    n[v.state || 'pending'] += 1;
    if (v.state === 'bad' && (v.why || '').trim() !== '') withWhy += 1;
  }
  document.getElementById('n-ok').textContent = n.ok;
  document.getElementById('n-bad').textContent = n.bad;
  document.getElementById('n-pending').textContent = n.pending;
  document.getElementById('n-all').textContent = DATA.gifts.length;
  document.getElementById('n-why').textContent = withWhy + ' / ' + n.bad;
  const t = DATA.gifts.length || 1;
  document.querySelector('.b-ok').style.width = (n.ok / t * 100) + '%';
  document.querySelector('.b-bad').style.width = (n.bad / t * 100) + '%';
}

function shownGifts() {
  if (filter === 'all') return DATA.gifts;
  if (filter === 'picked') return DATA.gifts.filter((g) => g.abilities.length > 0);
  return DATA.gifts.filter((g) => ((V[g.id] || {}).state || 'pending') === filter);
}

function render() {
  document.getElementById('list').innerHTML = shownGifts().map(card).join('');
  tally();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    for (const x of document.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  if (b.dataset.v) {
    const g = b.dataset.g;
    const prev = (V[g] || {}).state;
    // 같은 것을 다시 누르면 미판정으로 되돌린다 — 잘못 누른 것을 물릴 수 있어야 한다
    if (prev === b.dataset.v) delete V[g];
    else V[g] = { state: b.dataset.v, why: (V[g] || {}).why || '' };
    save();
    if (filter === 'all' || filter === 'picked') {
      // 카드 하나만 갈아끼운다 — 전체를 다시 그리면 스크롤이 튄다
      const el = document.getElementById('g-' + g);
      const box = document.createElement('div');
      box.innerHTML = card(DATA.gifts.find((x) => x.id === g));
      el.replaceWith(box.firstElementChild);
      tally();
    } else render();
    return;
  }
  if (b.id === 'export') exportVerdicts();
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.classList.contains('why')) return;
  const g = t.dataset.g;
  if (!V[g]) return;
  V[g].why = t.value;
  save();
  // 적힌 것이 저장됐다는 신호 — 내보내기를 눌러야 반영되는 줄 알면 안 된다
  const foot = document.querySelector('[data-count="' + g + '"]');
  if (foot) foot.textContent = t.value.length + '자 · 저장됨 · 내보내기에 함께 담긴다';
  tally();
});

async function exportVerdicts() {
  const payload = { round: DATA.round, exportedAt: new Date().toISOString(), verdicts: V };
  const text = JSON.stringify(payload, null, '\\t');
  if (window.claude && window.claude.downloads) {
    try {
      await window.claude.downloads.save({ filename: 'gift-verdicts.json', data: text });
      return;
    } catch (err) {
      // 사용자가 거절했거나 저장이 막혔다. 아래 대체 경로로 간다
    }
  }
  const w = window.open('', '_blank');
  if (w) { w.document.write('<pre>' + esc(text) + '</pre>'); w.document.close(); }
  else alert('내려받기가 막혔다. 브라우저 콘솔에서 localStorage 를 복사해라.');
}

render();
</script>`;
}
