/**
 * 표본 수집 페이지 — 기프트를 네 칸에 던진다.
 *
 * **설명문 전문을 보여야 한다.** 이름과 등급만으로는 「달의 기억」이 얼마나
 * 센지 알 수 없다.
 *
 * **판정의 근거를 함께 보여야 한다.** 사람은 307장을 몇 시간에 걸쳐 매긴다 —
 * 덱이 무엇을 공급하는지(인격 이름 · 축 · 공격 타입), 이 카드가 왜 그 무더기에
 * 들었는지(`why`), 이 카드가 무엇의 재료인지를 카드 옆에 두지 않으면 판정이
 * 시간에 따라 흔들린다. 흔들린 판정으로 맞춘 저울추는 아무것도 안 뜻한다.
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
/** 이 기프트가 무엇을 만드는 재료인가. 재료가 아니면 빈 배열이다 */
interface Fusion {
	result: string; resultName: string; resultTier: number | null;
	/** 함께 필요한 다른 **칸**들. 칸 하나가 배열 하나다 — 펴면 뜻이 달라진다 */
	withOthers: string[][];
	withOtherNames: string[][];
	recipeCount: number;
}
/**
 * `rank-deck.ts` 가 내는 카드 하나. **`Card` 가 아니라 한 겹 싸여 있다.**
 *
 * 여기를 `Card[]` 로 받으면 타입은 조용히 통과하고 `c.giftId` 가 전부
 * `undefined` 가 된다 — 페이지는 이름 없는 카드 307장을 내고, 저장 열쇠도
 * 내보내기도 죄다 `undefined` 가 되어 표본이 통째로 못 쓰게 된다. JSON 경계에서
 * 타입은 아무것도 보장하지 않으므로 모양을 정직하게 적는 것 말고 방법이 없다.
 */
interface Entry {
	card: Card;
	/** '확실히 좋다' · '엇갈린다' · '확실히 아니다' */
	stratum: string;
	/** 왜 그 무더기인가. 사람이 알아야 판정이 일관된다 */
	why: string;
	branch?: number;
	fusion: Fusion[];
}
interface Deck {
	id: string; name: string; roster: string[];
	/** 출격 7인의 이름표 */
	field: string[];
	/** 대기 5인의 이름표 */
	waiting: string[];
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]>; fieldSize: number };
	cards: Entry[];
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
		d.cards.map((c) => `${c.card.giftId}${c.card.fireable ? '' : '!'}`).join(','),
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

/**
 * 무더기를 보이는 차례. **엇갈린다가 가운데에 온다.**
 *
 * 저울추는 오직 엇갈린 무더기에서만 정해진다 — 「4등급이 1등급보다 낫다」는
 * 짝은 어떤 저울추로도 맞으므로 아무것도 안 가른다. 그 무더기가 화면에서
 * 파묻히면 사람은 쉬운 것부터 매기다 지쳐 정작 값어치 있는 판정을 대충 한다.
 * 그래서 가장 눈에 띄는 자리에 두고, 왜 중요한지도 화면에 적는다.
 */
const STRATA: Array<{ key: string; note: string }> = [
	{ key: '확실히 좋다', note: '' },
	{ key: '엇갈린다', note: '여기가 핵심입니다' },
	{ key: '확실히 아니다', note: '' },
];

/**
 * 합성 재료 줄 하나.
 *
 * **칸 안의 후보는 「또는」으로 잇는다.** `withOtherNames` 는 칸 단위 배열이고
 * 칸 하나에는 후보 중 **하나만** 들어간다 — 펴서 나열하면 「전부 필요」로 읽혀,
 * 일곱 중 하나면 되는 재료를 일곱 개 모아야 하는 것으로 잘못 잰다. 그러면
 * 사람이 그 카드를 「안 집는다」로 던지는데, 실제로는 값싼 재료다.
 */
