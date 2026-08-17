/**
 * 표본 수집 페이지 — 기프트를 네 칸에 던진다.
 *
 * **설명문 전문을 보여야 한다.** 이름과 등급만으로는 「달의 기억」이 얼마나
 * 센지 알 수 없다.
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막힌다. CSS·JS 를
 * 인라인한다.
 *
 * 실행: npm run rank:page -- --in /tmp/rank-candidates.json --out /tmp/rank.html
 */
import { readFileSync, writeFileSync } from 'node:fs';

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
const input = arg('--in', '/tmp/rank-candidates.json');
const out = arg('--out', '/tmp/rank.html');

const { decks } = JSON.parse(readFileSync(input, 'utf8')) as { decks: Deck[] };
const total = decks.reduce((s, d) => s + d.cards.length, 0);

/**
 * 따옴표까지 막는다 — `data-gift="…"` 처럼 큰따옴표 속성 안에 값이 들어가서,
 * 안 막으면 값 하나가 속성을 깨고 나와 페이지 구조가 무너진다. 지금 데이터에는
 * 따옴표가 없지만 이 페이지는 데이터가 바뀌어도 다시 만들 물건이다.
 */
const esc = (s: string): string => s
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * 키워드를 사람이 읽는 말로.
 *
 * **`'None'` 은 문자열이다.** `canonical.gift.keyword_id` 에 JSON `null` 이
 * 아니라 글자 그대로 `None` 이 들어 있는 행이 있고(적재 때 파이썬 `None` 이
 * 글자로 굳은 것으로 보인다), 그대로 두면 60장 중 32장에 「None」이 뜬다.
 * 판정하는 사람에게 보일 자리라 여기서 막는다 — 뿌리(적재)는 이 PR 밖이다.
 */
const keywordLabel = (k: string | null): string =>
	k === null || k === 'None' ? '키워드 없음' : k;

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
「안 켜지면 뺀다」는 지금 규칙이 옳은지 정해집니다.</p>
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
    if (dragged !== null) { col.appendChild(dragged); dragged = null; tally(); }
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
tally();
</script>
</body></html>`;

writeFileSync(out, page, 'utf8');
console.log(`덱 ${decks.length} · 판정 ${total}`);
console.log(`→ ${out}`);
