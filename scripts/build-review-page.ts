/**
 * 검수 페이지 — **판정 단위는 기프트가 아니라 문형 묶음이다.**
 *
 * 456건을 하나씩 보면 하루가 간다. 전문을 읽어 세운 여섯 분류(`gift-shapes.ts`)
 * 마다 「이 규칙이 맞나」를 한 번 묻는다. 규칙이 맞으면 그 묶음의 기프트 전부가
 * 그 규칙으로 뽑힌다.
 *
 * 페이지는 두 층이다.
 *   위   분류 기준 — 무엇을 보고 갈랐나
 *   아래 묶음 카드 — 건수 · 절 나누는 규칙 · 틀리기 쉬운 자리 · 대표 설명문 ·
 *        소속 기프트 · 맞다/틀리다
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막힌다.
 *
 * 실행: npm run gift:page -- --out /tmp/gift-review.html
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { classifyGift, CLASSES } from './gift-shapes.js';

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

type Member = { giftId: string; name: string; desc: string; paras: number; traits: string[] };
const byClass = new Map<string, Member[]>();
for (const r of rows) {
	const c = classifyGift(r.desc);
	byClass.set(c.klass, [...(byClass.get(c.klass) ?? []), {
		giftId: r.giftId, name: r.name, desc: r.desc, paras: c.paras, traits: c.traits,
	}]);
}

/**
 * 대표는 **가장 짧은 것 · 가운데 · 가장 긴 것** 셋이다.
 *
 * 첫 세 건을 뽑으면 그 묶음의 폭이 안 보인다 — 문단 둘짜리만 보고 「맞다」를
 * 눌렀는데 같은 묶음에 문단 여덟짜리가 있으면 판정이 헛돈다.
 */
const representatives = (ms: Member[]): string[] => {
	const sorted = [...ms].sort((a, b) => a.paras - b.paras || a.giftId.localeCompare(b.giftId));
	if (sorted.length <= 3) return sorted.map((m) => m.giftId);
	return [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]]
		.map((m) => m.giftId);
};

const groups = CLASSES.map((c) => {
	const members = byClass.get(c.key) ?? [];
	return {
		key: c.key, name: c.name, detect: c.detect, rule: c.rule, watch: c.watch,
		count: members.length,
		reps: representatives(members),
		members,
		seeded: seeded[c.key]?.state ?? null,
		why: seeded[c.key]?.why ?? null,
	};
}).filter((g) => g.count > 0).sort((a, b) => b.count - a.count);

const DATA = JSON.stringify({ round: progress.round, groups, total: rows.length })
	.replaceAll('<', '\\u003c')
	.replaceAll(' ', '\\u2028')
	.replaceAll(' ', '\\u2029');

