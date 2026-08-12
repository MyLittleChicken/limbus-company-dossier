/**
 * 검수 페이지 — **판정 단위는 기프트가 아니라 문형 묶음이다.**
 *
 * 456건을 하나씩 보면 하루가 간다. 같은 문형이면 같은 규칙으로 절을 나눌 수
 * 있으므로, 묶음마다 「이 규칙이 맞나」를 한 번 묻는다. 규칙이 맞으면 그
 * 묶음의 기프트 전부가 그 규칙으로 뽑힌다.
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막히므로 자료를
 * 페이지 안에 넣는다.
 *
 * 판정은 localStorage 에 남고 「내보내기」가 파일을 만든다. 그 파일을
 * `npm run gift:import` 가 받는다.
 *
 * 실행: npm run gift:page -- --out /tmp/gift-review.html
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { SHAPES, shapeKeysOf, ruleTextOf } from './gift-shapes.js';

const PROGRESS = 'src/v2/authored/gift-ability.progress.json';

const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/gift-review.html';

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id
`;

const progress: { round: number; groups?: Record<string, { state: string; why?: string }> } =
	existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')) : { round: 1 };
const seeded = progress.groups ?? {};

/** 문형 조합별로 묶는다. 조합이 곧 판정 단위다 */
const byCombo = new Map<string, Array<{ giftId: string; name: string; desc: string; paras: number }>>();
for (const r of rows) {
	const keys = shapeKeysOf(r.desc);
	const combo = keys.length === 0 ? 'PLAIN' : keys.join('+');
	const paras = r.desc.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '').length;
	byCombo.set(combo, [...(byCombo.get(combo) ?? []), { ...r, paras }]);
}

const groups = [...byCombo.entries()]
	.map(([key, members]) => ({
		key,
		markers: key === 'PLAIN' ? [] : key.split('+'),
		count: members.length,
		rule: ruleTextOf(key === 'PLAIN' ? [] : key.split('+')),
		members,
		seeded: seeded[key]?.state ?? null,
		why: seeded[key]?.why ?? null,
	}))
	.sort((a, b) => b.count - a.count);

const SHAPE_LABEL = Object.fromEntries(SHAPES.map((s) => [s.key, s.label]));

const DATA = JSON.stringify({ round: progress.round, groups, shapeLabel: SHAPE_LABEL })
	.replaceAll('<', '\\u003c')
	.replaceAll(' ', '\\u2028')
	.replaceAll(' ', '\\u2029');

writeFileSync(out, renderPage(DATA), 'utf8');
const big = groups.filter((g) => g.count >= 5);
console.log(`기프트 ${rows.length} · 문형 묶음 ${groups.length}가지`);
console.log(`  5건 이상 ${big.length}가지가 ${big.reduce((s, g) => s + g.count, 0)}건을 덮는다`);
console.log(`→ ${out}`);

await prisma.$disconnect();
process.exit(0);

