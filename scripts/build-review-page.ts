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
const DATA = JSON.stringify({ round: progress.round, gifts })
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
  .cond{font-family:var(--mono);font-size:11.5px;padding:3px 0 3px 12px;
    border-left:2px solid var(--struct);color:var(--text)}
  .cond .rt{color:var(--warn)}
  .none{font-family:var(--mono);font-size:11.5px;color:var(--bad)}
  .warn{font-family:var(--mono);font-size:11.5px;color:var(--bad);margin-top:5px}
  .note{font-size:12.5px;color:var(--dim);margin-top:6px}

  .verdict{display:flex;gap:8px;align-items:center;padding:11px 18px;
    border-top:1px solid var(--line);flex-wrap:wrap}
  .verdict .y[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#fff}
  .verdict .n[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
  .why{width:100%;margin-top:8px;font-family:inherit;font-size:13px;padding:8px 10px;
    border:1px solid var(--line);background:var(--panel-2);color:var(--text);resize:vertical}
  .why:focus-visible{outline:2px solid var(--struct);outline-offset:-1px}
  .hint{font-size:12px;color:var(--faint)}
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

function condLine(c) {
  const th = c.threshold === null ? '' : ' ' + c.threshold;
  const rt = c.runtime ? ' <span class="rt">· 전투 중</span>' : '';
  const sl = c.slot === null ? '' : ' · 자리 ' + c.slot;
  const rm = c.resonanceMode ? ' · ' + c.resonanceMode : '';
  return '<div class="cond">' + esc(c.group + '/' + c.idx) + '  ' +
    esc(c.refKind + '/' + c.refId + ' ' + c.op + th + rm + ' · ' + c.scope + ' · ' + c.supply + sl) + rt + '</div>';
}

function abilityBlock(a) {
  const head = '<div class="hd"><b>[' + a.level + '/' + a.ordinal + ']</b>' +
    '<span>시점 ' + esc(a.timing) + '</span>' +
    '<span>' + (a.unconditional ? '무조건' : '조건부') + '</span>' +
    (a.refines === null ? '' : '<span>강화판 → ' + a.refines + '</span>') + '</div>';
  const src = '<div class="src">' + esc(a.sourceText) + '</div>';
  const conds = a.conds.length > 0
    ? a.conds.map(condLine).join('')
    : (a.unconditional ? '' : '<div class="none">조건 없음 — 결손이다(조건이 있다고 적혔는데 못 뽑았다)</div>');
  const note = a.note ? '<div class="note">note · ' + esc(a.note) + '</div>' : '';
  const warn = a.problems.map((p) => '<div class="warn">⚠ ' + esc(p) + '</div>').join('');
  return '<div class="ab">' + head + src + conds + note + warn + '</div>';
}

function card(g) {
  const v = V[g.id] || {};
  const cls = v.state === 'ok' ? ' v-ok' : v.state === 'bad' ? ' v-bad' : '';
  const stages = g.stages.map((s) =>
    '<div><div class="lbl">강화 ' + s.level + '단계 설명문</div><pre>' + esc(s.desc) + '</pre></div>').join('');
  const abilities = g.abilities.length > 0
    ? g.abilities.map(abilityBlock).join('')
    : '<div class="none">뽑힌 절이 없다 — 아직 안 뽑혔거나 추출이 빠뜨렸다</div>';
  return '<article class="gift' + cls + '" id="g-' + g.id + '">' +
    '<div class="top"><h2>' + esc(g.name) + '<em>' + g.id + '</em></h2>' +
    (g.priority ? '<span class="flag">두 판 어긋남</span>' : '') + '</div>' +
    '<div class="body">' + stages +
      '<div><div class="lbl">뽑힌 절</div>' + abilities + '</div>' +
    '</div>' +
    '<div class="verdict">' +
      '<button class="y" data-v="ok" data-g="' + g.id + '" aria-pressed="' + (v.state === 'ok') + '">맞다</button>' +
      '<button class="n" data-v="bad" data-g="' + g.id + '" aria-pressed="' + (v.state === 'bad') + '">틀리다</button>' +
      '<span class="hint">같은 것을 다시 누르면 미판정으로 돌아간다</span>' +
      (v.state === 'bad'
        ? '<textarea class="why" data-g="' + g.id + '" rows="2" placeholder="선택 — 지금 아는 게 있으면 적어도 된다. 안 적어도 된다">' + esc(v.why || '') + '</textarea>'
        : '') +
    '</div></article>';
}

function tally() {
  const n = { ok: 0, bad: 0, pending: 0 };
  for (const g of DATA.gifts) n[(V[g.id] || {}).state || 'pending'] += 1;
  document.getElementById('n-ok').textContent = n.ok;
  document.getElementById('n-bad').textContent = n.bad;
  document.getElementById('n-pending').textContent = n.pending;
  document.getElementById('n-all').textContent = DATA.gifts.length;
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
  if (V[g]) { V[g].why = t.value; save(); }
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
