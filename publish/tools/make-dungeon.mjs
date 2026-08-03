/**
 * 거울 던전 트래커 화면 셋을 만든다.
 *
 * 이 화면들은 제품에 대응하는 라우트가 없다. `/dungeon` 은 지금 시즌 정보 조회 화면이고
 * 트래커는 아직 없으므로 DOM 을 떠 올 곳이 없다 — `states.html` 과 같은 사정이며 손으로
 * 쓰는 대신 여기서 만든다.
 *
 * **값을 지어내지 않는다.** 화면에 들어가는 팩·기프트·점수는 전부 기존 화면에서 뽑는다.
 *
 *   층별 후보 팩       screens/floors.html      난이도·층 구간별 팩과 봉지 그림
 *   상위 5 의 점수·근거 screens/recommend.html   3단계 엔진이 hard 3층에 실제로 낸 값
 *   기프트 풀          screens/pack-boss.html   억눌린 분노의 등장 기프트 63
 *   덱                 screens/squad.html       캡처 표본
 *
 * 나머지 22 팩의 점수는 **없다.** 추천 슬라이스가 상위 5 만 인쇄했기 때문이며, 그래서
 * 그 카드들은 점수 자리를 비운 채로 낸다. 채우려면 엔진을 27 종에 대해 돌려야 한다.
 *
 * 쓰기: node publish/tools/make-dungeon.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENS = resolve(HERE, '..', 'screens');

const read = (name) => readFileSync(join(SCREENS, `${name}.html`), 'utf8');
const unesc = (s) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');

/* ── 뽑기 ────────────────────────────────────────────────── */

/** 난이도·층 구간 → 등장 팩. `floors.html` 의 구간 패널을 그대로 읽는다. */
function readFloors() {
	const src = read('floors');
	const out = {};
	for (const sec of src.split(/(?=<h3>(?:hard|normal) · )/).slice(1)) {
		const key = sec.match(/<h3>((?:hard|normal) · [^<]+)<\/h3>/);
		if (!key) continue;
		const packs = [];
		const re = /<a class="inline-gift" href="pack-detail\.html"><img[^>]*src="([^"]+)"[^>]*>([^<]*)<\/a>/g;
		for (const m of sec.matchAll(re)) packs.push({ img: m[1], name: unesc(m[2]) });
		out[key[1]] = packs;
	}
	return out;
}

/** hard 3층 상위 5. 점수·구성값·근거가 모두 엔진 출력이다. */
function readRanked() {
	const src = read('recommend');
	const i = src.indexOf('<ol class="plain rank">');
	const seg = src.slice(i, src.indexOf('</ol>', i));
	const out = [];
	for (const it of seg.split(/(?=<li><div class="row-head">)/).slice(1)) {
		const name = it.match(/<strong>(?:<a[^>]*>)?(.*?)(?:<\/a>)?<\/strong>/);
		const score = it.match(/<span class="tag">([\d.]+)<\/span>/);
		const comps = [...it.matchAll(/<span class="comp-k">(.*?)<\/span><span class="comp-v">(.*?)<\/span>/g)].map(
			(m) => [m[1], m[2]],
		);
		const whyBlock = it.match(/<ul class="why">([\s\S]*?)<\/ul>/);
		const why = whyBlock ? [...whyBlock[1].matchAll(/<li>(.*?)<\/li>/g)].map((m) => unesc(m[1])) : [];
		out.push({ name: unesc(name[1]), score: score[1], comps, why });
	}
	return out;
}

/** 억눌린 분노의 등장 기프트 63. 이 팩은 전용 기프트가 0 이라 전부 공용 풀이다. */
function readGiftPool() {
	const src = read('pack-boss');
	const re =
		/<a class="inline-gift" href="gift-detail\.html"><img[^>]*src="([^"]+)"[^>]*>([^<]*)<span class="tag">([^<]*)<\/span>/g;
	return [...src.matchAll(re)].map((m) => ({ img: m[1], name: unesc(m[2]), tier: m[3] }));
}

/* ── 화면에 쓸 상태 ──────────────────────────────────────── */