writeFileSync(out, renderPage(DATA), 'utf8');
console.log(`기프트 ${rows.length} · 분류 ${groups.length}가지`);
for (const g of groups) console.log(`  ${g.key.padEnd(8)} ${String(g.count).padStart(3)}`);
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
    line-height:1.62;margin:0;padding:0 16px 100px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:920px;margin:0 auto}
  h1{font-size:23px;margin:0;letter-spacing:-.02em}
  h2{font-size:17px;margin:0;letter-spacing:-.015em}
  code{font-family:var(--mono);font-size:.92em}
  button{font-family:inherit;font-size:12.5px;padding:5px 11px;border:1px solid var(--line);
    background:var(--panel);color:var(--text);cursor:pointer;border-radius:2px}
  button:hover{border-color:var(--dim)}
  button[aria-pressed="true"]{background:var(--ink);color:var(--panel-2);border-color:var(--ink)}
  button:focus-visible{outline:2px solid var(--struct);outline-offset:2px}

  header{position:sticky;top:0;z-index:10;background:var(--panel-2);
    border-bottom:2px solid var(--ink);padding:14px 0 10px;margin-bottom:18px}
  .lede{font-size:13px;color:var(--dim);margin:5px 0 0}
  .bar{height:6px;background:var(--line);margin:9px 0 8px;display:flex;overflow:hidden}
  .bar i{display:block;height:100%}
  .bar .b-ok{background:var(--ok)} .bar .b-bad{background:var(--bad)}
  .tally{display:flex;gap:14px;font-family:var(--mono);font-size:12px;color:var(--dim);
    font-variant-numeric:tabular-nums;flex-wrap:wrap;align-items:center}
  .tally b{font-weight:700} .t-ok b{color:var(--ok)} .t-bad b{color:var(--bad)}
  .filters{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
  .export{border-color:var(--struct);color:var(--struct);font-weight:600}

  .std{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--ink);
    padding:18px 20px;margin-bottom:26px}
  .std .sub{font-size:13px;color:var(--dim);margin:5px 0 14px}
  .axis{font-size:13.5px;background:var(--panel-2);border:1px solid var(--line);
    padding:11px 14px;margin-bottom:14px}
  .axis b{font-weight:680}
  .std table{border-collapse:collapse;width:100%;font-size:13px}
  .std th,.std td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);
    vertical-align:top}
  .std th{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
    color:var(--faint);font-weight:500;background:var(--panel-2);white-space:nowrap}
  .std td.k{font-family:var(--mono);font-weight:700;color:var(--struct);white-space:nowrap}
  .std td.n{font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:right;
    white-space:nowrap;font-weight:700}

  .grp{background:var(--panel);border:1px solid var(--line);margin-bottom:14px}
  .grp.v-ok{border-left:4px solid var(--ok)} .grp.v-bad{border-left:4px solid var(--bad)}
  .grp > .top{padding:13px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    border-bottom:1px solid var(--line)}
  .cnt{font-family:var(--mono);font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;min-width:54px}
  .cnt span{font-size:11px;font-weight:400;color:var(--faint);margin-left:2px}
  .ttl{flex:1;min-width:200px;font-size:14.5px;font-weight:650}
  .ttl .kk{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--struct);
    background:var(--struct-bg);padding:2px 7px;border-radius:2px;margin-right:7px;font-weight:700}
  .acts{display:flex;gap:6px}
  .acts .y[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#fff}
  .acts .n2[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}

  .body{padding:14px 18px 16px}
  .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--faint);margin:14px 0 6px}
  .lbl:first-child{margin-top:0}
  .box{border:1px solid var(--line);padding:10px 13px;font-size:13.5px;background:var(--panel-2)}
  .box.rule{border-left:3px solid var(--struct)}
  .box.watch{border-left:3px solid var(--warn)}
  .box ul{margin:0;padding-left:18px} .box li{margin:4px 0}
  .box b{font-weight:680}

  .samp{border:1px solid var(--line);background:var(--panel-2);margin-bottom:7px}
  .samp .hd{font-size:12.5px;font-weight:650;padding:7px 12px;border-bottom:1px solid var(--line);
    display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .samp .hd em{font-family:var(--mono);font-style:normal;font-size:10px;color:var(--faint);
    font-weight:400}
  .tr{font-family:var(--mono);font-size:9.5px;color:var(--warn);
    background:var(--warn-bg);padding:1px 6px;border-radius:2px}
  .samp pre{margin:0;padding:10px 12px;font-family:var(--mono);font-size:11.5px;line-height:1.7;
    white-space:pre-wrap;word-break:break-word;color:var(--text);background:none;border:0;
    overflow-x:auto}
  .more{font-size:12px;color:var(--struct);background:none;border:0;padding:4px 0;cursor:pointer;
    text-decoration:underline}
  .names{font-size:12.5px;color:var(--dim);line-height:1.95}
  .names code{font-family:var(--mono);font-size:10.5px;color:var(--faint)}

  .whybox{margin-top:13px;border:1px solid var(--bad);border-left-width:3px;
    background:var(--bad-bg);padding:10px 13px}
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
  <p class="lede">456건을 전문으로 읽고 <b>문단끼리 어떻게 묶이는가</b>로 갈랐다. 묶음마다 <b>규칙이 맞는지만</b> 봐 주면 된다.</p>
  <div class="bar"><i class="b-ok"></i><i class="b-bad"></i></div>
  <div class="tally">
    <span class="t-ok">맞다 <b id="n-ok">0</b></span>
    <span class="t-bad">틀리다 <b id="n-bad">0</b></span>
    <span>미판정 <b id="n-pending">0</b></span>
    <span>덮은 기프트 <b id="n-cov">0</b></span>
    <span class="filters">
      <button data-filter="all" aria-pressed="true">전체</button>
      <button data-filter="pending" aria-pressed="false">미판정</button>
      <button data-filter="bad" aria-pressed="false">틀리다</button>
      <button id="export" class="export">내보내기</button>
    </span>
  </div>
</header>

<section class="std">
  <h2>분류 기준</h2>
  <p class="sub">전문을 읽어 보니 설명문은 예외 없이 <b>문단의 나열</b>이었고, 다른 것은 <b>문단끼리 어떻게 묶이는가</b> 하나뿐이었다. 그 관계가 여섯이다.</p>
  <div class="axis">
    <b>겹치면 절 나누기를 지배하는 쪽으로 넣는다.</b>
    우선순위는 <code>TIER → GATE → HEAD → AMP → INDEP → SINGLE</code> —
    티어가 있으면 티어가 전체 구조를 정하고, 없으면 게이트가, 없으면 머리가, 없으면 강화가 정한다.
    겹친 나머지는 대표 설명문 옆에 <span class="tr">겹침</span> 표지로 보인다.
  </div>
  <table>
    <thead><tr><th>분류</th><th>무엇을 보고 갈랐나</th><th style="text-align:right">건수</th></tr></thead>
    <tbody id="std-rows"></tbody>
  </table>
</section>

<main id="list"></main>
</div>
<footer><span>판정 단위는 문형 묶음</span><span>판정은 이 브라우저에 남는다</span><span>다 보면 「내보내기」</span></footer>

<script>
const DATA = JSON.parse(${JSON.stringify(data)});
const KEY = 'gift-shape-verdicts-v2';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
let V = load();
for (const g of DATA.groups) if (g.seeded && !V[g.key]) V[g.key] = { state: g.seeded, why: g.why || '' };
const save = () => localStorage.setItem(KEY, JSON.stringify(V));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
let filter = 'all';
const opened = new Set();

document.getElementById('std-rows').innerHTML = DATA.groups.map((g) =>
  '<tr><td class="k">' + esc(g.key) + '</td><td>' + esc(g.detect) + '</td><td class="n">' + g.count + '</td></tr>').join('');

function sample(m) {
  const tr = m.traits.map((t) => '<span class="tr">' + esc(t) + ' 겹침</span>').join('');
  return '<div class="samp"><div class="hd"><span>' + esc(m.name) + '</span><em>' + m.giftId +
    ' · 문단 ' + m.paras + '</em>' + tr + '</div><pre>' + esc(m.desc) + '</pre></div>';
}

function card(g) {
  const v = V[g.key] || {};
  const cls = v.state === 'ok' ? ' v-ok' : v.state === 'bad' ? ' v-bad' : '';
  const showAll = opened.has(g.key);
  const reps = showAll ? g.members : g.members.filter((m) => g.reps.includes(m.giftId));
  const samples = reps.map(sample).join('') +
    (g.members.length > 3
      ? '<button class="more" data-more="' + g.key + '">' +
        (showAll ? '접기' : '이 묶음 ' + g.members.length + '건 설명문 전부 펴기') + '</button>'
      : '');
  const names = g.members.map((m) => esc(m.name) + ' <code>' + m.giftId + '</code>').join(' · ');

  return '<article class="grp' + cls + '" id="k-' + g.key + '">' +
    '<div class="top">' +
      '<div class="cnt">' + g.count + '<span>건</span></div>' +
      '<div class="ttl"><span class="kk">' + esc(g.key) + '</span>' + esc(g.name) + '</div>' +
      '<div class="acts">' +
        '<button class="y" data-v="ok" data-k="' + g.key + '" aria-pressed="' + (v.state === 'ok') + '">맞다</button>' +
        '<button class="n2" data-v="bad" data-k="' + g.key + '" aria-pressed="' + (v.state === 'bad') + '">틀리다</button>' +
      '</div>' +
    '</div>' +
    '<div class="body">' +
      '<div class="lbl">절을 이렇게 나눈다</div>' +
      '<div class="box rule"><ul>' + g.rule.map((r) => '<li>' + r + '</li>').join('') + '</ul></div>' +
      '<div class="lbl">이 묶음에서 흔히 틀리는 자리</div>' +
      '<div class="box watch"><ul>' + g.watch.map((r) => '<li>' + r + '</li>').join('') + '</ul></div>' +
      '<div class="lbl">대표 설명문 — 가장 짧은 것 · 가운데 · 가장 긴 것</div>' +
      samples +
      '<div class="lbl">이 묶음의 기프트 ' + g.count + '건</div><div class="names">' + names + '</div>' +
      (v.state === 'bad'
        ? '<div class="whybox">' +
            '<div class="whylbl">규칙의 무엇이 틀렸나 <span>— 안 적어도 된다. 적으면 고칠 때 바로 쓴다</span></div>' +
            '<textarea class="why" data-k="' + g.key + '" rows="3" ' +
              'placeholder="예) 이 분류에 들어가면 안 되는 기프트가 있다 · 게이트가 뒤 문단 전부를 막지는 않는다 · 강화판도 독립으로 켜진다">' +
              esc(v.why || '') + '</textarea>' +
            '<div class="whyfoot" data-count="' + g.key + '">' + (v.why || '').length + '자 · 내보내기에 함께 담긴다</div>' +
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
  document.getElementById('n-ok').textContent = ok;
  document.getElementById('n-bad').textContent = bad;
  document.getElementById('n-pending').textContent = pending;
  document.getElementById('n-cov').textContent = cov + ' / ' + DATA.total;
  document.querySelector('.b-ok').style.width = (cov / DATA.total * 100) + '%';
  const badCov = DATA.groups.filter((g) => (V[g.key] || {}).state === 'bad').reduce((s, g) => s + g.count, 0);
  document.querySelector('.b-bad').style.width = (badCov / DATA.total * 100) + '%';
}

function shown() {
  if (filter === 'all') return DATA.groups;
  return DATA.groups.filter((g) => ((V[g.key] || {}).state || 'pending') === filter);
}
function render() { document.getElementById('list').innerHTML = shown().map(card).join(''); tally(); }
function redrawOne(key) {
  const el = document.getElementById('k-' + key);
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
    if (filter === 'all') redrawOne(k); else render();
    return;
  }
  if (b.id === 'export') exportVerdicts();
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.classList.contains('why')) return;
  const k = t.dataset.k;
  if (!V[k]) return;
  V[k].why = t.value; save();
  const foot = document.querySelector('[data-count="' + k + '"]');
  if (foot) foot.textContent = t.value.length + '자 · 저장됨 · 내보내기에 함께 담긴다';
});

async function exportVerdicts() {
  const payload = { round: DATA.round, exportedAt: new Date().toISOString(), groups: V };
  const text = JSON.stringify(payload, null, '\\t');
  if (window.claude && window.claude.downloads) {
    try { await window.claude.downloads.save({ filename: 'gift-shape-verdicts.json', data: text }); return; }
    catch (err) { /* 거절했거나 막혔다 */ }
  }
  const w = window.open('', '_blank');
  if (w) { w.document.write('<pre>' + esc(text) + '</pre>'); w.document.close(); }
  else alert('내려받기가 막혔다.');
}

render();
</script>`;
}
