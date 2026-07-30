/**
 * 헤드리스 Chrome 캡처 — CDP 판.
 *
 * `--screenshot` 플래그는 뷰포트만 찍고 JS 를 심을 자리가 없다. 편성 화면의 상태가
 * localStorage 에 있어(`lib/storage/decks.ts`) 빈 화면만 찍히므로 CDP 로 붙는다.
 *
 *   node shot-cdp.mjs <out.png> <path> [width] [height] [--seed deck.json]
 *
 * `--seed` 를 주면 `limbus:schema` · `limbus:decks` 를 심고 다시 불러온 뒤 찍는다.
 * `captureBeyondViewport` 로 페이지 전체 높이를 담는다.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';


const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ORIGIN = process.env.SHOT_ORIGIN ?? 'http://localhost:3000';
const PORT = 9333;

const argv = process.argv.slice(2);
const seedIdx = argv.indexOf('--seed');
const seedFile = seedIdx === -1 ? null : argv[seedIdx + 1];
const positional = argv.filter((_, i) => seedIdx !== -1 && (i === seedIdx || i === seedIdx + 1) ? false : true);

const [out, path, widthArg, heightArg] = positional;
if (!out || !path) {
	console.error('usage: node shot-cdp.mjs <out.png> <path> [width] [height] [--seed deck.json]');
	process.exit(2);
}
const width = Number(widthArg ?? 1440);
const height = Number(heightArg ?? 900);

const profile = join(CACHE, 'cdpprofile');
mkdirSync(profile, { recursive: true });

const chrome = spawn(
	CHROME,
	[
		'--headless=new',
		'--disable-gpu',
		'--hide-scrollbars',
		`--remote-debugging-port=${PORT}`,
		`--user-data-dir=${profile}`,
		`--window-size=${width},${height}`,
		'about:blank',
	],
	{ stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** DevTools 가 포트를 열 때까지 기다린다. 즉시 붙으면 ECONNREFUSED 다. */
async function endpoint() {
	for (let i = 0; i < 60; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			const json = await res.json();
			if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
		} catch {}
		await sleep(250);
	}
	throw new Error('DevTools 엔드포인트가 열리지 않았다');
}

const wsUrl = await endpoint();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
	ws.addEventListener('open', res, { once: true });
	ws.addEventListener('error', rej, { once: true });
});

let nextId = 0;
const pending = new Map();
const listeners = [];

ws.addEventListener('message', (ev) => {
	const msg = JSON.parse(ev.data);
	if (msg.id !== undefined) {
		const p = pending.get(msg.id);
		if (p) {
			pending.delete(msg.id);
			msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
		}
		return;
	}
	for (const fn of listeners) fn(msg);
});

function send(method, params = {}, sessionId) {
	const id = ++nextId;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
	});
}

/** 특정 이벤트를 한 번 기다린다. */
function once(method, sessionId, timeoutMs = 60000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			const i = listeners.indexOf(fn);
			if (i !== -1) listeners.splice(i, 1);
			reject(new Error(`${method} 이벤트를 기다리다 시간이 지났다`));
		}, timeoutMs);
		const fn = (msg) => {
			if (msg.method !== method) return;
			if (sessionId && msg.sessionId !== sessionId) return;
			clearTimeout(timer);
			const i = listeners.indexOf(fn);
			if (i !== -1) listeners.splice(i, 1);
			resolve(msg.params);
		};
		listeners.push(fn);
	});
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
// SHOT_SCALE 로 픽셀 밀도를 올린다. 작은 글자를 확인할 때 쓴다.
await send('Emulation.setDeviceMetricsOverride',
	{ width, height, deviceScaleFactor: Number(process.env.SHOT_SCALE ?? 1), mobile: width < 500 }, sessionId);

async function goto(url) {
	const loaded = once('Page.loadEventFired', sessionId);
	await send('Page.navigate', { url }, sessionId);
	await loaded;
}

// 심기는 같은 출처에서만 된다 — 먼저 origin 을 열고 값을 넣은 뒤 대상 경로로 간다.
if (seedFile) {
	const decks = readFileSync(resolve(HERE, seedFile), 'utf8').replace(/^\uFEFF/, '');
	await goto(`${ORIGIN}/ko`);
	const res = await send('Runtime.evaluate', {
		expression: `(() => {
			localStorage.setItem('limbus:schema', '1');
			localStorage.setItem('limbus:decks', ${JSON.stringify(decks)});
			return localStorage.getItem('limbus:decks').length;
		})()`,
		returnByValue: true,
	}, sessionId);
	if (res.exceptionDetails) throw new Error(`심기 실패: ${JSON.stringify(res.exceptionDetails)}`);
	console.error(`seeded ${res.result.value} bytes`);
}

await goto(`${ORIGIN}${path}`);

// 이미지와 클라이언트 렌더가 끝날 시간을 준다. 네트워크가 조용해질 때까지가 아니라
// 고정 대기다 — dev 서버는 HMR 소켓이 계속 열려 있어 idle 이 오지 않는다.
await sleep(Number(process.env.SHOT_WAIT ?? 3500));

// 웹폰트가 아직 오는 중이면 글자가 두부로 찍힌다. 준비될 때까지 기다린다.
await send(
	'Runtime.evaluate',
	{ expression: 'document.fonts.ready.then(() => document.fonts.size)', awaitPromise: true, returnByValue: true },
	sessionId,
).catch(() => {});
await sleep(700);

// SHOT_SCROLL 로 특정 지점까지 내려가서 찍는다. 긴 목록의 중간을 볼 때 쓴다.
if (process.env.SHOT_SCROLL) {
	await send(
		'Runtime.evaluate',
		{ expression: `window.scrollTo(0, ${Number(process.env.SHOT_SCROLL)}); true`, returnByValue: true },
		sessionId,
	);
	await sleep(1200);
}

// SHOT_FULL=0 이면 뷰포트만 찍는다. 긴 화면의 위쪽을 크게 보려면 이쪽이다.
const full = process.env.SHOT_FULL !== '0';
const shot = await send('Page.captureScreenshot',
	{ format: 'png', captureBeyondViewport: full }, sessionId);

const target = resolve(HERE, out);
writeFileSync(target, Buffer.from(shot.data, 'base64'));
console.log(`${out}  ${Buffer.from(shot.data, 'base64').length} bytes  (${width}x${height})  ${path}`);

ws.close();
chrome.kill();
process.exit(0);
