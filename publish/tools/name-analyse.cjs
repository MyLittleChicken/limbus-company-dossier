/**
 * 팩마다 인쇄된 이름의 색·좌표·크기를 게임 카드에서 뽑는다.
 *
 * 방법은 차분이다. 우리 봉지 애셋에는 이름 띠가 비어 있고 위키 카드에는 이름이 인쇄돼
 * 있으므로, 같은 자리에 겹쳐 놓고 다른 픽셀만 남기면 그것이 인쇄된 것이다.
 *
 * 좌표 맞추기
 *   봉지  위키 카드가 380 폭으로 같다. 카드의 알파 경계로 봉지가 차지한 행 범위를 구하면
 *         그 안의 비율이 곧 우리 CSS 퍼센트가 된다.
 *   극한  카드에 우리가 갖지 않은 외곽 프레임이 덧씌워져 비율을 옮길 수 없다.
 *         **색만 뽑고 좌표는 실측한 공통값을 쓴다.**
 */

const { dirname, join, resolve } = require('node:path');

const HERE = __dirname;
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
const sharp = require('sharp');
const fs = require('fs');

const CARDS = join(CACHE, 'cards');
const ASSETS = `${ROOT}/data/assets/packs/limbus-assets`;

const survey = JSON.parse(fs.readFileSync(join(CACHE, 'wiki-survey.json'), 'utf8'));

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

async function raw(file, opts) {
	const img = sharp(file).ensureAlpha();
	const meta = await img.metadata();
	const w = opts?.width ?? meta.width;
	const h = opts?.height ?? meta.height;
	const { data, info } = await sharp(file)
		.ensureAlpha()
		.resize({ width: w, height: h, fit: 'fill' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data, W: info.width, H: info.height, C: info.channels, meta };
}

/** 불투명 영역의 세로 범위. 위키 카드에서 봉지가 차지한 행이다. */
function alphaRows(img) {
	const { data, W, H, C } = img;
	let y0 = -1;
	let y1 = -1;
	for (let y = 0; y < H; y++) {
		let n = 0;
		for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 140) n++;
		if (n > W * 0.25) {
			if (y0 < 0) y0 = y;
			y1 = y;
		}
	}
	return { y0, y1 };
}

/**
 * 이름 글자를 찾는다.
 *
 * `base` 가 있으면 차분으로, 없으면 밝기만으로 고른다. 어느 쪽이든 **얇은 글자**를
 * 남기는 것이 목적이라 밝은 쪽 상위만 취한다.
 */
function glyphs(card, base, win) {
	const { data, W, C } = card;
	const cand = [];
	for (let y = win.from; y <= win.to; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * C;
			if (data[i + 3] < 140) continue;
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			let score = 0;
			if (base) {
				const j = (Math.min(y - win.baseShift, base.H - 1) * base.W + x) * base.C;
				const d = Math.abs(r - base.data[j]) + Math.abs(g - base.data[j + 1]) + Math.abs(b - base.data[j + 2]);
				// 차분이 없으면 배경이다. **밝기로 편향하지 않는다** — 어두운 글자도 있다.
				if (d < 60) continue;
				score = d;
			} else {
				score = lum(r, g, b);
			}
			/*
				판을 버린다.

				차분에 남는 것은 판(어두워진 띠) · 워드마크 · 이름 셋이다. 판은 **채도 없이
				어두운** 넓은 면이라 그것으로 갈라낸다. 이 걸러내기가 없으면 판 색이 글자
				색으로 나온다 — `잊혀진 자들` 이 붉은 글자인데 `#333030` 으로 나왔다.
			*/
			const chroma = Math.max(r, g, b) - Math.min(r, g, b);
			const l = lum(r, g, b);
			if (chroma < 26 && l < 78) continue;
			cand.push({ x, y, r, g, b, score, l });
		}
	}
	if (cand.length < 40) return null;

	/*
		글자 획의 심만 남긴다.

		차분에 남는 픽셀은 글자 심 · 안티에일리어싱 테두리 · 잔여 배경이 섞인 띠다.
		그대로 중앙값을 내면 중간색으로 끌린다 — 크림색 글자가 갈색으로 나왔다.

		**배경 밝기와 비교해 방향을 정하고 그 방향의 극단만 취한다.** 밝은 글자는 밝은 쪽,
		어두운 글자는 어두운 쪽이며, 이 판정이 있어야 둘 다 잡힌다.
	*/
	const bg = win.bgLum;
	const mid = cand.map((p) => p.l).sort((a, b) => a - b)[Math.floor(cand.length / 2)];
	const lighter = mid >= bg;
	const sorted = [...cand].sort((a, b) => (lighter ? b.l - a.l : a.l - b.l));
	const core = sorted.slice(0, Math.max(24, Math.floor(sorted.length * 0.18)));
	if (core.length < 20) return null;

	const med = (arr) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
	const color = [med(core.map((p) => p.r)), med(core.map((p) => p.g)), med(core.map((p) => p.b))];

	const ys = core.map((p) => p.y);
	const xs = core.map((p) => p.x);
	return {
		color,
		top: Math.min(...ys),
		bottom: Math.max(...ys),
		left: Math.min(...xs),
		right: Math.max(...xs),
		n: core.length,
	};
}

