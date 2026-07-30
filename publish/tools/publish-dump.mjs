/**
 * 실행 중인 앱의 DOM 을 떠서 `publish/screens/*.html` 로 옮긴다.
 *
 * 마크업을 손으로 옮기면 어긋난다. 실제로 렌더된 DOM 을 그대로 가져와
 * Next 런타임만 걷어내고 정적 파일로 만든다 — 클래스명과 구조가 보존되므로
 * 나중에 되돌려 옮기는 일이 CSS 교체로 끝난다.
 *
 *   node publish-dump.mjs [화면이름 ...]      인자가 없으면 전부
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';


const OUT = join(ROOT, 'publish', 'screens');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ORIGIN = 'http://localhost:3000';
const PORT = 9334;

mkdirSync(OUT, { recursive: true });

/** 화면 목록. `discover` 는 목록 화면에서 첫 상세 링크를 찾아 경로를 정한다. */
const ROUTES = [
	{ name: 'home', path: '/ko', title: '홈' },
	{ name: 'gifts', path: '/ko/gifts', title: 'E.G.O 기프트 목록' },
	{ name: 'gift-detail', discover: ['/ko/gifts', '/ko/gifts/(\\d+)'], title: 'E.G.O 기프트 상세' },
	{ name: 'packs', path: '/ko/packs', title: '테마 팩 목록' },
	{ name: 'pack-detail', discover: ['/ko/packs', '/ko/packs/(\\d+)'], title: '테마 팩 상세' },
	{ name: 'identities', path: '/ko/identities', title: '인격 목록' },
	{ name: 'identity-detail', path: '/ko/identities/10103', title: '인격 상세' },
	{ name: 'egos', path: '/ko/egos', title: 'E.G.O 목록' },
	{ name: 'ego-detail', discover: ['/ko/egos', '/ko/egos/(\\d+)'], title: 'E.G.O 상세' },
	{ name: 'squad', path: '/ko/squad', title: '편성', seed: true },
	{ name: 'squad-picker', path: '/ko/squad', title: '편성 — 선택 모달', seed: true, click: '.sslot-main' },
	{ name: 'recommend', path: '/ko/recommend', title: '추천', seed: true },
	{ name: 'floors', path: '/ko/floors', title: '층별 등장 팩' },
	{ name: 'dungeon', path: '/ko/dungeon', title: '거울 던전 구성' },
	{ name: 'glossary', path: '/ko/glossary', title: '용어 조회' },
	{ name: 'about', path: '/ko/about', title: '출처와 고지' },

	/*
		상태·예외 화면.

		결손과 부재의 표기(05-ui-foundation 6.1)는 평범한 상세에 나오지 않는다.
		그것이 실제로 렌더되는 데이터를 골라 따로 뜬다 — 디자인 시스템이 덮어야 하는 축이다.
	*/
	{ name: 'gift-recipe', path: '/ko/gifts/9083', title: '기프트 상세 — 합성 레시피' },
	{ name: 'gift-material', path: '/ko/gifts/9105', title: '기프트 상세 — 재료로 쓰임' },
	// 기프트 188개. 문서가 말한 최대 밀도 화면이다.
	{ name: 'pack-dense', path: '/ko/packs/1504', title: '테마 팩 상세 — 최대 밀도' },
	// 보스 아트를 가진 34종 중 하나. 일반 층 · 보스 층 두 그림이 나온다.
	{ name: 'pack-boss', path: '/ko/packs/1301', title: '테마 팩 상세 — 보스 층' },
	{ name: 'gifts-empty', path: '/ko/gifts?q=%EC%97%86%EB%8A%94%EC%9D%B4%EB%A6%84&rarity=1', title: '기프트 목록 — 빈 결과' },
	{ name: 'home-search', path: '/ko?q=%EC%9E%AC', title: '홈 — 검색 결과' },
	{ name: 'squad-partial', path: '/ko/squad', title: '편성 — 빈 칸', seed: 'deck-partial.json' },
];

/** 프로토타입 안에서 화면 사이를 오갈 수 있게 내부 링크를 파일명으로 바꾼다. */
const LINK_MAP = {
	'/ko': 'home.html',
	'/ko/gifts': 'gifts.html',
	'/ko/packs': 'packs.html',
	'/ko/identities': 'identities.html',
	'/ko/egos': 'egos.html',
	'/ko/squad': 'squad.html',
	'/ko/recommend': 'recommend.html',
	'/ko/floors': 'floors.html',
	'/ko/dungeon': 'dungeon.html',
	'/ko/glossary': 'glossary.html',
	'/ko/about': 'about.html',
};
const PREFIX_MAP = [
	['/ko/gifts/', 'gift-detail.html'],
	['/ko/packs/', 'pack-detail.html'],
	['/ko/identities/', 'identity-detail.html'],
	['/ko/egos/', 'ego-detail.html'],
];

const wanted = process.argv.slice(2);
const routes = wanted.length ? ROUTES.filter((r) => wanted.includes(r.name)) : ROUTES;

const profile = join(CACHE, 'dumpprofile');
mkdirSync(profile, { recursive: true });

