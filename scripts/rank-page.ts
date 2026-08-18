/**
 * 표본 수집 페이지 — 기프트를 네 칸에 던진다.
 *
 * **설명문 전문을 보여야 한다.** 이름과 등급만으로는 「달의 기억」이 얼마나
 * 센지 알 수 없다.
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막힌다. CSS·JS 를
 * 인라인한다.
 *
 * 실행: npm run rank:page -- --out /tmp/rank.html
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
// 「None」을 막는 자리는 하나여야 한다 — 페이지와 진단 줄이 따로 가지면 한쪽만 샌다
import { keywordLabel } from './rank/fit.js';

interface Card {
	giftId: string; name: string; desc: string;
	tier: number | null; keywordId: string | null; exclusive: boolean; fireable: boolean;
}
interface Deck {
	id: string; name: string; roster: string[];
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]> };
	cards: Card[];
}

const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
	const i = argv.indexOf(k);
	return i >= 0 ? String(argv[i + 1]) : d;
};
// 후보 셋은 저작 자리에서 읽는다 — 페이지가 보여 준 카드와 저울추가 쓴 카드가
// 같은 파일에서 나와야 판정의 뜻이 흔들리지 않는다
const input = arg('--in', 'src/v2/authored/gift-rank-candidates.json');
const out = arg('--out', '/tmp/rank.html');

const { decks } = JSON.parse(readFileSync(input, 'utf8')) as { decks: Deck[] };
const total = decks.reduce((s, d) => s + d.cards.length, 0);

/**
 * 이 후보 셋의 지문. **저장 열쇠에 섞는다.**
 *
 * 열쇠가 고정이면 `rank:deck` 을 다시 돌린 뒤에도 옛 판정이 되살아난다 — 덱은
 * 그대로인데 축 공급이 바뀌어 뜻이 달라진 카드에 옛 판정이 조용히 다시 붙는
 * 것이라, `cleanRows` 가 파일 쪽에서 막는 것과 같은 사고를 화면 쪽에서 낸다.
 * 후보가 바뀌면 열쇠도 바뀌어 빈 화면에서 다시 시작한다.
 */
const stamp = createHash('sha1')
	.update(decks.map((d) => [
		d.id,
		// **공급도 섞는다.** 카드 목록이 그대로여도 축 공급이 7→6 으로 바뀌면 그
		// 카드가 무엇을 뜻하는지가 달라진다 — 지문이 안 바뀌면 그때가 제일 위험하다
		JSON.stringify(d.supply),
		d.cards.map((c) => `${c.giftId}${c.fireable ? '' : '!'}`).join(','),
	].join(':')).join('|'))
	.digest('hex').slice(0, 8);

/**
 * 따옴표까지 막는다 — `data-gift="…"` 처럼 큰따옴표 속성 안에 값이 들어가서,
 * 안 막으면 값 하나가 속성을 깨고 나와 페이지 구조가 무너진다. 지금 데이터에는
 * 따옴표가 없지만 이 페이지는 데이터가 바뀌어도 다시 만들 물건이다.
 */
const esc = (s: string): string => s
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const BUCKETS = [
	{ key: 3, label: '반드시 집는다' },
	{ key: 2, label: '좋다' },
	{ key: 1, label: '보통' },
	{ key: 0, label: '안 집는다' },
];