const floors = readFloors();
const ranked = readRanked();
const pool = readGiftPool();

const DECK = { name: '캡처 표본', filled: 12, deployed: 7 };
const SEASON = { name: '이름과 거미의 거울', key: 'MD7', total: 15, base: 5, date: '2026-07-25' };

/** 진행 중 화면이 서 있는 자리. hard 3층이며 1·2층은 지나왔다. */
const RUN = { difficulty: 'hard', floor: 3, floors: 15 };

const pick = (list, name) => list.find((p) => p.name === name) ?? list[0];

/**
 * 층 이력.
 *
 * 고른 팩은 그 층의 등장 목록에서 고르고, 획득 기프트는 공용 풀에서 가져온다 —
 * 공용 기프트는 팩을 가리지 않으므로 어느 층에서 나와도 데이터와 어긋나지 않는다.
 * 팩 한정 기프트를 쓰려면 그 팩의 기프트 목록이 필요한데 프로토타입에는 억눌린 분노 것뿐이다.
 */
const HISTORY = [
	{ floor: 1, pack: pick(floors['hard · 1'], '잊혀진 자들'), gifts: pool.slice(0, 3) },
	{ floor: 2, pack: pick(floors['hard · 2'], '헬스치킨'), gifts: pool.slice(3, 7) },
];

/**
 * 지금 층에서 고른 팩.
 *
 * **팩을 고르는 것과 층을 도는 것은 다른 마디다.** 게임에서 팩 선택은 층을 여는 일이고,
 * 기프트는 그 뒤 전투·상점·이벤트에서 여러 번 나뉘어 들어온다. 그래서 화면이 둘이다 —
 * `dungeon-run` 이 고르는 자리, `dungeon-floor` 가 도는 자리다.
 *
 * 고른 팩은 억눌린 분노다. 등장 기프트 목록을 실제로 갖고 있는 유일한 팩이라
 * 「그 팩에서 나올 수 있는 것」을 진짜로 낼 수 있다.
 */
const FLOOR_NOW = { floor: RUN.floor, pack: pick(floors['hard · 3'], '억눌린 분노'), gifts: pool.slice(7, 9) };

/** 화면마다 지나온 층이 다르다. 팩 고르기 화면에서는 이번 층이 아직 비어 있다. */
const histFor = (mode) => (mode === 'pick' ? HISTORY : [...HISTORY, FLOOR_NOW]);
const ownedFor = (mode) => histFor(mode).flatMap((h) => h.gifts.map((g) => ({ ...g, floor: h.floor })));

/* ── 조각 ────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function head(title) {
	return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — MIRROR TRACKER</title>
<link rel="stylesheet" href="../css/tokens.css" />
<link rel="stylesheet" href="../css/globals.css" />

<header class="site-header">
	<div class="hbar">
		<div class="htitle">
			<a href="home.html">Mirror Tracker</a>
			<span class="sub">거울 던전 정보·추천</span>
		</div>
		<div class="locale-switch">
			<span aria-current="true">한국어</span>
			<a hreflang="en" href="/en">English</a>
		</div>
	</div>
	<nav class="site-nav">
		<a href="identities.html">인격</a>
		<a href="egos.html">E.G.O</a>
		<a href="gifts.html">E.G.O 기프트</a>
		<a href="packs.html">테마 팩</a>
		<span class="nav-sep" aria-hidden="true"></span>
		<a href="squad.html">편성</a>
		<a aria-current="page" href="dungeon.html">거울 던전</a>
	</nav>
</header>
`;
}

const FOOT = `
<footer class="site-footer">
	<p>비공식 팬 프로젝트이며 Project Moon과 제휴·승인 관계가 없습니다</p>
	<a href="about.html">고지</a>
</footer>
<script src="../js/pack-names.js" defer=""></script>
<script src="../js/proto.js" defer=""></script>
`;

/**
 * 보유 기프트 한 줄.
 *
 * 사이드바에서는 층을 함께 적어 어디서 얻었는지 남기고, 층 레일 안에서는 이미 그 층
 * 아래에 있으므로 층도 등급도 적지 않는다 — 168px 폭에서 이름이 잘리기 때문이다.
 */
