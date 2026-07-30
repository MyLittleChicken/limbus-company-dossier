/** 팩 목록에서 이름이 인쇄된 것과 안 된 것, 보스 그림이 들어간 것을 센다. */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';


const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL_ = `file:///${ROOT}/publish/screens/packs.html`;
const PORT = 9338;
const profile = join(CACHE, 'checkprofile');
mkdirSync(profile, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
	`--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 80; i++) {
	try {
		const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
		const j = await r.json();
		if (j.webSocketDebuggerUrl) { ws = new WebSocket(j.webSocketDebuggerUrl); break; }
	} catch {}
	await sleep(250);
}
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });

let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
	const m = JSON.parse(ev.data);
	if (m.id !== undefined) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } return; }
	for (const fn of [...listeners]) fn(m);
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
	const i = ++id; pending.set(i, { resolve, reject });
	ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);

const loaded = new Promise((res) => listeners.push((m) => { if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) res(); }));
await send('Page.navigate', { url: URL_ }, sessionId);
await loaded;
await sleep(7000);

const r = await send('Runtime.evaluate', {
	expression: `(() => {
		const cards = [...document.querySelectorAll('.cardgrid-wide .card')];
		const rows = cards.map(c => {
			const box = c.querySelector('.packart');
			const base = box?.querySelector('img.icon');
			return {
				name: c.querySelector('.card-body strong')?.textContent.trim(),
				cat: c.querySelector('.card-meta .tag')?.textContent.trim(),
				w: base?.naturalWidth ?? 0,
				printed: !!box?.querySelector('.packart-name'),
				boss: !!box?.querySelector('.packart-boss'),
				fontPx: box ? getComputedStyle(box.querySelector('.packart-name') ?? box).fontSize : null,
			};
		});
		return {
			total: rows.length,
			printed: rows.filter(r => r.printed).length,
			boss: rows.filter(r => r.boss).length,
			widths: [...new Set(rows.map(r => r.w))].sort((a,b)=>a-b),
			notPrinted: rows.filter(r => !r.printed).map(r => r.cat + ' / ' + r.name + ' / w' + r.w),
			noBoss: rows.filter(r => !r.boss).map(r => r.cat + ' / ' + r.name),
			sampleFont: rows.find(r => r.printed)?.fontPx,
		};
	})()`, returnByValue: true, awaitPromise: true,
}, sessionId);

const v = r.result.value;
console.log(`카드 ${v.total} · 이름 인쇄 ${v.printed} · 보스 합성 ${v.boss}`);
console.log(`기반 그림 폭 종류: ${v.widths.join(', ')}`);
console.log(`이름 글자 크기 표본: ${v.sampleFont}`);
console.log(`\n=== 이름이 인쇄되지 않은 ${v.notPrinted.length}종 ===`);
for (const s of v.notPrinted) console.log('  ' + s);
console.log(`\n=== 보스 그림이 없는 ${v.noBoss.length}종 ===`);
for (const s of v.noBoss) console.log('  ' + s);

ws.close(); chrome.kill(); process.exit(0);