function renderPage(data: string): string {
	return `<title>기프트 문형 검수</title>
<style>
  :root {
    --panel:#fff; --panel-2:#f6f6f4; --line:#dddcd6; --ink:#0e1116;
    --text:#1a1e25; --dim:#666e7a; --faint:#9aa1ab;
    --ok:#2f7f6f; --bad:#b4423a; --warn:#b07d22; --struct:#4f5f92;
    --ok-bg:#e7f3f0; --bad-bg:#fbeceb; --warn-bg:#fbf3e3; --struct-bg:#eef0f7;
    --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{
    --panel:#14181e; --panel-2:#0f1318; --line:#29303a; --ink:#f2f1ee;
    --text:#e6e7ea; --dim:#939aa5; --faint:#6b737e;
    --ok:#5fb8a5; --bad:#e0736a; --warn:#d9a545; --struct:#8e9dd0;
    --ok-bg:#16261f; --bad-bg:#2b1a19; --warn-bg:#2a2216; --struct-bg:#1b2030;}}
  :root[data-theme="dark"]{
    --panel:#14181e; --panel-2:#0f1318; --line:#29303a; --ink:#f2f1ee;
    --text:#e6e7ea; --dim:#939aa5; --faint:#6b737e;
    --ok:#5fb8a5; --bad:#e0736a; --warn:#d9a545; --struct:#8e9dd0;
    --ok-bg:#16261f; --bad-bg:#2b1a19; --warn-bg:#2a2216; --struct-bg:#1b2030;}
  :root[data-theme="light"]{
    --panel:#fff; --panel-2:#f6f6f4; --line:#dddcd6; --ink:#0e1116;
    --text:#1a1e25; --dim:#666e7a; --faint:#9aa1ab;
    --ok:#2f7f6f; --bad:#b4423a; --warn:#b07d22; --struct:#4f5f92;
    --ok-bg:#e7f3f0; --bad-bg:#fbeceb; --warn-bg:#fbf3e3; --struct-bg:#eef0f7;}

  body{background:var(--panel-2);color:var(--text);font-family:var(--sans);
    line-height:1.6;margin:0;padding:0 16px 100px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:900px;margin:0 auto}
  h1{font-size:23px;margin:0;letter-spacing:-.02em}
  button{font-family:inherit;font-size:12.5px;padding:5px 11px;border:1px solid var(--line);
    background:var(--panel);color:var(--text);cursor:pointer;border-radius:2px}
  button:hover{border-color:var(--dim)}
  button[aria-pressed="true"]{background:var(--ink);color:var(--panel-2);border-color:var(--ink)}
  button:focus-visible{outline:2px solid var(--struct);outline-offset:2px}

  header{position:sticky;top:0;z-index:10;background:var(--panel-2);
    border-bottom:2px solid var(--ink);padding:15px 0 10px;margin-bottom:16px}
  .lede{font-size:13px;color:var(--dim);margin:6px 0 0}
  .bar{height:6px;background:var(--line);margin:10px 0 8px;display:flex;overflow:hidden}
  .bar i{display:block;height:100%}
  .bar .b-ok{background:var(--ok)} .bar .b-bad{background:var(--bad)}
  .tally{display:flex;gap:14px;font-family:var(--mono);font-size:12px;color:var(--dim);
    font-variant-numeric:tabular-nums;flex-wrap:wrap;align-items:center}
  .tally b{font-weight:700} .t-ok b{color:var(--ok)} .t-bad b{color:var(--bad)}
  .filters{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
  .export{border-color:var(--struct);color:var(--struct);font-weight:600}

  /* 묶음 카드 */
  .grp{background:var(--panel);border:1px solid var(--line);margin-bottom:12px}
  .grp.v-ok{border-left:4px solid var(--ok)} .grp.v-bad{border-left:4px solid var(--bad)}
  .grp > .top{padding:13px 18px;display:flex;align-items:center;gap:11px;flex-wrap:wrap;
    border-bottom:1px solid var(--line)}
  .n{font-family:var(--mono);font-size:21px;font-weight:700;font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;min-width:52px}
  .n span{font-size:11px;font-weight:400;color:var(--faint);margin-left:2px}
  .marks{display:flex;gap:4px;flex-wrap:wrap;flex:1}
  .mk{font-family:var(--mono);font-size:10px;letter-spacing:.06em;padding:2px 7px;
    background:var(--struct-bg);color:var(--struct);border-radius:2px}
  .mk.plain{background:var(--panel-2);color:var(--faint)}
  .acts{display:flex;gap:6px}
  .acts .y[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#fff}
  .acts .n2[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}

  .body{padding:14px 18px 16px}
  .rule{background:var(--struct-bg);border-left:3px solid var(--struct);padding:11px 14px;
    font-size:13.5px;margin-bottom:13px}
  .rule .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--struct);margin-bottom:6px}
  .rule ul{margin:0;padding-left:18px} .rule li{margin:3px 0}
  .rule b{font-weight:680}

  .lbl2{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--faint);margin:12px 0 6px}
  .samp{border:1px solid var(--line);background:var(--panel-2);margin-bottom:7px}
  .samp .hd{font-size:12.5px;font-weight:650;padding:7px 12px;border-bottom:1px solid var(--line)}
  .samp .hd em{font-family:var(--mono);font-style:normal;font-size:10px;color:var(--faint);
    font-weight:400;margin-left:5px}
  .samp pre{margin:0;padding:10px 12px;font-family:var(--mono);font-size:11.5px;line-height:1.65;
    white-space:pre-wrap;word-break:break-word;color:var(--text);background:none;border:0;
    overflow-x:auto}
  .more{font-size:12px;color:var(--struct);background:none;border:0;padding:4px 0;cursor:pointer;
    text-decoration:underline}
  .names{font-size:12.5px;color:var(--dim);line-height:1.9}
  .names code{font-family:var(--mono);font-size:10.5px;color:var(--faint)}

  .whybox{margin-top:12px;border:1px solid var(--bad);border-left-width:3px;
    background:var(--bad-bg);padding:9px 12px}
  .whylbl{font-size:12.5px;font-weight:650;color:var(--bad);margin-bottom:6px}
  .whylbl span{font-weight:400;color:var(--dim)}
  .why{width:100%;box-sizing:border-box;font-family:inherit;font-size:13px;padding:8px 10px;
    border:1px solid var(--line);background:var(--panel);color:var(--text);resize:vertical;
    line-height:1.55}
  .why:focus-visible{outline:2px solid var(--bad);outline-offset:-1px}
  .whyfoot{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:5px}

  footer{position:fixed;left:0;right:0;bottom:0;background:var(--panel);
    border-top:1px solid var(--line);padding:9px 16px;font-family:var(--mono);font-size:11.5px;
    color:var(--dim);display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
</style>

<div class="wrap">
<header>
  <h1>기프트 문형 검수</h1>
  <p class="lede">같은 문형이면 같은 규칙으로 절을 나눈다. <b>묶음마다 규칙이 맞는지만</b> 봐 주면 된다 — 기프트를 하나씩 볼 필요가 없다.</p>
  <div class="bar"><i class="b-ok"></i><i class="b-bad"></i></div>
  <div class="tally">
    <span class="t-ok">맞다 <b id="n-ok">0</b></span>
    <span class="t-bad">틀리다 <b id="n-bad">0</b></span>
    <span>미판정 <b id="n-pending">0</b></span>
    <span>덮은 기프트 <b id="n-cov">0</b></span>
    <span class="filters">
      <button data-filter="big" aria-pressed="true">5건 이상</button>
      <button data-filter="all" aria-pressed="false">전체</button>
      <button data-filter="pending" aria-pressed="false">미판정</button>
      <button data-filter="bad" aria-pressed="false">틀리다</button>
      <button id="export" class="export">내보내기</button>
    </span>
  </div>
</header>
<main id="list"></main>
</div>
<footer><span>판정 단위는 문형 묶음이다</span><span>판정은 이 브라우저에 남는다</span><span>다 보면 「내보내기」</span></footer>

<script>
const DATA = JSON.parse(${JSON.stringify(data)});
const KEY = 'gift-shape-verdicts-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
let V = load();
for (const g of DATA.groups) if (g.seeded && !V[g.key]) V[g.key] = { state: g.seeded, why: g.why || '' };
const save = () => localStorage.setItem(KEY, JSON.stringify(V));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
let filter = 'big';
const opened = new Set();

function sample(m) {
  return '<div class="samp"><div class="hd">' + esc(m.name) + '<em>' + m.giftId +
    ' · 문단 ' + m.paras + '</em></div><pre>' + esc(m.desc) + '</pre></div>';
}

function card(g) {
  const v = V[g.key] || {};
  const cls = v.state === 'ok' ? ' v-ok' : v.state === 'bad' ? ' v-bad' : '';
  const marks = g.markers.length === 0
    ? '<span class="mk plain">조건 표지 없음</span>'
    : g.markers.map((k) => '<span class="mk" title="' + esc(DATA.shapeLabel[k] || k) + '">' + esc(k) + '</span>').join('');

  const showAll = opened.has(g.key);
  const shown = showAll ? g.members : g.members.slice(0, 3);
  const samples = shown.map(sample).join('') +
    (g.members.length > 3
      ? '<button class="more" data-more="' + esc(g.key) + '">' +
        (showAll ? '접기' : '나머지 ' + (g.members.length - 3) + '건 설명문 펴기') + '</button>'
      : '');

  const names = g.members.map((m) => esc(m.name) + ' <code>' + m.giftId + '</code>').join(' · ');

  return '<article class="grp' + cls + '" id="k-' + encodeURIComponent(g.key) + '">' +
    '<div class="top">' +
      '<div class="n">' + g.count + '<span>건</span></div>' +
      '<div class="marks">' + marks + '</div>' +
      '<div class="acts">' +
        '<button class="y" data-v="ok" data-k="' + esc(g.key) + '" aria-pressed="' + (v.state === 'ok') + '">맞다</button>' +
        '<button class="n2" data-v="bad" data-k="' + esc(g.key) + '" aria-pressed="' + (v.state === 'bad') + '">틀리다</button>' +
      '</div>' +
    '</div>' +
    '<div class="body">' +
      '<div class="rule"><div class="lbl">이 묶음에 적용할 규칙</div><ul>' +
        g.rule.map((r) => '<li>' + r + '</li>').join('') +
      '</ul></div>' +
      '<div class="lbl2">설명문 ' + (showAll ? g.members.length : Math.min(3, g.members.length)) + ' / ' + g.members.length + '</div>' +
      samples +
      '<div class="lbl2">이 묶음의 기프트</div><div class="names">' + names + '</div>' +
      (v.state === 'bad'
        ? '<div class="whybox">' +
            '<div class="whylbl">규칙의 무엇이 틀렸나 <span>— 안 적어도 된다. 적으면 고칠 때 바로 쓴다</span></div>' +
            '<textarea class="why" data-k="' + esc(g.key) + '" rows="3" ' +
              'placeholder="예) 이 문형은 절을 하나로 봐야 한다 · 하위 불릿도 조건이다 · 티어 미달이면 앞 절도 죽는다">' +
              esc(v.why || '') + '</textarea>' +
            '<div class="whyfoot" data-count="' + esc(g.key) + '">' + (v.why || '').length + '자 · 내보내기에 함께 담긴다</div>' +
          '</div>'
        : '') +
    '</div></article>';
}

function tally() {
  let ok = 0, bad = 0, pending = 0, cov = 0;
  for (const g of DATA.groups) {
    const st = (V[g.key] || {}).state || 'pending';
    if (st === 'ok') { ok += 1; cov += g.count; }
    else if (st === 'bad') bad += 1;
    else pending += 1;
  }
  const total = DATA.groups.reduce((s, g) => s + g.count, 0);
  document.getElementById('n-ok').textContent = ok;
  document.getElementById('n-bad').textContent = bad;
  document.getElementById('n-pending').textContent = pending;
  document.getElementById('n-cov').textContent = cov + ' / ' + total;
  document.querySelector('.b-ok').style.width = (cov / (total || 1) * 100) + '%';
  const badCov = DATA.groups.filter((g) => (V[g.key] || {}).state === 'bad').reduce((s, g) => s + g.count, 0);
  document.querySelector('.b-bad').style.width = (badCov / (total || 1) * 100) + '%';
}

function shown() {
  if (filter === 'all') return DATA.groups;
  if (filter === 'big') return DATA.groups.filter((g) => g.count >= 5);
  return DATA.groups.filter((g) => ((V[g.key] || {}).state || 'pending') === filter);
}

function render() {
  document.getElementById('list').innerHTML = shown().map(card).join('');
  tally();
}

function redrawOne(key) {
  const el = document.getElementById('k-' + encodeURIComponent(key));
  const g = DATA.groups.find((x) => x.key === key);
  if (!el || !g) { render(); return; }
  const box = document.createElement('div');
  box.innerHTML = card(g);
  el.replaceWith(box.firstElementChild);
  tally();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    for (const x of document.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));
    render(); window.scrollTo({ top: 0 }); return;
  }
  if (b.dataset.more) {
    const k = b.dataset.more;
    if (opened.has(k)) opened.delete(k); else opened.add(k);
    redrawOne(k); return;
  }
  if (b.dataset.v) {
    const k = b.dataset.k;
    const prev = (V[k] || {}).state;
    if (prev === b.dataset.v) delete V[k];
    else V[k] = { state: b.dataset.v, why: (V[k] || {}).why || '' };
    save();
    if (filter === 'all' || filter === 'big') redrawOne(k); else render();
    return;
  }
  if (b.id === 'export') exportVerdicts();
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.classList.contains('why')) return;
  const k = t.dataset.k;
  if (!V[k]) return;
  V[k].why = t.value;
  save();
  const foot = document.querySelector('[data-count="' + CSS.escape(k) + '"]');
  if (foot) foot.textContent = t.value.length + '자 · 저장됨 · 내보내기에 함께 담긴다';
});

async function exportVerdicts() {
  const payload = { round: DATA.round, exportedAt: new Date().toISOString(), groups: V };
  const text = JSON.stringify(payload, null, '\\t');
  if (window.claude && window.claude.downloads) {
    try { await window.claude.downloads.save({ filename: 'gift-shape-verdicts.json', data: text }); return; }
    catch (err) { /* 거절했거나 막혔다 — 아래로 간다 */ }
  }
  const w = window.open('', '_blank');
  if (w) { w.document.write('<pre>' + esc(text) + '</pre>'); w.document.close(); }
  else alert('내려받기가 막혔다.');
}

render();
</script>`;
}
