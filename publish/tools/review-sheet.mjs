/**
 * 전체 화면을 한 장에 늘어놓는 컨택트 시트를 만든다.
 *
 * 화면이 27 개라 하나씩 열어보면 전체가 눈에 들어오지 않는다. 데스크톱(1440)과 모바일(390)
 * 전면 캡처를 받아 축소하고, 썸네일에서 실제 페이지로 들어갈 수 있는 목록을 낸다.
 *
 * **Chrome 을 한 번만 띄운다.** 캡처마다 새로 띄우면 54 장에 몇 분이 걸린다.
 *
 *   node publish/tools/review-sheet.mjs [--desktop-only]
 *
 * 산출물은 `publish/review/` 다. 캡처 이미지는 배포물이 아니라 검토용이다.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
const PUB = join(ROOT, 'publish');
const OUT = join(PUB, 'review');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9341;
const DESKTOP_ONLY = process.argv.includes('--desktop-only');

/*
	썸네일 치수.

	**데스크톱과 모바일을 같은 배율로 줄인다.** 처음에 모바일을 150px 폭으로 두었더니 배율이
	0.385 대 0.264 로 어긋나 모바일 쪽이 훨씬 커 보였고, 카드 높이를 모바일이 끌어올려 짧은
	화면의 데스크톱 썸네일 옆에 빈 공간이 크게 남았다.

	모바일 높이는 **그 화면의 데스크톱 썸네일 높이에 맞춰 자른다.** 모바일 페이지는 2~4 배
	길어서 그대로 두면 모든 카드가 상한 높이가 된다. 컨택트 시트에서 모바일에 바라는 것은
	"배치가 버티는가"이고 그것은 위쪽만 봐도 안다.
*/
const THUMB_W = 380;
const THUMB_MAX_H = 560;
const SCALE = THUMB_W / 1440;
const PHONE_W = Math.round(390 * SCALE);

/*
	화면 묶음.

	`publish/index.html` 의 목록과 같은 갈래이며, 여기서는 **무엇을 보러 왔는지**로 묶는다.
	목록·상세·편성·상태를 나란히 놓으면 톤이 어긋난 자리가 눈에 들어온다.
*/
const GROUPS = [
	{ title: '진입', screens: ['home', 'home-search'] },
	{ title: '목록', screens: ['identities', 'egos', 'gifts', 'packs', 'gifts-empty'] },
	{ title: '상세', screens: ['identity-detail', 'ego-detail', 'gift-detail', 'gift-recipe', 'gift-material', 'pack-detail', 'pack-boss', 'pack-dense'] },
	{ title: '편성', screens: ['squad', 'squad-picker', 'squad-partial'] },
	{ title: '거울 던전 트래커', screens: ['dungeon', 'dungeon-run', 'dungeon-floor', 'dungeon-gifts'] },
	{ title: '그 외', screens: ['about', 'states'] },
	// nav 에서 내렸으나 화면 파일은 남긴 것. 층별 등장 팩과 추천은 거울 던전의
	// 추천·덱 트래킹 기능으로 흡수될 예정이고, 용어는 노출하지 않는다.
	{ title: 'nav 에서 내림', screens: ['floors', 'recommend', 'glossary'] },
];

const LABEL = {
	home: '홈', 'home-search': '홈 — 검색 결과',
	gifts: 'E.G.O 기프트 목록', packs: '테마 팩 목록', identities: '인격 목록', egos: 'E.G.O 목록',
	floors: '층별 등장 팩', glossary: '용어 조회', 'gifts-empty': '기프트 목록 — 빈 결과',
	'gift-detail': '기프트 상세', 'gift-recipe': '기프트 — 합성 레시피', 'gift-material': '기프트 — 재료로 쓰임',
	'pack-detail': '테마 팩 상세', 'pack-boss': '테마 팩 — 보스 층', 'pack-dense': '테마 팩 — 최대 밀도 (기프트 188)',
	'identity-detail': '인격 상세', 'ego-detail': 'E.G.O 상세',
	squad: '편성', 'squad-picker': '편성 — 선택 모달', 'squad-partial': '편성 — 빈 칸',
	recommend: '추천', dungeon: '거울 던전 — 런 시작',
	'dungeon-run': '거울 던전 — 팩 고르기 (hard 3층 · 후보 27)',
	'dungeon-floor': '거울 던전 — 층 진행 중', 'dungeon-gifts': '거울 던전 — 기프트 추가 모달', about: '출처와 고지', states: '상태 카탈로그',
};