const chrome = spawn(CHROME, [
	'--headless=new', '--disable-gpu', '--hide-scrollbars',
	`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
	'--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
	for (let i = 0; i < 80; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			const j = await res.json();
			if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
		} catch {}
		await sleep(250);
	}
	throw new Error('DevTools 엔드포인트가 열리지 않았다');
}

const ws = new WebSocket(await endpoint());
await new Promise((res, rej) => {
	ws.addEventListener('open', res, { once: true });
	ws.addEventListener('error', rej, { once: true });
});

let nextId = 0;
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
function send(method, params = {}, sessionId) {
	const id = ++nextId;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
	});
}
function once(method, sessionId, timeoutMs = 120000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => { drop(); reject(new Error(`${method} 대기 시간 초과`)); }, timeoutMs);
		const drop = () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
		const fn = (m) => {
			if (m.method !== method) return;
			if (sessionId && m.sessionId !== sessionId) return;
			clearTimeout(timer); drop(); resolve(m.params);
		};
		listeners.push(fn);
	});
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);

async function goto(url) {
	const loaded = once('Page.loadEventFired', sessionId);
	await send('Page.navigate', { url }, sessionId);
	await loaded;
}
async function evaluate(expression) {
	const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
	if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
	return r.result.value;
}

// 덱은 localStorage 에 있다. 같은 출처에서만 심을 수 있어 먼저 origin 을 연다.
const deck = readFileSync(join(CACHE, 'deck.json'), 'utf8').replace(/^\uFEFF/, '');
const loaded = { 'deck.json': deck };
let seededWith = null;

/** 화면마다 다른 덱을 심는다. 같은 파일이면 다시 넣지 않는다. */
async function seed(file) {
	if (seededWith === file) return;
	const raw = loaded[file] ?? readFileSync(join(HERE, file), 'utf8').replace(/^﻿/, '');
	loaded[file] = raw;
	await goto(`${ORIGIN}/ko`);
	await evaluate(
		`localStorage.setItem('limbus:schema','1');localStorage.setItem('limbus:decks',${JSON.stringify(raw)});true`,
	);
	seededWith = file;
}

/**
 * 페이지 안에서 정리하고 직렬화한다.
 *
 * 여기서 걷어내는 것은 Next 런타임과 개발 도구뿐이다. 본문 마크업은 손대지 않는다 —
 * 되돌려 옮길 때 대응이 어긋나지 않는 것이 이 파일들의 목적이다.
 */
function cleaner(title, linkMap, prefixMap) {
	return `(() => {
		const LINK = ${JSON.stringify(linkMap)};
		const PREFIX = ${JSON.stringify(prefixMap)};

		// Next 런타임 · RSC 페이로드 · 개발 도구 오버레이.
		document.querySelectorAll('script, template, nextjs-portal, link[rel="stylesheet"], link[rel="preload"], style[data-next-hide-fouc]').forEach(n => n.remove());
		document.querySelectorAll('[data-nextjs-dialog-overlay], [data-nextjs-toast], #__next-build-watcher').forEach(n => n.remove());

		// 접힌 것을 펼쳐 둔다 — 접힌 안쪽도 스타일 대상이다.
		document.querySelectorAll('details').forEach(d => { d.open = true; });

		// 애셋 경로. screens/ 안에서 열리므로 한 단계 올라간다.
		document.querySelectorAll('img[src]').forEach(n => {
			const v = n.getAttribute('src');
			if (v && v.startsWith('/assets/')) n.setAttribute('src', '..' + v);
		});

		// 내부 링크를 프로토타입 파일명으로.
		document.querySelectorAll('a[href]').forEach(a => {
			const href = a.getAttribute('href');
			if (!href || !href.startsWith('/ko')) return;
			const base = href.split('?')[0];
			if (LINK[base]) { a.setAttribute('href', LINK[base]); return; }
			for (const [p, file] of PREFIX) {
				if (base.startsWith(p)) { a.setAttribute('href', file); return; }
			}
		});

		// 머리를 새로 세운다.
		document.head.innerHTML = '';
		const add = (tag, attrs) => {
			const el = document.createElement(tag);
			for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
			document.head.appendChild(el);
		};
		add('meta', { charset: 'utf-8' });
		add('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' });
		const t = document.createElement('title');
		t.textContent = ${JSON.stringify(title)} + ' — MIRROR TRACKER';
		document.head.appendChild(t);
		add('link', { rel: 'stylesheet', href: '../css/tokens.css' });
		add('link', { rel: 'stylesheet', href: '../css/globals.css' });
		// 이름 색 데이터가 먼저 와야 한다 — proto.js 가 그것을 읽는다.
		for (const src of ['../js/pack-names.js', '../js/proto.js']) {
			const s = document.createElement('script');
			s.setAttribute('src', src);
			s.setAttribute('defer', '');
			document.body.appendChild(s);
		}

		// Next 가 붙인 하이드레이션 흔적.
		document.documentElement.removeAttribute('data-nextjs-router');
		return '<!doctype html>\\n' + document.documentElement.outerHTML;
	})()`;
}

for (const route of routes) {
	if (route.seed) await seed(typeof route.seed === 'string' ? route.seed : 'deck.json');

	let path = route.path;
	if (route.discover) {
		const [from, re] = route.discover;
		await goto(`${ORIGIN}${from}`);
		const found = await evaluate(
			`(() => { const m = document.body.innerHTML.match(${JSON.stringify(re)}); return m ? m[0] : null; })()`,
		);
		if (!found) { console.log(`SKIP ${route.name} — 상세 링크를 찾지 못했다`); continue; }
		path = found;
	}

	await goto(`${ORIGIN}${path}`);
	await sleep(2500);

	if (route.click) {
		const ok = await evaluate(
			`(() => { const el = document.querySelector(${JSON.stringify(route.click)}); if (!el) return false; el.click(); return true; })()`,
		);
		if (!ok) console.log(`  주의: ${route.name} 의 ${route.click} 을 찾지 못했다`);
		await sleep(1800);
	}

	const html = await evaluate(cleaner(route.title, LINK_MAP, PREFIX_MAP));
	const file = join(OUT, `${route.name}.html`);
	writeFileSync(file, html, 'utf8');
	console.log(`${route.name}.html  ${html.length} bytes  ${path}`);
}

ws.close();
chrome.kill();
process.exit(0);
