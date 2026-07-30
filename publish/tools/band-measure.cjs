/**
 * 팩 애셋 전수 — 이름 띠 좌표 측정.
 *
 * 신호는 둘이다.
 *   1. 밝은 괘선  하단 40% 안의 강한 국소 최대. 이름은 이 선 **위**에 앉는다.
 *   2. 어두운 띠  괘선 바로 위의 낮은 밝기 구간.
 *
 * 결과를 좌표대로 묶어 낸다. 묶음이 하나면 좌표를 하나로 박아도 되고, 여럿이면 애셋마다
 * 달리 줘야 한다.
 */

const { dirname, join, resolve } = require('node:path');

const HERE = __dirname;
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
const sharp = require('sharp');
const fs = require('fs');

const DIR = `${ROOT}/data/assets/packs/limbus-assets`;
const OUT = `${CACHE}/band-measure.json`;

async function rowsOf(file) {
	const src = sharp(join(DIR, file)).ensureAlpha();
	const meta = await src.metadata();
	/*
		폭만 줄이고 **높이는 원본 그대로 둔다.**

		처음에 `resize({ width: 96 })` 로 세로까지 같이 줄였다가 1~2px 짜리 괘선이 표본에서
		통째로 빠졌다 — 검출기가 엉뚱한 아트 하이라이트를 괘선으로 집었다.
	*/
	const { data, info } = await sharp(join(DIR, file))
		.ensureAlpha()
		.resize({ width: 96, height: meta.height, fit: 'fill' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	const rows = [];
	for (let y = 0; y < info.height; y++) {
		let sum = 0;
		let n = 0;
		for (let x = 0; x < info.width; x++) {
			const i = (y * info.width + x) * info.channels;
			if (data[i + 3] < 128) continue;
			sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
			n++;
		}
		rows.push(n ? sum / n : 0);
	}
	return { rows, H: info.height, W: info.width };
}

/** 세 행 이동평균. 한 행짜리 잡음을 눌러 괘선만 남긴다. */
const smooth = (a) => a.map((_, i) => (a[Math.max(0, i - 1)] + a[i] + a[Math.min(a.length - 1, i + 1)]) / 3);

function findBand(rows, H) {
	const s = smooth(rows);
	const lo = Math.floor(H * 0.6);
	const hi = Math.floor(H * 0.98);

	// 괘선 — 위아래 6 행 평균보다 가장 크게 튀는 행.
	let line = -1;
	let best = 0;
	for (let y = lo; y < hi; y++) {
		const around =
			(s[y - 6] + s[y - 5] + s[y - 4] + s[y + 4] + s[y + 5] + s[y + 6]) / 6;
		const jump = s[y] - around;
		if (jump > best) {
			best = jump;
			line = y;
		}
	}
	if (line < 0) return null;

	// 어두운 띠 — 괘선 위로 올라가며 밝기가 다시 오르기 전까지.
	const floor = s[line] - best * 0.55;
	let top = line - 2;
	while (top > lo && s[top] < floor) top--;

	return {
		line: line / H,
		top: (top + 1) / H,
		bottom: (line - 1) / H,
		jump: best,
	};
}

(async () => {
	const files = fs.readdirSync(DIR).filter((f) => !/_boss\./i.test(f));
	const out = [];
	for (const f of files) {
		const { rows, H } = await rowsOf(f);
		const band = findBand(rows, H);
		const meta = await sharp(join(DIR, f)).metadata();
		out.push({
			file: f.replace(/\.(webp|png)$/i, ''),
			w: meta.width,
			h: meta.height,
			...(band ?? {}),
		});
	}

	fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

	// 1% 단위로 묶어 분포를 본다.
	const bucket = new Map();
	for (const r of out) {
		if (r.line === undefined) continue;
		const key = `${(r.top * 100).toFixed(0)}–${(r.bottom * 100).toFixed(0)} / 선 ${(r.line * 100).toFixed(0)}`;
		if (!bucket.has(key)) bucket.set(key, []);
		bucket.get(key).push(r);
	}
	console.log(`측정 ${out.length}개 · 실패 ${out.filter((r) => r.line === undefined).length}개\n`);
	console.log('띠 상단–하단 / 괘선   수   폭  표본');
	for (const [k, v] of [...bucket.entries()].sort((a, b) => b[1].length - a[1].length)) {
		const widths = [...new Set(v.map((r) => r.w))].join(',');
		console.log(`  ${k.padEnd(24)} ${String(v.length).padStart(3)}  ${widths.padEnd(8)} ${v.slice(0, 3).map((r) => r.file).join(', ')}`);
	}
})();