const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

(async () => {
	const assetFiles = new Map(
		fs.readdirSync(ASSETS).map((f) => [f.replace(/\.(webp|png)$/i, ''), f]),
	);

	const out = [];
	for (const row of survey) {
		if (!row.wiki?.exists) continue;
		const cardPath = join(CARDS, `${row.id}.png`);
		if (!fs.existsSync(cardPath)) continue;
		const assetName = assetFiles.get(row.sprite);
		if (!assetName) continue;

		const isExt = /_Extreme$/i.test(row.sprite);
		const card = await raw(cardPath);
		const { y0, y1 } = alphaRows(card);
		if (y0 < 0) continue;
		const span = y1 - y0 + 1;

		let base = null;
		let winFrom;
		let winTo;
		if (!isExt && card.meta.width === 380) {
			// 애셋을 카드의 봉지 범위에 맞춰 늘려 행을 맞춘다.
			base = await raw(join(ASSETS, assetName), { width: card.W, height: span });
			base.baseShift = y0;
			// 워드마크가 이름 위에 있다. 78% 부터 잡아 그것을 창 밖으로 밀어낸다.
			winFrom = y0 + Math.floor(span * 0.78);
			winTo = y0 + Math.floor(span * 0.92);
		} else {
			// 극한은 프레임 때문에 겹칠 수 없다. 카드 자체의 하단만 본다.
			winFrom = y0 + Math.floor(span * 0.76);
			winTo = y0 + Math.floor(span * 0.94);
		}

		/** 창 안 배경의 밝기. 글자가 배경보다 밝은지 어두운지 판정하는 기준이다. */
		let bgLum = 0;
		{
			const src = base ?? card;
			const vals = [];
			for (let y = winFrom; y <= winTo; y++) {
				const yy = base ? y - y0 : y;
				if (yy < 0 || yy >= src.H) continue;
				for (let x = 0; x < src.W; x += 3) {
					const i = (yy * src.W + x) * src.C;
					if (src.data[i + 3] < 140) continue;
					vals.push(lum(src.data[i], src.data[i + 1], src.data[i + 2]));
				}
			}
			vals.sort((a, b) => a - b);
			bgLum = vals.length ? vals[Math.floor(vals.length / 2)] : 60;
		}

		const g = glyphs(card, base ? { ...base, baseShift: y0 } : null, {
			from: winFrom,
			to: winTo,
			baseShift: y0,
			bgLum,
		});
		if (!g) { out.push({ id: row.id, ko: row.ko, sprite: row.sprite, ext: isExt, ok: false }); continue; }

		out.push({
			id: row.id,
			ko: row.ko,
			sprite: row.sprite,
			ext: isExt,
			ok: true,
			color: hex(g.color),
			// 봉지 범위 안의 비율. 그대로 CSS 퍼센트가 된다.
			top: +(((g.top - y0) / span) * 100).toFixed(1),
			bottom: +(((g.bottom - y0) / span) * 100).toFixed(1),
			capPct: +(((g.bottom - g.top) / span) * 100).toFixed(1),
			widthPct: +(((g.right - g.left) / card.W) * 100).toFixed(1),
			n: g.n,
		});
	}

	fs.writeFileSync(join(CACHE, 'name-analyse.json'), JSON.stringify(out, null, 2));

	const ok = out.filter((r) => r.ok);
	console.log(`분석 ${out.length} · 성공 ${ok.length} · 실패 ${out.length - ok.length}\n`);

	const byColor = new Map();
	for (const r of ok) {
		const k = r.color;
		if (!byColor.has(k)) byColor.set(k, []);
		byColor.get(k).push(r);
	}
	console.log('=== 이름 색 분포 (상위 18) ===');
	for (const [k, v] of [...byColor.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 18)) {
		console.log(`  ${k}  ${String(v.length).padStart(3)}개  ${v.slice(0, 3).map((r) => r.ko).join(', ')}`);
	}

	const bags = ok.filter((r) => !r.ext);
	const stat = (f) => {
		const a = bags.map(f).sort((x, y) => x - y);
		return `중앙 ${a[Math.floor(a.length / 2)]}  최소 ${a[0]}  최대 ${a[a.length - 1]}`;
	};
	console.log(`\n=== 봉지 ${bags.length}개 글자 상자 (봉지 높이 대비 %) ===`);
	console.log(`  상단   ${stat((r) => r.top)}`);
	console.log(`  하단   ${stat((r) => r.bottom)}`);
	console.log(`  글자높이 ${stat((r) => r.capPct)}`);
	console.log(`  글자폭   ${stat((r) => r.widthPct)}`);
})();