const ownedItem = (g, where) =>
	where === 'rail'
		? `							<li>
								<img class="icon" src="${g.img}" alt="" width="20" height="20" loading="lazy" />
								<span class="owned-name">${esc(g.name)}</span>
							</li>`
		: `							<li>
								<img class="icon" src="${g.img}" alt="" width="24" height="24" loading="lazy" />
								<span class="owned-name">${esc(g.name)}</span>
								<span class="tag">${esc(g.tier)}</span>
								<span class="hint">${g.floor}층</span>
							</li>`;

/* ── 화면 1 · 런 없음 ────────────────────────────────────── */

function screenStart() {
	const rows = (d, n) => `					<li>
						<button type="button" class="rail-slot" aria-pressed="${d === 'hard'}">
							<span class="rail-name">${d === 'hard' ? 'HARD' : 'NORMAL'}</span>
							<span class="rail-note">1–${n}층</span>
						</button>
					</li>`;

	return `${head('거울 던전')}
<main class="site-main">
	<div class="seclabel">
		<h2>${esc(SEASON.name)}</h2>
		<span class="kr">런을 시작한다</span>
		<span class="rule"></span>
		<span class="hint">${SEASON.date}</span>
	</div>

	<p class="lede">
		편성한 덱으로 이번 시즌 거울 던전을 따라간다. 층마다 등장 가능한 팩을 점수와 함께 보이고,
		무엇을 골랐고 무엇을 얻었는지 남긴다.
	</p>

	<section class="formation">
		<div class="formation-cols">
			<aside class="deckrail">
				<div class="rail-h">난이도</div>
				<ul class="rail-list">
${rows('normal', SEASON.base)}
${rows('hard', SEASON.total)}
				</ul>
				<div class="rail-actions">
					<span class="rail-note">구간마다 등장 팩이 다르다</span>
				</div>
			</aside>

			<div class="formation-main">
				<section class="panel">
					<div class="panel-h">
						<h3>덱</h3>
						<span class="hint">1 / 10</span>
					</div>
					<div class="panel-b">
						<ul class="rail-list">
							<li>
								<button type="button" class="rail-slot" aria-pressed="true">
									<span class="rail-n">1</span>
									<span class="rail-name">${esc(DECK.name)}</span>
									<span class="rail-note">${DECK.filled}/12 · 출전 ${DECK.deployed}</span>
								</button>
							</li>
						</ul>
						<p class="notice-inline">
							덱은 <a href="squad.html">편성</a>에서 만든다. 인격이 빈 칸이 있어도 런은 시작할 수 있다.
						</p>
					</div>
				</section>

				<div class="deck-code">
					<a href="dungeon-run.html">거울 던전 입장</a>
				</div>
			</div>

			<aside class="formation-side">
				<section class="panel">
					<div class="panel-h">
						<h3>시즌</h3>
						<span class="hint">${esc(SEASON.key)}</span>
					</div>
					<div class="panel-b">
						<dl class="facts">
							<div><dt>명칭</dt><dd>${esc(SEASON.name)}</dd></div>
							<div><dt>내부 키</dt><dd><code class="idcode">${esc(SEASON.key)}</code></dd></div>
							<div><dt>전체 층</dt><dd>${SEASON.total}</dd></div>
							<div><dt>기본 층</dt><dd>${SEASON.base}</dd></div>
						</dl>
						<p class="notice-inline">
							은총은 게임에서 입장 직후에 고른다. 추천 점수에 반영되지 않으므로 여기서 받지 않는다.
						</p>
					</div>
				</section>
			</aside>
		</div>
	</section>
</main>
${FOOT}`;
}

/* ── 화면 2·3 공통 조각 ──────────────────────────────────── */

/**
 * 층 레일. 지나온 층은 고른 팩을 달고, 누르면 그 층에서 얻은 기프트가 펼쳐진다.
 *
 * 이번 층은 **팩을 골랐는지에 따라 두 모습**이다 — 고르기 전에는 이름 자리가 「고르는 중」
 * 이고, 고른 뒤에는 그 팩 이름이 박힌 채로 여전히 현재 층이다.
 */
