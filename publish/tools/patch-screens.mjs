/**
 * 떠 온 화면에 손으로 가한 수정을 다시 입힌다.
 *
 * `publish-dump.mjs` 는 **실행 중인 제품의 DOM** 을 뜬다. 그래서 프로토타입에서 정한 것 중
 * 제품에 아직 반영되지 않은 것은 재덤프 때마다 사라진다. 그것을 매번 손으로 되돌리는 대신
 * 여기에 모아 둔다.
 *
 *   node publish/tools/publish-dump.mjs
 *   node publish/tools/patch-screens.mjs      ← 덤프 뒤에 반드시 돌린다
 *
 * **여러 번 돌려도 결과가 같다.** 이미 적용된 화면은 건드리지 않는다.
 *
 * 여기 있는 것은 전부 `README.md` 4.2 의 「컴포넌트 변경이 필요한 항목」이며, 제품이
 * 따라오면 그 항목과 함께 이 파일에서 지운다.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENS = resolve(HERE, '..', 'screens');

const ICON = '../assets/icons/limbus-assets';
const STATUS = '../assets/statuses/limbus-assets';

/* ── 1. nav ──────────────────────────────────────────────── */

const NAV_PRIMARY = [
	['identities.html', '인격'],
	['egos.html', 'E.G.O'],
	['gifts.html', 'E.G.O 기프트'],
	['packs.html', '테마 팩'],
];
const NAV_SECONDARY = [
	['squad.html', '편성'],
	['dungeon.html', '거울 던전'],
];

const NAV_RE = /<nav class="site-nav">[\s\S]*?<\/nav>/;

/**
 * 순서를 바꾸고 추천·층별 등장 팩·용어를 내린다(`README.md` 4.2 (7)).
 * 활성 탭은 원본이 표시한 것을 따르며, 내려간 화면이 활성이면 활성 탭이 없다.
 */
function patchNav(src) {
	const m = src.match(NAV_RE);
	if (!m) return src;
	const cur = m[0].match(/aria-current="page" href="([^"]+)"/);
	const active = cur ? cur[1] : null;
	const a = ([href, label]) =>
		href === active
			? `<a aria-current="page" href="${href}">${label}</a>`
			: `<a href="${href}">${label}</a>`;
	const next =
		'<nav class="site-nav">' +
		NAV_PRIMARY.map(a).join('') +
		'<span class="nav-sep" aria-hidden="true"></span>' +
		NAV_SECONDARY.map(a).join('') +
		'</nav>';
	return src.replace(NAV_RE, next);
}

/* ── 2. 필터 축 ──────────────────────────────────────────── */

const SIN = [
	['분노', 'wrath'],
	['색욕', 'lust'],
	['나태', 'sloth'],
	['탐식', 'gluttony'],
	['우울', 'gloom'],
	['오만', 'pride'],
	['질투', 'envy'],
];

/** 상태 키워드 7 종. 순서는 `keyword.order` 를 따르는 기프트 화면의 것과 같다. */
const KEYWORD = [
	['화상', 'Burn'],
	['출혈', 'Bleed'],
	['진동', 'Tremor'],
	['파열', 'Rupture'],
	['침잠', 'Sinking'],
	['호흡', 'Poise'],
	['충전', 'Charge'],
];

/**
 * 탄환·보호.
 *
 * **애셋은 있다.** `lib/assets.ts` 의 `uiIcon` 이 `icons` 범주만 뒤져서 못 찾을 뿐이고
 * (`listSquadAxes` 가 `icons[key]` 를 비운 채 돌려주는 이유다) 실물은 `statuses` 에 있다 —
 * `Ammo.webp`(총알) · `Protection.webp`(방패). 눈으로 그림을 확인하고 짝지었다.
 *
 * **파일 이름이 상태 id 와 다르다.** 상태 id 는 `Bullet` 인데 애셋은 `Ammo` 다. 규칙으로
 * 닿지 않으므로 여기 표로 둔다 — 근본 해결은 `uiIcon` 이 범주를 넘어 찾게 하는 것이다.
 */
const MECHANIC = [
	['탄환', 'Ammo'],
	['보호', 'Protection'],
];

const chip = (label, src) =>
	`<button type="button" class="chip" aria-pressed="false" aria-label="${label}">` +
	`<img src="${src}" alt=""></button>`;

const iconChip = (label, file) => chip(label, `${ICON}/${file}.webp`);
const statusChip = (label, file) => chip(label, `${STATUS}/${file}.webp`);

const axis = (label, chips) =>
	`<div class="filter-axis" role="group" aria-label="${label}">` +
	`<span class="filter-axis-label">${label}</span>${chips}</div>`;

/** 축 하나를 통째로 집는다. 축은 중첩되지 않아 다음 `<div` 까지가 그 축이다. */
function axisRange(src, label) {
	const open = `<div class="filter-axis" role="group" aria-label="${label}">`;
	const i = src.indexOf(open);
	if (i < 0) return null;
	let depth = 0;
	for (const m of src.slice(i).matchAll(/<div\b[^>]*>|<\/div>/g)) {
		depth += m[0] === '</div>' ? -1 : 1;
		if (depth === 0) return { start: i, end: i + m.index + m[0].length };
	}
	return null;
}

/**
 * 아이콘을 이미 가진 칩에서 글자를 뗀다. 이름은 `aria-label` 이 잇는다.
 *
 * **치수 속성도 지운다.** 덤프는 `width="16" height="16"` 을 달고 오는데 등급 애셋은
 * 정사각이 아니어서 그 값이 틀렸다(`globals.css` 의 `.chip img` 주석 참조). 높이는
 * 스타일시트가 정하므로 속성으로 가짜 비율을 예약하지 않는다.
 */
