/**
 * 팩 카드 합성 데이터를 낸다 — 이름 색과 보스 그림 맞춤.
 *
 * 보스 파일은 40 개가 모두 391 × 432 인데 **그 안의 그림 위치가 파일마다 다르다**
 * (위 여백 0~16.2% · 왼쪽 0~14.1%). 파일 상자를 기준으로 고정 좌표에 놓으면 여백이 큰
 * 파일은 창 아래로 밀리고 옆으로 치우친다.
 *
 * 그래서 **파일 상자가 아니라 그림 내용을 기준으로** 맞춘다. 내용의 세로 길이를 봉지의
 * 60% 로 맞추고, 내용 중심을 봉지의 세로 45% · 가로 50% 에 놓는다.
 *
 * 게임의 정확한 규칙은 확정하지 못했다 — 위키 완성 카드가 700 높이이고 우리 봉지 애셋이
 * 690 이라 겹쳐서 차분을 낼 수 없었다(모든 경계에서 어긋난다). 다만 어느 규칙이든
 * 내용 기준 정렬이 파일 상자 기준보다 낫다. 40 종이 같은 자리에 앉는 것이 눈에 보이는 품질이다.
 */

const { dirname, join, resolve } = require('node:path');

const HERE = __dirname;
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
const fs = require('fs');

const OUT = `${ROOT}/publish/js/pack-names.js`;

const names = JSON.parse(fs.readFileSync(join(CACHE, 'name-analyse.json'), 'utf8'));
const alpha = JSON.parse(fs.readFileSync(join(CACHE, 'boss-alpha.json'), 'utf8'));

const DEFAULT_COLOR = '#ebcaa2';

/* ── 이름 색 ─────────────────────────────────────────────── */

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function trustworthy(hex) {
	const [r, g, b] = rgb(hex);
	const chroma = Math.max(r, g, b) - Math.min(r, g, b);
	const l = 0.299 * r + 0.587 * g + 0.114 * b;
	return l > 150 || chroma >= 60;
}

const colors = [];
let sameAsDefault = 0;
let untrusted = 0;
for (const r of names) {
	if (!r.ok || !r.color) { untrusted++; continue; }
	if (r.color.toLowerCase() === DEFAULT_COLOR) { sameAsDefault++; continue; }
	if (!trustworthy(r.color)) { untrusted++; continue; }
	colors.push(r);
}

/* ── 보스 그림 맞춤 ──────────────────────────────────────── */

// 애셋 실측 비율. 봉지 380 × 690, 보스 391 × 432.
const BAG = 380 / 690;
const BOSS = 391 / 432;
/** 보스 그림 높이(%)를 봉지 폭 대비 %로 바꾸는 계수. */
const W_FACTOR = (1 / BAG) * BOSS;

/*
	**크기는 고정하고 중심만 맞춘다.**

	처음에는 내용 세로 길이를 봉지의 60% 로 정규화했다. 그것은 과했다 — 인게임 화면에서
	`해방된 분노` 의 보스는 봉지 높이의 약 44% 이고 위키 카드의 `Emotional Flood` 는 약 57% 다.
	팩마다 다르다는 뜻이고, 게임이 파일을 **고정 사각형에 그리고 내용 크기는 그대로 둔다**는
	뜻이다. 정규화하면 큰 그림은 줄고 작은 그림은 커져 원작에서 멀어진다.

	그래서 그림 전체 높이는 파일 본래 비율(432/690 = 62.6%)로 고정하고, 여백 때문에 생기는
	치우침만 중심으로 바로잡는다.
*/
const FIXED_H = (432 / 690) * 100; // 그림 전체 높이 (봉지 높이 대비 %)
const TARGET_CY = 45; // 내용 세로 중심
const TARGET_CX = 50; // 내용 가로 중심

const fits = [];
for (const a of alpha) {
	const sprite = a.f.replace(/_boss(\.webp)?$/i, '');
	/*
		**무게중심을 쓴다. 경계의 중점이 아니다.**

		경계 중점으로 맞췄더니 전부 왼쪽으로 치우쳐 보였다. 한쪽으로 길게 뻗은 불꽃·꼬리가
		경계를 늘리는데 그 부분은 시각적 무게가 거의 없어, 중점이 빈 쪽으로 끌려가고 실제
		덩어리는 반대쪽에 남는다. 오차가 최대 ±5.5% 였다.

		무게중심으로 재니 x 중앙 49.9 · y 중앙 48.1 로 **이미 캔버스 중앙 근처**다. 즉 팩마다
		필요한 보정은 ±3% 수준이고, 원래 값(위 14% · 캔버스 중앙)이 대체로 옳았다.
	*/
	if (a.gx === undefined || a.gy === undefined) continue;
	const gx = a.gx / 100;
	const gy = a.gy / 100;

	const h = FIXED_H; // 크기는 모든 팩이 같다
	const top = TARGET_CY - gy * h;
	const w = h * W_FACTOR; // 그림 전체 폭 (봉지 폭 대비 %)
	const left = TARGET_CX - gx * w;

	fits.push({
		sprite,
		top: +top.toFixed(2),
		left: +left.toFixed(2),
		h: +h.toFixed(2),
	});
}

