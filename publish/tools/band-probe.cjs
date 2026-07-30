/**
 * 이름 띠를 픽셀에서 찾기 위한 신호 조사.
 *
 * 봉지 하단에는 얇은 괘선 두 줄과 그 사이의 어두운 띠가 있다. 팩마다 높이가 다르므로
 * 좌표를 하나로 박으면 어긋난다. 먼저 행별 밝기 프로파일이 어떻게 나오는지 본다.
 */

const { dirname, join, resolve } = require('node:path');

const HERE = __dirname;
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
// 스크래치패드는 프로젝트 밖이라 패키지 이름으로 해석되지 않는다.
const sharp = require('sharp');

const DIR = `${ROOT}/data/assets/packs/limbus-assets`;

/** 행별 평균 밝기와 불투명 비율. 폭은 줄여도 세로 신호는 남는다. */
async function profile(file) {
	const img = sharp(join(DIR, file)).ensureAlpha();
	const meta = await img.metadata();
	const W = 64;
	const { data, info } = await img
		.resize({ width: W, kernel: 'nearest' })
		.raw()
		.toBuffer({ resolveWithObject: true });

	const rows = [];
	for (let y = 0; y < info.height; y++) {
		const vals = [];
		for (let x = 0; x < info.width; x++) {
			const i = (y * info.width + x) * info.channels;
			if (data[i + 3] < 128) continue;
			vals.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
		}
		const n = vals.length;
		const mean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
		// 가로 표준편차. 이름 띠는 평평한 판이라 이 값이 낮게 떨어진다.
		const sd = n ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
		rows.push({ y, lum: mean, sd, cover: n / info.width });
	}
	return { meta, rows, height: info.height };
}

(async () => {
	const files = process.argv.slice(2);
	for (const f of files) {
		const { meta, rows, height } = await profile(f);
		console.log(`\n=== ${f}  ${meta.width}x${meta.height} ===`);
		// 하단 55% 만 본다. 이름 띠는 거기 있다.
		const from = Math.floor(height * 0.55);
		const seg = rows.slice(from);
		const line = seg
			.map((r) => {
				const pct = ((r.y / height) * 100).toFixed(1).padStart(5);
				const bar = '#'.repeat(Math.round(r.sd / 2));
				return `${pct}% lum${r.lum.toFixed(0).padStart(3)} sd${r.sd.toFixed(0).padStart(3)} ${bar}`;
			})
			.filter((_, i) => i % 2 === 0);
		for (const l of line) console.log('  ' + l);
	}
})();