function railFloors(mode, openFloor) {
	const hist = histFor(mode);
	const out = [];
	for (let f = 1; f <= RUN.floors; f++) {
		const h = hist.find((x) => x.floor === f);
		const past = h && f < RUN.floor;
		const state = past ? 'done' : f === RUN.floor ? 'current' : 'todo';
		const mark = past ? '✓' : f === RUN.floor ? '●' : '';
		const open = h && f === openFloor;
		out.push(`					<li>
						<button type="button" class="rail-slot runstep" data-state="${state}" aria-pressed="${open ? 'true' : 'false'}"${
							h ? ` aria-expanded="${open}"` : ''
						}>
							<span class="rail-n">${f}</span>
							<span class="rail-name">${h ? esc(h.pack.name) : f === RUN.floor ? '고르는 중' : ''}</span>
							<span class="runstep-mark" aria-hidden="true">${mark}</span>
						</button>${
							open
								? `\n						<ul class="owned owned-inrail">\n${h.gifts
										.map((g) => ownedItem(g, 'rail'))
										.join('\n')}\n						</ul>`
								: ''
						}
					</li>`);
	}
	return out.join('\n');
}

/** 오른쪽 단. 덱과 보유 기프트는 두 화면이 같다. */
function sideColumn(mode) {
	const owned = ownedFor(mode);
	return `			<aside class="formation-side">
				<section class="panel">
					<div class="panel-h">
						<h3>덱</h3>
						<span class="hint">출전 ${DECK.deployed}/${DECK.filled}</span>
					</div>
					<div class="panel-b">
						<dl class="facts">
							<div><dt>이름</dt><dd>${esc(DECK.name)}</dd></div>
							<div><dt>난이도</dt><dd>HARD</dd></div>
						</dl>
					</div>
				</section>

				<section class="panel">
					<div class="panel-h">
						<h3>보유 기프트</h3>
						<span class="hint">${owned.length}</span>
					</div>
					<div class="panel-b">
						<ul class="owned">
${owned.map((g) => ownedItem(g, 'side')).join('\n')}
						</ul>
						<p class="notice-inline">보유는 층 이력에서 유도한다. 따로 저장하지 않는다.</p>
					</div>
				</section>

				<div class="rail-actions">
					<a href="dungeon.html">런 종료</a>
				</div>
			</aside>`;
}

/* ── 화면 2 · 팩 고르기 ──────────────────────────────────── */

/**
 * 후보 팩 카드. 상위 3 만 순위 뱃지를 달고, 점수는 엔진이 낸 다섯 종에만 있다.
 *
 * **점수 순으로 세운다.** 등장 순으로 두면 1·2·3 위가 격자 여기저기에 흩어져 순위가
 * 뱃지 하나에만 걸린다 — 위치도 순위를 말해야 한다.
 */
function packCards() {
	const byName = new Map(ranked.map((r, i) => [r.name, { ...r, rank: i + 1 }]));
	const list = [...floors['hard · 3']].sort((a, b) => {
		const ra = byName.get(a.name)?.rank ?? Infinity;
		const rb = byName.get(b.name)?.rank ?? Infinity;
		return ra - rb;
	});
	return list
		.map((p) => {
			const r = byName.get(p.name);
			const rank = r && r.rank <= 3 ? r.rank : null;
			return `				<li>
					<a class="card" href="dungeon-floor.html"${rank ? ` data-rank="${rank}"` : ''}>
						<img class="icon" src="${p.img}" alt="" width="56" height="34" loading="lazy" />
						<div class="card-body">
							<strong>${esc(p.name)}</strong>${
								rank ? `\n							<span class="packrank">${rank}</span>` : ''
							}${
								r
									? `\n							<span class="packscore">${r.score}</span>
							<ul class="comp">
${r.comps.map(([k, v]) => `								<li><span class="comp-k">${esc(k)}</span><span class="comp-v">${v}</span></li>`).join('\n')}
							</ul>
							<details>
								<summary class="hint">근거 ${r.why.length}</summary>
								<ul class="why">
${r.why.map((w) => `									<li>${esc(w)}</li>`).join('\n')}
								</ul>
							</details>`
									: ''
							}
						</div>
					</a>
				</li>`;
		})
		.join('\n');
}