mkdirSync(join(OUT, 'thumb'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── CDP ─────────────────────────────────────────────────── */

const chrome = spawn(CHROME, [
	'--headless=new', '--disable-gpu', '--hide-scrollbars',
	`--remote-debugging-port=${PORT}`, `--user-data-dir=${join(CACHE, 'reviewprofile')}`,
	'--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

async function endpoint() {
	for (let i = 0; i < 80; i++) {
		try {
			const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			const j = await r.json();
			if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
		} catch {}
		await sleep(250);
	}
	throw new Error('DevTools 가 열리지 않았다');
}

const ws = new WebSocket(await endpoint());
await new Promise((res, rej) => {
	ws.addEventListener('open', res, { once: true });
	ws.addEventListener('error', rej, { once: true });
});

let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
	const m = JSON.parse(ev.data);
	if (m.id !== undefined) {
		const p = pending.get(m.id);
		if (p) { pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
		return;
	}
	for (const fn of [...listeners]) fn(m);
});
const send = (method, params = {}, sessionId) => new Promise((resolve_, reject) => {
	const i = ++id;
	pending.set(i, { resolve: resolve_, reject });
	ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);

function once(method, ms = 90000) {
	return new Promise((res, rej) => {
		const t = setTimeout(() => { drop(); rej(new Error(`${method} 대기 초과`)); }, ms);
		const drop = () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
		const fn = (m) => { if (m.method !== method || m.sessionId !== sessionId) return; clearTimeout(t); drop(); res(m.params); };
		listeners.push(fn);
	});
}

/*
	**전면 캡처를 쓰지 않는다.**

	처음에는 `captureBeyondViewport` 로 페이지 전체를 찍었다. 3 화면에 10 분이 걸렸다 —
	뷰포트를 페이지 높이까지 늘리면 지연 로딩 이미지 수백 장(E.G.O 목록 771 · 편성 1,032)이
	한꺼번에 불려 디코드된다.

	컨택트 시트에 필요한 것은 페이지 **위쪽**뿐이다. 썸네일이 380px 폭이면 1440 에서 0.264 배
	이고, 잘라낼 높이 560px 은 페이지 2,120px 에 해당한다. 그만큼만 찍으면 된다.
	전체 높이는 캡처하지 않고 `scrollHeight` 로 읽는다.
*/
async function capture(file, width, cap) {
	// 먼저 보통 높이로 열어 내용 높이를 잰다. 그래야 짧은 페이지에 빈 공간이 안 남는다.
	await send('Emulation.setDeviceMetricsOverride',
		{ width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
	const loaded = once('Page.loadEventFired');
	await send('Page.navigate', { url: `file:///${file.replace(/\\/g, '/')}` }, sessionId);
	await loaded;
	// 정적 파일이라 오래 기다릴 필요가 없다. 서체는 프로필에 캐시된다.
	await sleep(1600);
	await send('Runtime.evaluate',
		{ expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true, returnByValue: true },
		sessionId).catch(() => {});
	/*
		높이는 `body` 에서 읽는다.

		`documentElement.scrollHeight` 는 **뷰포트로 하한이 잡힌다.** 썸네일을 위해 뷰포트를
		2,122px 로 늘려 두었으므로 그보다 짧은 페이지가 전부 2,122 로 보고됐다.
		`body` 의 박스 높이는 뷰포트와 무관하게 내용을 따른다.
	*/
	const size = await send('Runtime.evaluate', {
		expression: 'Math.max(document.body.scrollHeight, document.body.offsetHeight)',
		returnByValue: true,
	}, sessionId);
	const pageHeight = size.result?.value ?? 0;

	// 내용만큼만 찍는다. 상한을 넘으면 위쪽만 남는다.
	const shotH = Math.max(400, Math.min(cap, pageHeight));
	await send('Emulation.setDeviceMetricsOverride',
		{ width, height: shotH, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
	await sleep(500);
	const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
	return { buf: Buffer.from(shot.data, 'base64'), pageHeight };
}

/** 축소하고 위쪽만 남긴다. 목록이 무너지지 않게 높이를 자른다. */
async function thumb(buf, width, maxH) {
	const small = await sharp(buf).resize({ width }).png().toBuffer();
	const meta = await sharp(small).metadata();
	const cut = Math.max(1, Math.min(maxH, meta.height));
	return {
		buf: await sharp(small).extract({ left: 0, top: 0, width, height: cut }).png().toBuffer(),
		height: cut,
	};
}

/* ── 캡처 ────────────────────────────────────────────────── */

const have = new Set(readdirSync(join(PUB, 'screens')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')));
const rows = [];

for (const g of GROUPS) {
	for (const name of g.screens) {
		if (!have.has(name)) { console.log(`  건너뜀 — 화면이 없다: ${name}`); continue; }
		const file = join(PUB, 'screens', `${name}.html`);

		// 찍는 높이 = 잘라낼 썸네일 높이를 되돌린 만큼. 그 아래는 볼 일이 없다.
		const d = await capture(file, 1440, Math.round(THUMB_MAX_H * (1440 / THUMB_W)));
		const desk = await thumb(d.buf, THUMB_W, THUMB_MAX_H);
		writeFileSync(join(OUT, 'thumb', `${name}.png`), desk.buf);

		let phone = null;
		if (!DESKTOP_ONLY) {
			// 데스크톱 썸네일과 같은 높이까지만. 그만큼의 페이지 높이만 찍는다.
			const p = await capture(file, 390, Math.round(desk.height / SCALE));
			const t = await thumb(p.buf, PHONE_W, desk.height);
			writeFileSync(join(OUT, 'thumb', `${name}-390.png`), t.buf);
			phone = { pageHeight: p.pageHeight };
		}

		rows.push({ group: g.title, name, deskHeight: d.pageHeight, phoneHeight: phone?.pageHeight ?? 0 });
		console.log(`${name.padEnd(18)} 데스크톱 ${String(d.pageHeight).padStart(5)}px${phone ? ` · 모바일 ${String(phone.pageHeight).padStart(5)}px` : ''}`);
	}
}

ws.close();
chrome.kill();

/* ── 시트 ────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** 썸네일이 담고 있는 페이지 높이. 이보다 긴 화면은 아래가 잘려 있다. */
const SHOWN = Math.round(THUMB_MAX_H * (1440 / THUMB_W));

const card = (r) => `		<li class="sheet-item">
			<a class="sheet-shot" href="../screens/${r.name}.html">
				<img src="thumb/${r.name}.png" alt="" loading="lazy" />
				${r.deskHeight > SHOWN ? '<span class="sheet-cut">아래 잘림</span>' : ''}
			</a>
			${r.phoneHeight ? `<a class="sheet-phone" href="../screens/${r.name}.html"><img src="thumb/${r.name}-390.png" alt="" loading="lazy" /></a>` : ''}
			<div class="sheet-meta">
				<strong>${esc(LABEL[r.name] ?? r.name)}</strong>
				<code>${r.name}.html</code>
				<span class="sheet-h">1440 × ${r.deskHeight}px</span>
			</div>
		</li>`;

const groups = GROUPS.map((g) => {
	const mine = rows.filter((r) => r.group === g.title);
	if (!mine.length) return '';
	return `	<div class="seclabel">
		<h2>${esc(g.title)}</h2>
		<span class="rule"></span>
		<span class="hint">${mine.length}</span>
	</div>
	<ul class="sheet">
${mine.map(card).join('\n')}
	</ul>`;
}).join('\n\n');

writeFileSync(
	join(OUT, 'index.html'),
	`<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>화면 훑어보기 — MIRROR TRACKER</title>
<link rel="stylesheet" href="../css/tokens.css" />
<link rel="stylesheet" href="../css/globals.css" />
<style>
	/* 이 시트 전용 가구. 프로토타입 클래스와 섞이지 않게 이름을 갈라 둔다. */
	.sheet { list-style: none; margin: 0 0 var(--sp-11); padding: 0;
		display: grid; grid-template-columns: repeat(auto-fill, minmax(${THUMB_W + PHONE_W + 36}px, 1fr)); gap: var(--sp-9); }
	.sheet-item { display: grid; grid-template-columns: ${THUMB_W}px ${PHONE_W}px; grid-template-rows: auto auto;
		gap: var(--sp-4); align-content: start; }
	.sheet-shot, .sheet-phone { position: relative; display: block; line-height: 0;
		border: 1px solid var(--line); background: var(--surface-inset); }
	.sheet-shot:hover, .sheet-phone:hover { border-color: var(--line-active); }
	.sheet-shot img, .sheet-phone img { display: block; width: 100%; height: auto; }
	.sheet-cut { position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 0;
		background: linear-gradient(180deg, transparent, rgba(8,7,6,.9));
		color: var(--ink-muted); font-size: var(--fs-micro); text-align: center;
		letter-spacing: var(--ls-wide); text-transform: uppercase; }
	.sheet-meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-2) var(--sp-5); }
	.sheet-meta strong { font-size: var(--fs-sm); color: var(--ink); }
	.sheet-meta code { font-family: var(--font-mono); font-size: var(--fs-tiny); color: var(--ink-faint); }
	.sheet-h { font-family: var(--font-num); font-size: var(--fs-xs); color: var(--ink-muted); letter-spacing: var(--ls-normal); }
	.sheet-meta a { font-size: var(--fs-xs); color: var(--ink-dim); border-bottom: 1px solid var(--line-strong); }
	.sheet-meta a:hover { color: var(--ink-gold); border-bottom-color: var(--accent); }
	@media (max-width: 760px) {
		.sheet { grid-template-columns: 1fr; }
		.sheet-item { grid-template-columns: 1fr auto; }
	}
</style>

<header class="site-header">
	<div class="hbar">
		<div class="htitle">
			<a href="../index.html">MIRROR TRACKER</a>
			<span class="sub">화면 훑어보기</span>
		</div>
	</div>
	<nav class="site-nav">
		<a href="../index.html">토큰</a>
		<a href="index.html" aria-current="page">훑어보기</a>
		<span class="nav-sep" aria-hidden="true"></span>
		<a href="../screens/states.html">상태</a>
	</nav>
</header>

<main class="site-main">
	<div class="seclabel">
		<h2>화면 훑어보기</h2>
		<span class="kr">${rows.length}개</span>
		<span class="rule"></span>
		<span class="hint">1440 · 390</span>
	</div>

	<p class="lede">
		각 화면을 찍어 축소한 것이다. 긴 화면은 <strong>위쪽 ${SHOWN}px</strong> 까지만 담았다.
		썸네일을 누르면 실제 화면으로 간다.
		왼쪽이 데스크톱 1440px, 오른쪽 좁은 것이 모바일 390px 이며 <strong>같은 배율로 줄였다</strong> —
		폭의 비가 실제 비다. 모바일은 데스크톱 썸네일과 같은 높이까지만 담았다(모바일 페이지는
		2~4 배 길다). 더 긴 화면은 「아래 잘림」으로 표기했고, 옆의 수치가 그 화면의 실제 전체 높이다.
	</p>

${groups}

	<p class="stamp">캡처 기준 · publish/screens</p>
</main>

<footer class="site-footer">
	<p>비공식 팬 프로젝트이며 Project Moon과 제휴·승인 관계가 없습니다</p>
	<a href="../screens/about.html">고지</a>
</footer>
`,
	'utf8',
);

console.log(`\n시트 ${rows.length}개 → publish/review/index.html`);
process.exit(0);
