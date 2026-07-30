/**
 * 보스 그림의 **무게중심**.
 *
 * 경계의 중점으로 맞췄더니 전부 왼쪽으로 치우쳐 보였다. 한쪽으로 길게 뻗은 불꽃·꼬리가
 * 경계를 늘리는데 그 부분은 시각적 무게가 거의 없기 때문이다 — 경계 중점은 그 빈 쪽으로
 * 끌려가고, 실제 덩어리는 반대쪽에 남는다.
 *
 * 그래서 **알파를 가중으로 한 무게중심**을 쓴다. 이것이 눈이 중심으로 보는 지점이다.
 * 경계도 함께 남겨 둔다(참고용).
 */

const { dirname, join, resolve } = require('node:path');

const HERE = __dirname;
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
const sharp = require('sharp');
const fs = require('fs');

const DIR = `${ROOT}/data/assets/packs/limbus-assets`;
const OUT = `${CACHE}/boss-alpha.json`;

function massBounds(counts, lo = 0.02, hi = 0.98) {
	const total = counts.reduce((a, b) => a + b, 0);
	if (!total) return null;
	let acc = 0;
	let start = 0;
	let end = counts.length - 1;
	for (let i = 0; i < counts.length; i++) { acc += counts[i]; if (acc >= total * lo) { start = i; break; } }
	acc = 0;
	for (let i = counts.length - 1; i >= 0; i--) { acc += counts[i]; if (acc >= total * (1 - hi)) { end = i; break; } }
	return { start, end };
}

const centroid = (w) => {
	let sum = 0;
	let acc = 0;
	for (let i = 0; i < w.length; i++) { sum += w[i]; acc += i * w[i]; }
	return sum ? acc / sum : w.length / 2;
};

(async () => {
	const files = fs.readdirSync(DIR).filter((f) => /_boss\./i.test(f));
	const rows = [];
	for (const f of files) {
		const { data, info } = await sharp(`${DIR}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
		const cols = new Array(info.width).fill(0);
		const rws = new Array(info.height).fill(0);
		for (let y = 0; y < info.height; y++) {
			for (let x = 0; x < info.width; x++) {
				const a = data[(y * info.width + x) * info.channels + 3];
				if (a < 96) continue;
				// 알파를 가중으로 쓴다. 흐린 글로우는 무게가 작다.
				const w = a / 255;
				cols[x] += w;
				rws[y] += w;
			}
		}
		const cx = massBounds(cols);
		const cy = massBounds(rws);
		if (!cx || !cy) continue;
		rows.push({
			f: f.replace(/\.(webp|png)$/i, ''),
			W: info.width,
			H: info.height,
			// 무게중심 — 맞춤에 쓰는 값
			gx: +((centroid(cols) / info.width) * 100).toFixed(2),
			gy: +((centroid(rws) / info.height) * 100).toFixed(2),
			// 경계 — 참고용
			top: +((cy.start / info.height) * 100).toFixed(1),
			bottom: +(((cy.end + 1) / info.height) * 100).toFixed(1),
			left: +((cx.start / info.width) * 100).toFixed(1),
			right: +(((cx.end + 1) / info.width) * 100).toFixed(1),
		});
	}
	fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));

	const st = (k) => { const a = rows.map((r) => r[k]).sort((x, y) => x - y); return `중앙 ${a[Math.floor(a.length / 2)]}  최소 ${a[0]}  최대 ${a[a.length - 1]}`; };
	console.log(`보스 파일 ${rows.length}개`);
	console.log(`  무게중심 x  ${st('gx')}`);
	console.log(`  무게중심 y  ${st('gy')}`);
	console.log('\n=== 경계 중점과 무게중심의 차이 (x) ===');
	const diff = rows.map((r) => ({ f: r.f, mid: (r.left + r.right) / 2, g: r.gx, d: +(r.gx - (r.left + r.right) / 2).toFixed(2) }));
	const ds = diff.map((d) => d.d).sort((a, b) => a - b);
	console.log(`  차이 중앙 ${ds[Math.floor(ds.length / 2)]}  최소 ${ds[0]}  최대 ${ds[ds.length - 1]}`);
	for (const d of [...diff].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5)) {
		console.log(`  ${d.f.padEnd(34)} 경계중점 ${d.mid.toFixed(1)}  무게중심 ${d.g}  차이 ${d.d}`);
	}
})();