/* ── 출력 ────────────────────────────────────────────────── */

const esc = (s) => s.replace(/'/g, "\\'");

const body = `/*
	팩 카드 합성 데이터 — 게임 애셋과 게임 카드에서 뽑은 값.
	========================================================

	**손으로 정한 값이 아니다.** 아래 둘은 각각 다른 방법으로 측정했다.

	1. 이름 색  위키의 완성 카드 113 장을 우리 봉지 애셋과 겹쳐 차분을 내고, 인쇄된 글자
	            픽셀만 골라 중앙값을 취했다. ${colors.length} 종이 고유색을 갖고, ${sameAsDefault} 종은 기본값과
	            같게 나와 생략했고, ${untrusted} 종은 차분에 판 색이 남아 못 믿을 값이 나와 버렸다
	            — 틀린 색을 넣는 것보다 기본값으로 물러서는 편이 낫다.

	2. 보스 맞춤 보스 파일 40 개가 모두 391 × 432 인데 **그 안의 그림 위치가 파일마다 다르다**
	            (알파 무게중심 x 45.9~55.8% · y 41.0~55.7%). 알파 가중 무게중심을 재서 **파일 상자가 아니라 그림
	            내용을 기준으로** 맞춘다 — 그림 크기는 파일 본래 비율(62.6%)로 고정하고 내용 중심만 세로 ${TARGET_CY}% ·
	            가로 ${TARGET_CX}% 에 놓는다. 고정 좌표로는 여백이 큰 파일이 창 아래로 밀렸다.

	            중심은 **알파 가중 무게중심**이다. 경계의 중점이 아니다 — 처음에 절대
	            경계로 했더니 가장자리의 흐린 잔여 픽셀 하나가 상자를 늘려 중심이 밀렸다 —
	            「멎어버린 나태」 가 왼쪽으로 치우쳐 보인 것이 그 때문이다.

	게임의 보스 배치 규칙 자체는 확정하지 못했다 — 위키 완성 카드가 700 높이이고 우리 애셋이
	690 이라 겹쳐 차분을 낼 수 없다(모든 경계에서 어긋난다). 내용 기준 정렬은 그와 무관하게
	파일 상자 기준보다 낫다.

	**제품에서는 팩 id 로 키를 잡아야 한다.** 이름·스프라이트로 잡는 것은 덤프가 링크를
	프로토타입 파일명으로 바꿔 id 가 마크업에 남지 않기 때문이다. 값은 파이프라인이 애셋
	스냅샷마다 한 번 계산해 두면 된다.
*/

/** 팩 이름 → 글자 색. 없으면 기본값 ${DEFAULT_COLOR}. */
window.PACK_NAME_COLOR = {
${colors.sort((a, b) => a.id.localeCompare(b.id)).map((r) => `\t'${esc(r.ko)}': '${r.color}', // ${r.id}`).join('\n')}
};

/** 보스 스프라이트 키 → 그림 맞춤. 값은 봉지 대비 %. */
window.PACK_BOSS_FIT = {
${fits.sort((a, b) => a.sprite.localeCompare(b.sprite)).map((f) => `\t'${esc(f.sprite)}': { top: ${f.top}, left: ${f.left}, h: ${f.h} },`).join('\n')}
};
`;

fs.writeFileSync(OUT, body, 'utf8');
console.log(`이름 색 ${colors.length}종 (기본값과 같아 생략 ${sameAsDefault} · 버림 ${untrusted})`);
console.log(`보스 맞춤 ${fits.length}종`);
const st = (k) => { const a = fits.map((f) => f[k]).sort((x, y) => x - y); return `중앙 ${a[Math.floor(a.length / 2)]}  최소 ${a[0]}  최대 ${a[a.length - 1]}`; };
console.log(`  top  ${st('top')}`);
console.log(`  left ${st('left')}`);
console.log(`  h    ${st('h')}`);