const page = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>기프트 순위 표본 — ${total}판정</title>
<style>
:root { color-scheme: light dark; --bg:#fff; --fg:#111; --line:#d8d8d8; --muted:#666;
  --card:#fafafa; --dead:#c0392b; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#15171a; --fg:#e8e8e8; --line:#333; --muted:#999; --card:#1d2024; --dead:#e8776a; } }
* { box-sizing: border-box; }
body { margin:0; padding:1.5rem; background:var(--bg); color:var(--fg);
  font: 15px/1.6 ui-sans-serif, system-ui, "Apple SD Gothic Neo", sans-serif; }
h1 { font-size:1.3rem; margin:0 0 .3rem; }
.lead { color:var(--muted); margin:0 0 1.5rem; max-width:60ch; }
.deck { border:1px solid var(--line); border-radius:8px; margin:0 0 2rem; padding:1rem; }
.deck > h2 { font-size:1.05rem; margin:0 0 .2rem; }
.supply { color:var(--muted); font-size:.85rem; margin:0 0 1rem; }
.cols { display:grid; grid-template-columns:repeat(5,1fr); gap:.6rem; align-items:start; }
@media (max-width:1000px) { .cols { grid-template-columns:1fr; } }
.col { border:1px dashed var(--line); border-radius:6px; padding:.5rem; min-height:6rem; }
/* 판정 칸은 화면에 붙어 따라온다. 덱 하나가 화면 두 개 반 높이(3,100px)라
   안 붙이면 열다섯째 카드를 보이지도 않는 칸으로 끌어야 한다 */
.col[data-bucket]:not([data-bucket="none"]) {
  position:sticky; top:.6rem; background:var(--bg); z-index:2;
  max-height:calc(100vh - 6rem); overflow-y:auto; }
.col > h3 { font-size:.85rem; margin:0 0 .5rem; color:var(--muted);
  text-transform:none; letter-spacing:.02em; }
.card { border:1px solid var(--line); border-radius:5px; background:var(--card);
  padding:.5rem; margin:0 0 .5rem; cursor:grab; }
.card.dead { border-color:var(--dead); }
.card > .nm { font-weight:600; }
.card > .tag { color:var(--muted); font-size:.8rem; margin:.15rem 0 .35rem; }
.card > .ds { font-size:.82rem; white-space:pre-wrap; color:var(--fg); opacity:.85; }
.bar { position:sticky; bottom:0; background:var(--bg); border-top:1px solid var(--line);
  padding:.8rem 0; margin-top:1rem; display:flex; gap:.6rem; align-items:center; }
button { font:inherit; padding:.4rem .9rem; border:1px solid var(--line);
  border-radius:5px; background:var(--card); color:var(--fg); cursor:pointer; }
#count { color:var(--muted); }
textarea { width:100%; height:11rem; margin-top:.6rem; font:12px/1.5 ui-monospace, monospace;
  background:var(--card); color:var(--fg); border:1px solid var(--line); border-radius:5px;
  padding:.5rem; }
</style></head><body>
<h1>기프트 순위 표본 — ${total}판정</h1>
<p class="lead">기프트를 네 칸 중 하나로 끌어다 놓으세요. <strong>칸 안의 순서는 안 봅니다.</strong>
붉은 테두리는 이 편성에서 <strong>안 켜지는</strong> 기프트입니다 — 그것도 판정해 주셔야
「안 켜지면 뺀다」는 지금 규칙이 옳은지 정해집니다.<br>
<strong>판정은 이 브라우저에 자동 저장됩니다</strong> — 새로고침해도 그대로입니다.</p>
${decks.map((d) => `
<section class="deck" data-deck="${esc(d.id)}">
  <h2>덱 ${esc(d.id)} · ${esc(d.name)}</h2>
  <p class="supply">축 ${d.supply.axis.map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '없음'}
    &nbsp;|&nbsp; 공격 ${d.supply.attackType.map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '없음'}</p>
  <div class="cols">
    <div class="col" data-bucket="none"><h3>아직 안 정함</h3>
      ${d.cards.map((c) => `
      <div class="card${c.fireable ? '' : ' dead'}" draggable="true" data-gift="${esc(c.giftId)}">
        <div class="nm">${esc(c.name)}</div>
        <div class="tag">${c.tier === null ? 'EX' : `${c.tier}등급`} ·
          ${esc(keywordLabel(c.keywordId))} · ${c.exclusive ? '전용' : '공용'}${c.fireable ? '' : ' · 안 켜짐'}</div>
        <div class="ds">${esc(c.desc)}</div>
      </div>`).join('')}
    </div>
    ${BUCKETS.map((b) => `<div class="col" data-bucket="${b.key}"><h3>${b.label}</h3></div>`).join('')}
  </div>
</section>`).join('')}
<div class="bar">
  <button id="export">내보내기</button>
  <span id="count"></span>
</div>
<textarea id="outbox" readonly placeholder="내보내기를 누르면 여기에 나옵니다"></textarea>
<script>
let dragged = null;
for (const c of document.querySelectorAll('.card')) {
  c.addEventListener('dragstart', (e) => {
    dragged = c;
    // Firefox 는 dragstart 에서 setData 를 안 부르면 끌기가 아예 시작 안 된다.
    // 값은 안 쓰지만 이게 없으면 그 브라우저에서 페이지가 통째로 먹통이 된다
    if (e.dataTransfer !== null) e.dataTransfer.setData('text/plain', c.dataset.gift);
  });
}
for (const col of document.querySelectorAll('.col')) {
  col.addEventListener('dragover', (e) => { e.preventDefault(); });
  col.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragged !== null) { col.appendChild(dragged); dragged = null; tally(); save(); }
  });
}
function tally() {
  let done = 0;
  for (const col of document.querySelectorAll('.col')) {
    if (col.dataset.bucket === 'none') continue;
    done += col.querySelectorAll('.card').length;
  }
  document.getElementById('count').textContent = done + ' / ${total} 판정';
}
document.getElementById('export').addEventListener('click', () => {
  const lines = [];
  for (const sec of document.querySelectorAll('.deck')) {
    for (const col of sec.querySelectorAll('.col')) {
      const b = col.dataset.bucket;
      if (b === 'none') continue;
      for (const card of col.querySelectorAll('.card')) {
        lines.push(JSON.stringify({ deck: sec.dataset.deck, giftId: card.dataset.gift, bucket: Number(b) }));
      }
    }
  }
  const box = document.getElementById('outbox');
  box.value = lines.join('\\n');
  box.select();
});
// 판정을 브라우저에 남긴다. 새로고침 한 번에 60판정이 날아가면 다시 하는 수밖에
// 없는데, **두 번째 판정은 첫 번째의 기억에 오염된다** — 표본의 독립성이 상한다
const KEY = 'gift-rank-v1-${stamp}';
function save() {
  const at = {};
  for (const sec of document.querySelectorAll('.deck')) {
    for (const col of sec.querySelectorAll('.col')) {
      for (const card of col.querySelectorAll('.card')) {
        at[sec.dataset.deck + '\\t' + card.dataset.gift] = col.dataset.bucket;
      }
    }
  }
  try { localStorage.setItem(KEY, JSON.stringify(at)); } catch (e) { /* 사파리 비공개 창 */ }
}
function restore() {
  let at = null;
  try { at = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { at = null; }
  if (at === null) return;
  for (const sec of document.querySelectorAll('.deck')) {
    for (const card of sec.querySelectorAll('.card')) {
      const b = at[sec.dataset.deck + '\\t' + card.dataset.gift];
      if (b === undefined) continue;
      const col = sec.querySelector('.col[data-bucket="' + b + '"]');
      if (col !== null) col.appendChild(card);
    }
  }
}
restore();
tally();
</script>
</body></html>`;

writeFileSync(out, page, 'utf8');
console.log(`덱 ${decks.length} · 판정 ${total}`);
console.log(`→ ${out}`);