function screenPick() {
	const cands = floors['hard · 3'].length;

	return `${head('거울 던전 — 팩 고르기')}
<main class="site-main">
	<div class="seclabel">
		<h2>${esc(SEASON.name)}</h2>
		<span class="kr">HARD · ${RUN.floor}층 — 팩 고르기</span>
		<span class="rule"></span>
		<span class="hint">후보 ${cands}</span>
	</div>

	<section class="formation">
		<div class="formation-cols">
			<aside class="deckrail">
				<div class="rail-h">층 ${RUN.floor} / ${RUN.floors}</div>
				<ul class="rail-list">
${railFloors('pick', 2)}
				</ul>
				<div class="rail-actions">
					<a href="dungeon-run.html">마지막 층 되돌리기</a>
				</div>
			</aside>

			<div class="formation-main">
				<p class="notice-inline">
					점수가 붙은 것은 다섯 종뿐이다. 추천 슬라이스가 상위 다섯만 인쇄했기 때문이며,
					나머지 ${cands - ranked.length} 종은 <strong>값이 없어서 비워 둔 것</strong>이지 0 이 아니다.
				</p>

				<ul class="cardgrid cardgrid-wide">
${packCards()}
				</ul>

				<details class="panel bulk">
					<summary class="panel-h">
						<h3>이 층에서 제외된 팩</h3>
						<span class="hint">—</span>
					</summary>
					<div class="panel-b">
						<p class="absent">제외 사유는 프로토타입 데이터에 없다. 자리만 둔다.</p>
					</div>
				</details>
			</div>

${sideColumn('pick')}
		</div>
	</section>
</main>
${FOOT}`;
}

/* ── 화면 3 · 층 진행 중 ─────────────────────────────────── */

/**
 * 팩을 고른 뒤의 층.
 *
 * **여기서 기프트가 들어온다.** 게임은 한 층 안에서 전투·상점·이벤트를 여러 번 거치고
 * 그때마다 기프트를 준다. 그래서 「기프트 추가」가 한 번 쓰고 닫히는 버튼이 아니라
 * 층이 끝날 때까지 계속 열리는 자리다.
 */
function screenFloor({ modal = false } = {}) {
	const now = FLOOR_NOW;
	const title = modal ? '거울 던전 — 기프트 추가' : '거울 던전 — 층 진행 중';

	return `${head(title)}
<main class="site-main">
	<div class="seclabel">
		<h2>${esc(SEASON.name)}</h2>
		<span class="kr">HARD · ${RUN.floor}층 — 진행 중</span>
		<span class="rule"></span>
		<span class="hint">${esc(now.pack.name)}</span>
	</div>

	<section class="formation">
		<div class="formation-cols">
			<aside class="deckrail">
				<div class="rail-h">층 ${RUN.floor} / ${RUN.floors}</div>
				<ul class="rail-list">
${railFloors('floor', RUN.floor)}
				</ul>
				<div class="rail-actions">
					<a href="dungeon-run.html">팩 다시 고르기</a>
				</div>
			</aside>

			<div class="formation-main">
				<section class="panel">
					<div class="panel-h">
						<h3>이 층의 팩</h3>
						<span class="hint">${RUN.floor}층</span>
					</div>
					<div class="panel-b">
						<ul class="cardgrid cardgrid-wide">
							<li>
								<a class="card" href="pack-detail.html">
									<img class="icon" src="${now.pack.img}" alt="" width="56" height="34" />
									<div class="card-body">
										<strong>${esc(now.pack.name)}</strong>
										<span class="card-meta"><span class="tag">기프트 ${pool.length}</span><span class="tag">전용 0</span></span>
									</div>
								</a>
							</li>
						</ul>
						<p class="notice-inline">
							팩을 고르는 것으로 층이 열린다. 기프트는 이 층을 도는 동안 전투·상점·이벤트에서
							여러 번 들어오므로 아래에 그때마다 쌓는다.
						</p>
					</div>
				</section>

				<section class="panel">
					<div class="panel-h">
						<h3>이 층에서 얻은 것</h3>
						<span class="hint">${now.gifts.length}</span>
					</div>
					<div class="panel-b">
						<ul class="owned">
${now.gifts.map((g) => ownedItem({ ...g, floor: now.floor }, 'rail')).join('\n')}
						</ul>
						<div class="rail-actions">
							<a href="dungeon-gifts.html">기프트 추가</a>
						</div>
					</div>
				</section>

				<div class="deck-code">
					<a href="dungeon-run.html">층 종료 — ${RUN.floor + 1}층으로</a>
				</div>
			</div>

${sideColumn('floor')}
		</div>
	</section>
${modal ? giftModal() : ''}
</main>
${FOOT}`;
}