const fusionLine = (f: Fusion): string => {
	const tier = f.resultTier === null ? 'EX' : `${String(f.resultTier)}등급`;
	const slots = f.withOtherNames
		.map((slot) => slot.map((n) => esc(n)).join(' 또는 '))
		.join(' · ');
	// 길이 여럿이면 위 「함께 필요」는 그중 한 길일 뿐이다 — 다른 길이 더 쉬울 수 있다
	const paths = f.recipeCount > 1 ? ` · 만드는 길 ${f.recipeCount} 개 중 하나` : '';
	const needs = slots === '' ? '' : ` · 함께 필요: ${slots}`;
	return `▸ ${esc(f.resultName)}(${tier}) 의 재료${needs}${paths}`;
};

/**
 * `why` 를 보일 무더기. **엇갈린다에서만 보인다.**
 *
 * `why` 는 `rank-deck.ts` 가 고르기 규칙에서 기계적으로 만든 줄이다. 「확실히
 * 좋다」·「확실히 아니다」에서 그것은 **모형의 결론**이지 사실이 아니고, 그 사실은
 * 이미 카드에 다 나와 있다 — 「4등급 · Combustion · 공용」과 덱 머리의 공급 줄로
 * 사람이 직접 읽을 수 있다. 결론까지 얹으면 정보는 안 늘고 답만 흘린다. 사람이
 * 그걸 따라 매기면 표본은 고르기 규칙을 그대로 되돌려줄 뿐이고, 그 표본으로 맞춘
 * 저울추는 아무것도 안 배운 것이 된다.
 *
 * 엇갈린다는 다르다. 거기서 `why` 는 결론이 아니라 **어느 신호가 서로 어긋나는지**를
 * 말한다(「4등급인데 이 덱 축과 안 맞는다」·「1등급인데 진혼의 재료다」). 그건
 * 카드만 봐서는 바로 안 보이고, 판정을 흐리는 게 아니라 무엇을 저울질할지를
 * 알려 준다. 저울추가 정해지는 유일한 무더기라 그 도움은 남긴다.
 */
const WHY_SHOWN = '엇갈린다';

/** 카드 하나. 이름 · 꼬리표 · 설명문 전문 · (엇갈린다면) 무엇이 어긋나는지 · 합성 재료 줄 */
const cardHtml = (e: Entry): string => `
      <div class="card${e.card.fireable ? '' : ' dead'}" draggable="true" data-gift="${esc(e.card.giftId)}">
        <div class="nm">${esc(e.card.name)}</div>
        <div class="tag">${e.card.tier === null ? 'EX' : `${String(e.card.tier)}등급`} ·
          ${esc(keywordLabel(e.card.keywordId))} · ${e.card.exclusive ? '전용' : '공용'}${e.card.fireable ? '' : ' · 안 켜짐'}</div>
        <div class="ds">${esc(e.card.desc)}</div>
        ${e.stratum === WHY_SHOWN ? `<div class="why">${esc(e.why)}</div>` : ''}
        ${e.fusion.map((f) => `<div class="fz">${fusionLine(f)}</div>`).join('')}
      </div>`;