function iconOnly(src, label) {
	const r = axisRange(src, label);
	if (!r) return src;
	const seg = src
		.slice(r.start, r.end)
		.replace(
			/<button type="button" class="chip" aria-pressed="false"><img src="([^"]+)" alt="" width="16" height="16">([^<]+)<\/button>/g,
			(_, icon, text) =>
				`<button type="button" class="chip" aria-pressed="false" aria-label="${text}">` +
				`<img src="${icon}" alt=""></button>`,
		)
		// 이미 아이콘만으로 바뀐 칩에 치수가 남아 있으면 떼어 낸다.
		.replace(/(<img src="[^"]+" alt="") width="16" height="16"(><\/button>)/g, '$1$2');
	return src.slice(0, r.start) + seg + src.slice(r.end);
}

/** 글자뿐인 죄악 칩을 죄악 엠블럼으로 바꾼다. */
function sinIcons(src, label) {
	const r = axisRange(src, label);
	if (!r) return src;
	const chips = SIN.map(([ko, key]) => iconChip(ko, key)).join('');
	return src.slice(0, r.start) + axis(label, chips) + src.slice(r.end);
}

/**
 * 축을 지정한 자리에 둔다. 이미 있으면 내용을 갈아 끼운다.
 *
 * 「없으면 넣는다」로만 두었더니 칩 모양을 바꾼 뒤 다시 돌려도 예전 축이 그대로 남았다.
 * 이 파일이 내는 모양이 정본이어야 한다.
 */
function setAxis(src, afterLabel, label, chips) {
	const cur = axisRange(src, label);
	if (cur) return src.slice(0, cur.start) + axis(label, chips) + src.slice(cur.end);
	const r = axisRange(src, afterLabel);
	if (!r) return src;
	return src.slice(0, r.end) + axis(label, chips) + src.slice(r.end);
}

/** 라벨 없는 축 가운데 주어진 글자를 담은 것을 지운다. */
function dropUnlabeledAxis(src, ...texts) {
	const open = '<div class="filter-axis">';
	let i = src.indexOf(open);
	while (i >= 0) {
		let depth = 0;
		let end = -1;
		for (const m of src.slice(i).matchAll(/<div\b[^>]*>|<\/div>/g)) {
			depth += m[0] === '</div>' ? -1 : 1;
			if (depth === 0) {
				end = i + m.index + m[0].length;
				break;
			}
		}
		if (end < 0) break;
		const seg = src.slice(i, end);
		if (texts.every((t) => seg.includes(`>${t}</button>`))) return src.slice(0, i) + src.slice(end);
		i = src.indexOf(open, end);
	}
	return src;
}

/* ── 화면별 적용 ─────────────────────────────────────────── */

const KEYWORD_CHIPS = KEYWORD.map(([ko, file]) => iconChip(ko, file)).join('');
const MECHANIC_CHIPS = MECHANIC.map(([ko, file]) => statusChip(ko, file)).join('');

/**
 * 화면마다 무엇을 고치는가.
 *
 * 죄악·등급·키워드를 **글자에서 엠블럼으로** 옮기는 것이 공통 줄기다. 게임이 그 축들을
 * 그림으로 다루고, 칩 여덟아홉 개가 글자로 늘어서면 목록보다 필터가 무거워진다.
 * 이름은 버리지 않고 `aria-label` 로 남긴다 — 읽어 주는 쪽에는 그대로 들린다.
 */
const PATCHES = {
	'identities.html': (s) => {
		s = iconOnly(s, '등급');
		s = sinIcons(s, '스킬 죄악');
		s = setAxis(s, '스킬 죄악', '키워드', KEYWORD_CHIPS);
		s = setAxis(s, '키워드', '특수', MECHANIC_CHIPS);
		return s;
	},
	'identity-detail.html': (s) => s,
	'egos.html': (s) => {
		// E.G.O 등급도 아이콘만이다. 애셋이 가로 배너이고 **그 안에 이름이 그려져 있어서**
		// 칩 글자를 함께 두면 「ZAYIN ZAYIN」이 된다. 글자를 버리는 것이 아니라 그림이
		// 이미 갖고 있는 것이다.
		s = iconOnly(s, '등급');
		s = sinIcons(s, '각성 죄악');
		s = setAxis(s, '각성 죄악', '키워드', KEYWORD_CHIPS);
		// 침식과 추출은 인격·E.G.O 를 고르는 축이 아니라 소지 상태다. 필터에서 내린다.
		s = dropUnlabeledAxis(s, '침식 있음', '추출 가능');
		return s;
	},
	'gifts.html': (s) => dropUnlabeledAxis(s, '강화 가능', 'hard 전용'),
	'gifts-empty.html': (s) => dropUnlabeledAxis(s, '강화 가능', 'hard 전용'),
};

/* ── 돌린다 ──────────────────────────────────────────────── */

import { readdirSync } from 'node:fs';

let changed = 0;
for (const name of readdirSync(SCREENS).sort()) {
	if (!name.endsWith('.html')) continue;
	const path = join(SCREENS, name);
	const before = readFileSync(path, 'utf8');
	// `states.html` 과 거울 던전 트래커는 덤프가 아니라 우리가 만든 것이다.
	if (name === 'states.html' || name.startsWith('dungeon')) continue;
	let after = patchNav(before);
	if (PATCHES[name]) after = PATCHES[name](after);
	if (after !== before) {
		writeFileSync(path, after);
		changed++;
		console.log(`${name.padEnd(22)} 수정`);
	}
}
console.log(`\n${changed} 파일 수정`);
