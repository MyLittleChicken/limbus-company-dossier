/**
 * 프로토타입 전 화면 점검.
 *
 * 화면마다 확인하는 것
 *   · 콘솔 오류
 *   · 토큰이 실제로 적용됐는가 (body 배경이 새 값인가)
 *   · 깨진 이미지 수
 *   · 가로 스크롤이 생겼는가 (밀도를 지키면서 폭을 넘지 않아야 한다)
 *   · 축 색 훅이 붙었는가
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
/** 검사 대상은 프로토타입 폴더다. 스크립트는 그 안의 `tools/` 에 있다. */
const PUB = join(ROOT, 'publish');
import { spawn } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';


const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9336;
const WIDTHS = [1440, 390];

const profile = join(CACHE, 'verifyprofile');
mkdirSync(profile, { recursive: true });

const chrome = spawn(CHROME, [
	'--headless=new', '--disable-gpu', '--hide-scrollbars',
	`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
function once(method, sessionId, ms = 90000) {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => { drop(); reject(new Error(`${method} 시간 초과`)); }, ms);
		const drop = () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
		const fn = (m) => {
			if (m.method !== method) return;
			if (sessionId && m.sessionId !== sessionId) return;
			clearTimeout(t); drop(); resolve(m.params);
		};
		listeners.push(fn);
	});
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId).catch(() => {});

const errors = [];
listeners.push((m) => {
	if (m.sessionId !== sessionId) return;
	if (m.method === 'Runtime.exceptionThrown') {
		errors.push(m.params?.exceptionDetails?.text ?? 'exception');
	}
	if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
		errors.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '));
	}
});

async function evaluate(expression) {
	const r = await send(
		'Runtime.evaluate',
		{ expression, returnByValue: true, awaitPromise: true },
		sessionId,
	);
	if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
	return r.result.value;
}

const PROBE = `(() => {
	const cs = getComputedStyle(document.body);
	const imgs = [...document.images];
	return {
		bg: cs.backgroundColor,
		font: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
		imgs: imgs.length,
		broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 3),
		brokenCount: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
		overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		axes: document.querySelectorAll('[data-sin],[data-kw],[data-atk]').length,
		packart: document.querySelectorAll('.packart').length,
		proto: document.documentElement.getAttribute('data-proto'),
		classes: new Set([...document.querySelectorAll('[class]')].flatMap(e => [...e.classList])).size,
	};
})()`;

const files = ['index.html', ...readdirSync(join(PUB, 'screens')).filter((f) => f.endsWith('.html')).map((f) => `screens/${f}`)];

let fail = 0;
for (const width of WIDTHS) {
	await send('Emulation.setDeviceMetricsOverride',
		{ width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
	console.log(`\n=== ${width}px ===`);

	for (const rel of files) {
		const name = rel.replace('screens/', '').replace('../', '');
		errors.length = 0;
		const url = `file:///${join(PUB, rel).replace(/\\/g, '/')}`;
		const loaded = once('Page.loadEventFired', sessionId);
		await send('Page.navigate', { url }, sessionId);
		await loaded;
		await sleep(900);
		await evaluate('document.fonts.ready.then(() => 1)').catch(() => {});

		const p = await evaluate(PROBE);
		const problems = [];
		// 웜 차콜이 적용됐는지. 예전 값(#14141a → rgb(20,20,26))이면 토큰이 안 붙은 것이다.
		if (p.bg !== 'rgb(12, 10, 8)') problems.push(`배경 ${p.bg}`);
		if (p.proto !== 'ready') problems.push('proto.js 미실행');
		if (p.brokenCount > 0) problems.push(`깨진 이미지 ${p.brokenCount} (${p.broken.join(', ')})`);
		if (p.overflow > 1) {
			// 넘치는 것이 무엇인지 함께 적는다 — 수치만으로는 고칠 자리를 못 찾는다.
			// 조상은 자식 때문에 늘어난 것이므로 **넘치는 자손이 없는 것**만 남긴다.
			const who = await evaluate(`(() => {
				const w = document.documentElement.clientWidth;
				const over = [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > w + 1);
				const set = new Set(over);
				return over
					.filter(e => ![...e.children].some(c => set.has(c)))
					.slice(0, 4)
					.map(e => {
						const r = e.getBoundingClientRect();
						const label = e.tagName.toLowerCase() + (e.className ? '.' + e.className.toString().trim().split(/\\s+/).join('.') : '');
						return label + ' w' + Math.round(r.width) + ' →' + Math.round(r.right);
					});
			})()`);
			problems.push(`가로 넘침 ${p.overflow}px [${who.join(' | ')}]`);
		}
		if (errors.length) problems.push(`콘솔 오류 ${errors.length}: ${errors[0]?.slice(0, 80)}`);

		if (problems.length) {
			fail++;
			console.log(`FAIL ${name.padEnd(22)} ${problems.join(' · ')}`);
		} else {
			const art = p.packart ? ` · 합성 ${p.packart}` : '';
			console.log(`ok   ${name.padEnd(22)} 이미지 ${String(p.imgs).padStart(4)} · 축 ${String(p.axes).padStart(3)} · 클래스 ${p.classes}${art}`);
		}
	}
}

console.log(`\n실패 ${fail} 건`);
ws.close();
chrome.kill();
process.exit(fail ? 1 : 0);