const page = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>기프트 순위 표본 — ${total}판정</title>
<style>
:root { color-scheme: light dark; --bg:#fff; --fg:#111; --line:#d8d8d8; --muted:#666;
  --card:#fafafa; --dead:#c0392b; --key:#b45309; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#15171a; --fg:#e8e8e8; --line:#333; --muted:#999; --card:#1d2024; --dead:#e8776a;
  --key:#e0a458; } }
* { box-sizing: border-box; }
body { margin:0; padding:1.5rem; background:var(--bg); color:var(--fg);
  font: 15px/1.6 ui-sans-serif, system-ui, "Apple SD Gothic Neo", sans-serif; }
h1 { font-size:1.3rem; margin:0 0 .3rem; }
.lead { color:var(--muted); margin:0 0 1.5rem; max-width:64ch; }
.deck { border:1px solid var(--line); border-radius:8px; margin:0 0 2rem; padding:1rem; }
.deck > h2 { font-size:1.05rem; margin:0 0 .3rem; }
.squad { font-size:.85rem; margin:0 0 .25rem; }
.squad b { color:var(--muted); font-weight:600; margin-right:.4rem; }
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
/* 무더기 소제목. 「아직 안 정함」 칸 안을 셋으로 가른다 */
.pile > h4 { font-size:.85rem; margin:.8rem 0 .4rem; padding-bottom:.2rem;
  border-bottom:1px solid var(--line); }
.pile:first-of-type > h4 { margin-top:0; }
.pile > h4 > .note { color:var(--key); font-weight:600; margin-left:.4rem; }
.card { border:1px solid var(--line); border-radius:5px; background:var(--card);
  padding:.5rem; margin:0 0 .5rem; cursor:grab; }
.card.dead { border-color:var(--dead); }
.card > .nm { font-weight:600; }
.card > .tag { color:var(--muted); font-size:.8rem; margin:.15rem 0 .35rem; }
.card > .ds { font-size:.82rem; white-space:pre-wrap; color:var(--fg); opacity:.85; }
.card > .why { font-size:.8rem; margin-top:.35rem; color:var(--muted); }
.card > .fz { font-size:.8rem; margin-top:.2rem; color:var(--key); }
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
<p class="lead">덱 ${decks.length}개 · 판정 ${total}개입니다. 기프트를 네 칸 중 하나로 끌어다 놓으세요.
<strong>칸 안의 순서는 안 봅니다.</strong><br>
<strong>「엇갈린다」 무더기가 가장 중요합니다</strong> — 4등급이 1등급보다 낫다는 판정은 어떤 저울추로도
맞아서 아무것도 안 가릅니다. 저울추는 오직 엇갈린 무더기에서 정해집니다.<br>
애매한 무더기의 설명은 「무엇이 서로 어긋나는가」이지 답이 아닙니다.
<strong>설명을 따라가지 마시고 직접 판단해 주십시오</strong> — 그래야 이 표본이 쓸모가 있습니다.<br>
카드는 <strong>거울 던전에서 집을 수 있는 것</strong>뿐입니다 — 진혼·달의 기억처럼 합성으로만 나오는
결과물은 집는 게 아니라 만드는 것이라 애초에 카드로 안 나옵니다. 대신 그 재료인 카드에는
▸ 줄로 무엇을 만드는지 적어 두었습니다.<br>
붉은 테두리는 이 편성에서 <strong>안 켜지는</strong> 기프트라는 뜻입니다 — 그것도 판정해 주셔야
「안 켜지면 뺀다」는 지금 규칙이 옳은지 정해집니다.<br>
<strong>판정은 이 브라우저에 자동 저장됩니다</strong> — 새로고침해도 그대로입니다.</p>
${decks.map((d) => `
<section class="deck" data-deck="${esc(d.id)}">
  <h2>덱 ${esc(d.id)} · ${esc(d.name)}</h2>
  <p class="squad"><b>출격</b>${d.field.map((n) => esc(n)).join(' · ') || '없음'}</p>
  <p class="squad"><b>대기</b>${d.waiting.map((n) => esc(n)).join(' · ') || '없음'}</p>
  <p class="supply">축 ${d.supply.axis.map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '없음'}
    &nbsp;|&nbsp; 공격 ${d.supply.attackType.map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '없음'}</p>
  <div class="cols">
    <div class="col" data-bucket="none"><h3>아직 안 정함</h3>
      ${STRATA.map((s) => {
		const mine = d.cards.filter((c) => c.stratum === s.key);
		// 빈 무더기는 소제목도 안 낸다 — 덱 11 은 「확실히 좋다」가 0장이라
		// 제목만 남으면 카드를 잃어버린 것처럼 보인다
		if (mine.length === 0) return '';
		const note = s.note === '' ? '' : ` <span class="note">← ${s.note}</span>`;
		return `<div class="pile"><h4>${esc(s.key)} ${mine.length}${note}</h4>${mine.map((e) => cardHtml(e)).join('')}
      </div>`;
	}).join('')}
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