/* ── 화면 4 · 기프트 추가 모달 ───────────────────────────── */

/**
 * 고른 팩에서 나올 수 있는 기프트.
 *
 * 이미 가진 것은 고를 수 없게 막는다 — 층 이력이 보유의 유일한 근거이므로 같은 것을
 * 두 번 담으면 이력과 보유가 어긋난다.
 */
function giftModal() {
	const taken = new Set(ownedFor('floor').map((g) => g.name));
	const cards = pool
		.map((g) => {
			const has = taken.has(g.name);
			return `					<li>
						<button type="button" class="pickcard${has ? ' pickcard-taken' : ''}" aria-pressed="false"${has ? ' disabled' : ''}>
							<span class="pickcard-port">
								<img class="pickcard-img" src="${g.img}" alt="" loading="lazy" />
							</span>
							<span class="pickcard-body">
								<strong>${esc(g.name)}</strong>
								<span class="card-meta"><span class="tag">${esc(g.tier)}</span>${
									has ? '<span class="tag tag-mark">보유</span>' : ''
								}</span>
							</span>
						</button>
					</li>`;
		})
		.join('\n');

	return `
	<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(FLOOR_NOW.pack.name)} — 기프트 추가">
		<a class="modal-scrim" href="dungeon-floor.html" aria-label="닫기"></a>
		<div class="msheet">
			<header class="mhead">
				<h3>${RUN.floor}층에서 얻은 기프트</h3>
				<span class="rule"></span>
				<a class="chip" href="dungeon-floor.html">닫기</a>
			</header>
			<div class="mtabs" role="tablist">
				<button type="button" role="tab" class="mtab" aria-selected="false" disabled>한정 <span class="tag">0</span></button>
				<button type="button" role="tab" class="mtab" aria-selected="true">공용 <span class="tag">${pool.length}</span></button>
			</div>
			<div class="mtools">
				<p class="notice-inline">
					${esc(FLOOR_NOW.pack.name)} 에서 나올 수 있는 것들이다. 이 팩은 전용 기프트가 없다 —
					117 팩 중 46 팩이 그러하며 그 팩의 모달은 공용 탭만 갖는다.
				</p>
			</div>
			<div class="mbody">
				<ul class="pickgrid">
${cards}
				</ul>
			</div>
			<footer class="mfoot">
				<span class="hint">고르지 않고 완료하면 아무것도 더하지 않는다</span>
				<span class="hint">선택 0</span>
				<a class="chip" href="dungeon-floor.html">완료 (0)</a>
			</footer>
		</div>
	</div>
`;
}

/* ── 쓰기 ────────────────────────────────────────────────── */

const files = [
	['dungeon.html', screenStart()],
	['dungeon-run.html', screenPick()],
	['dungeon-floor.html', screenFloor()],
	['dungeon-gifts.html', screenFloor({ modal: true })],
];

for (const [name, html] of files) {
	writeFileSync(join(SCREENS, name), html);
	console.log(`${name.padEnd(20)} ${html.length.toLocaleString()} 자`);
}

console.log(
	`\n후보 ${floors['hard · 3'].length} · 점수 있는 것 ${ranked.length} · 기프트 풀 ${pool.length}` +
		` · 보유 ${ownedFor('pick').length} → ${ownedFor('floor').length}`,
);
