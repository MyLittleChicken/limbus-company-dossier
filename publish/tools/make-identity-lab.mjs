/*
	인격 상세 시안 생성기.
	==================

	목록 화면을 고를 때 쓴 방식 그대로다 — 같은 데이터로 배치만 다른 시안을 여러 장 만들어
	나란히 보고 고른다. **내용은 캐노니컬에서 그대로 읽는다.** 시안이라고 값을 지어내면
	고르고 나서 진짜 데이터로 옮길 때 판이 뒤집힌다.

	  node publish/tools/make-identity-lab.mjs [인격id]

	기본은 10515(약지 야수파 스튜던트 · 뫼르소)다. 스킬 셋 · 방어 · 패닉 · 패시브 · 저항 ·
	속도를 다 갖고 있어 상세가 담아야 할 것이 한 장에 다 나온다.
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '../../src/v2/generated/client.js';
// 치환된 표시용 텍스트는 v1 층에만 있다 — 아래 `loadShown` 주석 참고.
import { PrismaClient as V1Client } from '@prisma/client';

/**
 * 동기화 단계는 로마자로 적는다 — 게임 표기가 「동기화 IV」다.
 * 기프트 등급도 같은 규칙을 쓴다(`lib/queries/gifts.ts`).
 */
const UPTIE_ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
const roman = (n) => UPTIE_ROMAN[n] ?? String(n);

/** 부호를 붙여 적는다. 보정은 66 건이 0 이하라 부호가 뜻을 가른다. 빼기표(−)를 쓴다. */
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/**
 * 일러스트 교체 단추의 아이콘.
 *
 * **애셋에 없어서 그린다.** 스냅샷 4721 장을 훑어도 화살표가 교차하는 그림이 없다 —
 * `limbus-assets` 는 게임 콘텐츠 스프라이트만 담고 UI 껍데기는 담지 않는다. 유니코드
 * `⇄` 는 글꼴마다 굵기와 크기가 달라 카드의 금색 선과 안 맞아서 직접 그렸다.
 */
const SWAP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 8h14M15 5l3 3-3 3M20 16H6M9 13l-3 3 3 3"/></svg>`;


const ID = process.argv[2] ?? '10515';
/* 시안을 자주 다시 만들므로 스타일이 캐시에 묶이지 않게 한다. */
const STAMP = process.argv[3] ?? String(process.hrtime.bigint() % 1000000n);
const OUT = join(process.cwd(), 'publish', 'lab');
const db = new PrismaClient();
const v1 = new V1Client();

/* ── 어휘 ────────────────────────────────────────────────
   화면에 내는 말은 전부 게임 표기다. 자체 용어를 만들지 않는다. */

const SIN = {
	wrath: '분노',
	lust: '색욕',
	sloth: '나태',
	gluttony: '탐식',
	gloom: '우울',
	pride: '오만',
	envy: '질투',
};

const ATK = { slash: '참격', pierce: '관통', blunt: '타격' };

/** 스킬의 성격. 실측 attack 828 · guard 90 · counter 78 · evade 48 · non_action 1. */
const KIND = {
	attack: '공격',
	guard: '방어',
	counter: '반격',
	evade: '회피',
	non_action: '행동 아님',
};

const esc = (s) =>
	String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** 게임이 두 줄로 흘려 쓰는 이름이 있어 줄바꿈이 들어 있다. 한 줄로 편다. */
const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const sinIcon = (sin) => (sin ? `../assets/icons/limbus-assets/${sin}.webp` : null);
const atkIcon = (t) => (t ? `../assets/icons/limbus-assets/${cap(t)}.webp` : null);
const rarityIcon = (star) => `../assets/icons/limbus-assets/${'0'.repeat(star)}.webp`;

/**
 * 수감자 상징. `sinners/` 에 12 종이 id 그대로 들어 있다(1 이상 … 12 그레고르).
 * 목록 화면이 쓰는 것과 같은 그림이다(`lib/assets.ts` 의 `sinnerIcon`).
 *
 * 색이 수감자마다 다르게 박혀 있어 따로 물들이지 않는다 — 뫼르소는 남색, 파우스트는 분홍.
 */
const sinnerSymbol = (sinnerId) => `../assets/sinners/limbus-assets/${sinnerId}.webp`;

/**
 * 키워드 아이콘. **id 로는 못 찾는다.**
 *
 * 캐노니컬 id 와 파일명이 다섯 군데 갈린다 — `Laceration` → `Bleed.webp` ·
 * `Burst` → `Rupture` · `Vibration` → `Tremor` · `Breath` → `Poise` · `Combustion` → `Burn`.
 * 표를 새로 만들지 않고 **데이터가 이미 가진 `en` 이름을 그대로 열쇠로 준다** — 12 종 전부
 * 이 규칙으로 찾힌다. 목록 화면이 쓰는 규칙과 같다(`lib/queries/canonical/list.ts`).
 *
 * **애셋 키가 필드로 있으면 사라질 규칙이다** — `docs/backlog/13-frontend-data-debt.md` 6 번.
 */
const keywordIcon = (enName) => `../assets/icons/limbus-assets/${enName}.webp`;

/** 공격·방어 레벨과 속도. 셋 다 애셋에 있는 그림이라 새로 만들지 않는다. */
const STAT_ICON = {
	offense: '../assets/icons/limbus-assets/offense level.webp',
	defense: '../assets/icons/limbus-assets/defense level.webp',
	speed: '../assets/icons/limbus-assets/speed.webp',
};
const skillIcon = (id) => `../assets/skills/limbus-assets/${id}.webp`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * 시즌 표기. 목록과 같은 규칙을 쓴다.
 *   0 통상 · 1~8 시즌 N · 91NN 발푸르기스의 밤 N회 · 8000 콜라보
 */
function seasonLabel(raw) {
	if (raw === null || raw === undefined) return null;
	const n = String(raw);
	if (n === '0') return '통상';
	if (n === '8000') return '콜라보';
	if (n.startsWith('91') && n.length === 4) return `발푸르기스의 밤 ${Number(n.slice(2))}회`;
	return `시즌 ${n}`;
}

/* ── 읽기 ──────────────────────────────────────────────── */

async function load(id) {
	const ko = { where: { locale: 'ko' } };

	const identity = await db.identity.findUniqueOrThrow({
		where: { id },
		include: {
			texts: ko,
			sinner: { include: { texts: ko } },
			resists: true,
			speed: { orderBy: { uptie: "asc" } },
			keywords: true,
			associations: true,
			statuses: true,
			passives: { include: { passive: { include: { texts: ko } } }, orderBy: { level: 'asc' } },
			skills: {
				orderBy: [{ role: 'asc' }, { ordinal: 'asc' }],
				include: {
					skill: {
						include: {
							stages: {
								orderBy: { uptie: 'asc' },
								include: { texts: ko, coins: { where: { locale: 'ko' }, orderBy: { index: 'asc' } } },
							},
						},
					},
				},
			},
		},
	});

	const [keywordNames, keywordEn, associationNames, statusNames] = await Promise.all([
		db.keywordText.findMany({ where: { locale: 'ko' } }),
		db.keywordText.findMany({ where: { locale: 'en' } }),
		db.associationText.findMany({ where: { locale: 'ko' } }),
		db.status.findMany({ include: { texts: { where: { locale: 'ko' } } } }),
	]);

	const name = (rows, key, id) => rows.find((r) => r[key] === id)?.name ?? id;
	const text = identity.texts[0];

	return {
		id,
		sinnerId: identity.sinnerId,
		star: identity.star,
		season: identity.season,
		released: identity.releaseDate,
		hp: identity.hp,
		hpLevel: identity.hpLevel,
		defCorrection: identity.defCorrection,
		stagger: identity.stagger,
		title: line(text?.title ?? id),
		sinner: line(identity.sinner.texts[0]?.name ?? ''),
		art: {
			normal: `../assets/identities/limbus-assets/${id}_normal.webp`,
			profile: `../assets/identities/limbus-assets/${id}_normal_profile.webp`,
			awake: `../assets/identities/limbus-assets/${id}_gacksung.webp`,
		},
		resists: identity.resists.map((r) => ({ type: r.atkType, value: r.value })),
		speeds: identity.speed.map((s) => ({ uptie: s.uptie, min: s.min, max: s.max })),
		keywords: identity.keywords.map((k) => name(keywordNames, 'keywordId', k.keywordId)),
		keywordIds: identity.keywords.map((k) => k.keywordId),
		// 아이콘 열쇠. id 가 아니라 `en` 이름이다 — 아래 `keywordIcon` 주석 참고.
		keywordIconKeys: identity.keywords.map((k) => name(keywordEn, 'keywordId', k.keywordId)),
		associations: identity.associations.map((a) => name(associationNames, 'associationId', a.associationId)),
		statuses: identity.statuses.map((s) => name(statusNames, 'statusId', s.statusId)),
		passives: identity.passives.map((p) => ({
			id: p.passiveId,
			role: p.role,
			level: p.level,
			name: line(p.passive.texts[0]?.name ?? p.passiveId),
			desc: p.passive.texts[0]?.desc ?? '',
		})),
		/*
			**패닉은 이 인격의 스킬이 아니라 뺀다.**

			`1000104 E.G.O 침식` 하나를 인격 184 이 전부 공유한다 — 정신력이 바닥났을 때
			모두가 같은 것을 한다는 뜻이고 `kind` 도 `non_action` 이다. 공식 프리뷰 카드도
			싣지 않는다. 목록에 두면 이 인격에게만 있는 스킬처럼 읽힌다.
		*/
		skills: identity.skills.filter((k) => k.role !== 'panic').map((k) => {
			const stages = k.skill.stages;
			// 마지막 단계가 완성형이다. 시안에서는 그것만 낸다 — 단계 넘기기는 배치를 고른 뒤 얹는다.
			const last = stages[stages.length - 1];
			return {
				role: k.role,
				slot: k.slot,
				id: k.skillId,
				sin: k.skill.sin,
				atk: k.skill.attackType,
				kind: k.skill.kind,
				tier: k.skill.skillTier,
				uptie: last?.uptie ?? null,
				weight: last?.atkWeight ?? null,
				base: last?.baseValue ?? null,
				coin: last?.coinValue ?? null,
				name: line(last?.texts[0]?.name ?? k.skillId),
				desc: last?.texts[0]?.desc ?? '',
				coins: (last?.coins ?? []).map((c) => ({ index: c.index, effects: c.effects ?? [] })),
			};
		}),
	};
}

/* ── 조각 ──────────────────────────────────────────────── */

const head = (title) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — 인격 상세 시안</title>
<link rel="stylesheet" href="../css/tokens.css"><link rel="stylesheet" href="../css/globals.css">
<link rel="stylesheet" href="lab.css?r=${STAMP}"></head><body>
<header class="site-header"><div class="hbar"><div class="htitle"><a href="index.html">Mirror Tracker</a><span class="sub">인격 상세 시안</span></div></div>
<nav class="site-nav"><a href="index.html">시안 목록</a></nav></header>
<main class="site-main">`;

const foot = `</main></body></html>`;

const iconTag = (src, label) =>
	src ? `<span class="tag tag-icon"><img src="${src}" alt="">${esc(label)}</span>` : `<span class="tag">${esc(label)}</span>`;

/**
 * 스킬 한 장. 시안들이 같은 조각을 쓴다 — 다른 것은 배치뿐이다.
 *
 * **문구는 치환된 것을 쓴다.** 캐노니컬의 원문은 `[OnSucceedAttack] [Laceration] 2 부여`
 * 처럼 토큰이 박혀 있어 읽히지 않는다(`loadShown` 주석 참고).
 */
function skillCard(s, shown) {
	const { stageOf, coinOf, koOf } = shown;
	const st = stageOf.get(Number(s.id));
	const coins = s.coins
		.map((c, i) => {
			const ct = coinOf.get(`${Number(s.id)}:${c.index}`);
			const body = lines(ct?.desc, ct?.descRaw, koOf) || '<span class="absent">효과 없음</span>';
			return `<li><span class="coin-n">${ROMAN[i] ?? i + 1}</span><span class="coin-fx">${body}</span></li>`;
		})
		.join('');

	return `<article class="lab-skill">
	<div class="lab-skill-h">
		<img class="icon" src="${skillIcon(s.id)}" alt="" width="34" height="34" loading="lazy">
		<strong>${esc(st?.name ?? s.name)}</strong>
		<span class="lab-skill-tags">
			${iconTag(sinIcon(s.sin), SIN[s.sin] ?? s.sin ?? '—')}
			${iconTag(atkIcon(s.atk), ATK[s.atk] ?? s.atk ?? '—')}
			<span class="tag">${esc(KIND[s.kind] ?? s.kind)}</span>
			${s.tier ? `<span class="tag">${s.tier}티어</span>` : ''}
		</span>
	</div>
	<dl class="lab-nums">
		${s.weight != null ? `<div><dt>공격 가중</dt><dd>${s.weight}</dd></div>` : ''}
		${s.base != null ? `<div><dt>위력</dt><dd>${s.base}</dd></div>` : ''}
		${s.coin != null ? `<div><dt>코인 위력</dt><dd>${s.coin}</dd></div>` : ''}
		<div><dt>코인</dt><dd>${s.coins.length}</dd></div>
	</dl>
	<div class="lab-desc">${lines(st?.desc, st?.descRaw, koOf)}</div>
	<ul class="lab-coins">${coins}</ul>
</article>`;
}

function passiveCard(p, shown) {
	const t = shown.passiveOf.get(p.id);
	return `<article class="lab-passive">
	<div class="lab-skill-h"><strong>${esc(p.name)}</strong>
		<span class="lab-skill-tags"><span class="tag">${p.role === 'supporter' ? '서포트' : '전투'}</span><span class="tag">동기화 ${roman(p.level)}</span></span>
	</div>
	<div class="lab-desc">${lines(t?.desc ?? p.desc, t?.descRaw ?? p.desc, shown.koOf)}</div>
</article>`;
}

const facts = (d) => `<dl class="facts">
	<div><dt>체력</dt><dd>${d.hp ?? '—'}</dd></div>
	<div><dt>방어 보정</dt><dd>${d.defCorrection ?? '—'}</dd></div>
	<div><dt>스태거</dt><dd>${(d.stagger ?? []).join(' / ') || '—'}</dd></div>
	<div><dt>출시일</dt><dd>${esc(d.released ?? '—')}</dd></div>
</dl>`;

const resistList = (d) =>
	`<ul class="lab-resist">${d.resists
		.map(
			(r) =>
				`<li><img class="icon" src="${atkIcon(r.type)}" alt="" width="18" height="18"><span>${
					ATK[r.type] ?? r.type
				}</span><b>×${r.value}</b></li>`,
		)
		.join('')}</ul>`;

const speedList = (d) =>
	`<ul class="lab-speed">${d.speeds
		.map((s) => `<li><span>동기화 ${roman(s.uptie)}</span><b>${s.min} – ${s.max}</b></li>`)
		.join('')}</ul>`;

const chips = (arr) =>
	arr.length ? arr.map((v) => `<span class="tag">${esc(v)}</span>`).join('') : '<span class="absent">없음</span>';

/** 이름·등급·시즌. 세 시안이 같은 것을 말하되 놓는 자리가 다르다. */
const titleBits = (d) => ({
	rank: `<img class="lab-rank" src="${rarityIcon(d.star)}" alt="${'0'.repeat(d.star)}">`,
	season: seasonLabel(d.season) ? `<span class="tag">${seasonLabel(d.season)}</span>` : '',
	sinner: `<span class="tag">${esc(d.sinner)}</span>`,
});

/* ── 시안 ──────────────────────────────────────────────── */

/**
 * A. 히어로 머리.
 *
 * 초상을 전폭으로 깔고 이름·등급·시즌을 그 위에 얹는다. 목록 카드를 그대로 키운 꼴이라
 * 목록에서 넘어온 눈이 같은 것을 본다. 대신 첫 화면에서 스킬이 밀린다.
 */
function variantA(d, shown) {
	const t = titleBits(d);
	return `${head(d.title)}
<section class="lab-hero">
	<img class="lab-hero-art" src="${d.art.normal}" alt="">
	<div class="lab-hero-body">
		<div class="lab-hero-title">${t.rank}<h1>${esc(d.title)}</h1></div>
		<div class="card-meta">${t.sinner}${t.season}</div>
	</div>
</section>
<div class="grid2">
	<div>
		<section class="panel"><div class="panel-h"><h3>스킬</h3><span class="hint">${d.skills.length}</span></div>
			<div class="panel-b lab-stack">${d.skills.map((s) => skillCard(s, shown)).join('')}</div></section>
		<section class="panel"><div class="panel-h"><h3>패시브</h3><span class="hint">${d.passives.length}</span></div>
			<div class="panel-b lab-stack">${d.passives.map((p) => passiveCard(p, shown)).join('')}</div></section>
		${statusPanel(d, shown)}
	</div>
	<aside>
		<section class="panel"><div class="panel-h"><h3>기본</h3></div><div class="panel-b">${facts(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>저항</h3></div><div class="panel-b">${resistList(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>속도</h3></div><div class="panel-b">${speedList(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>키워드</h3></div><div class="panel-b">${chips(d.keywords)}</div></section>
		<section class="panel"><div class="panel-h"><h3>소속</h3></div><div class="panel-b">${chips(d.associations)}</div></section>
	</aside>
</div>
${foot}`;
}

/**
 * B. 좌측 고정.
 *
 * 초상과 수치를 왼쪽에 붙여 두고 스킬만 오른쪽에서 흐른다. 스킬을 읽는 동안 등급과 저항이
 * 계속 보이는 것이 이 배치의 값이다. 넓은 화면을 전제한다.
 */
function variantB(d, shown) {
	const t = titleBits(d);
	return `${head(d.title)}
<div class="lab-split">
	<aside class="lab-side">
		<img class="lab-side-art" src="${d.art.normal}" alt="">
		<div class="lab-side-title">${t.rank}<h1>${esc(d.title)}</h1></div>
		<div class="card-meta">${t.sinner}${t.season}</div>
		<section class="panel"><div class="panel-h"><h3>기본</h3></div><div class="panel-b">${facts(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>저항</h3></div><div class="panel-b">${resistList(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>속도</h3></div><div class="panel-b">${speedList(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>키워드 · 소속</h3></div><div class="panel-b">${chips([
			...d.keywords,
			...d.associations,
		])}</div></section>
	</aside>
	<div class="lab-main">
		<section class="panel"><div class="panel-h"><h3>스킬</h3><span class="hint">${d.skills.length}</span></div>
			<div class="panel-b lab-stack">${d.skills.map((s) => skillCard(s, shown)).join('')}</div></section>
		<section class="panel"><div class="panel-h"><h3>패시브</h3><span class="hint">${d.passives.length}</span></div>
			<div class="panel-b lab-stack">${d.passives.map((p) => passiveCard(p, shown)).join('')}</div></section>
		${statusPanel(d, shown)}
	</div>
</div>
${foot}`;
}

/**
 * C. 띠 머리 + 넓은 스킬.
 *
 * 초상을 작게 두고 이름·등급·시즌·저항·속도를 한 띠에 압축한다. 스킬이 전폭을 쓰므로
 * 코인 효과가 줄바꿈 없이 들어간다. 그림을 크게 보고 싶은 사람에게는 아쉽다.
 */
function variantC(d, shown) {
	const t = titleBits(d);
	return `${head(d.title)}
<section class="lab-band">
	<img class="lab-band-art" src="${d.art.profile}" alt="">
	<div class="lab-band-body">
		<div class="lab-hero-title">${t.rank}<h1>${esc(d.title)}</h1></div>
		<div class="card-meta">${t.sinner}${t.season}${d.keywords
			.map((k) => `<span class="tag">${esc(k)}</span>`)
			.join('')}</div>
	</div>
	<div class="lab-band-nums">
		<div class="lab-band-col"><h4>저항</h4>${resistList(d)}</div>
		<div class="lab-band-col"><h4>속도</h4>${speedList(d)}</div>
		<div class="lab-band-col"><h4>기본</h4>${facts(d)}</div>
	</div>
</section>
<section class="panel"><div class="panel-h"><h3>스킬</h3><span class="hint">${d.skills.length}</span></div>
	<div class="panel-b lab-wide">${d.skills.map((s) => skillCard(s, shown)).join('')}</div></section>
<section class="panel"><div class="panel-h"><h3>패시브</h3><span class="hint">${d.passives.length}</span></div>
	<div class="panel-b lab-wide">${d.passives.map((p) => passiveCard(p, shown)).join('')}</div></section>
${statusPanel(d, shown)}
<script>
/*
	레벨은 미리 그려 둘 수 없다.

	앞선 시안은 단계를 몇 개만 두고 CSS 의 :has() 로 골랐지만, 1~60 을 자유롭게 고르려면 값을
	그때 계산해야 한다. **여기서만 자바스크립트를 쓴다** — 동기화·일러스트는 여전히 CSS 다.

	체력 = 기본 체력 + 레벨당 증가 × 레벨. 게젤샤프트의 값 둘(212 · 241)과 소수점 버림까지
	맞는 것을 확인했다.
*/
(() => {
	const hp = document.getElementById('hp');
	const range = document.getElementById('lv');
	const num = document.getElementById('lvn');
	const base = Number(hp.dataset.base);
	const per = Number(hp.dataset.per);
	const atk = document.getElementById('atklv');
	const def = document.getElementById('deflv');
	const corr = Number(def.dataset.corr);
	const draw = (v) => {
		const lv = Math.min(60, Math.max(1, Math.round(Number(v) || 1)));
		range.value = num.value = lv;
		hp.textContent = Math.floor(base + per * lv);
		// 공격 레벨 = 레벨. 방어 레벨 = 레벨 + 보정. 피해 배율 = 1 + 0.03 × (공격 − 방어).
		atk.textContent = lv;
		def.textContent = lv + corr;
	};
	range.addEventListener('input', (e) => draw(e.target.value));
	num.addEventListener('change', (e) => draw(e.target.value));
})();
</script>
${foot}`;
}

/**
 * D. 히어로 머리 + 좌측 고정.
 *
 * A 의 첫인상과 B 의 읽기를 합친 것이다. 초상은 전폭으로 한 번 보여 주고 높이를 낮춰
 * 스킬이 첫 화면에 걸리게 하며, 그 아래에서는 수치가 왼쪽에 붙어 따라온다.
 *
 * **머리의 초상과 옆의 초상을 겹쳐 두지 않는다** — 같은 그림을 두 번 내면 자리만 먹는다.
 * 왼쪽에는 3동기화 그림을 둔다. 둘이 다른 그림이라 함께 볼 값이 있다.
 */
function variantD(d, shown) {
	const t = titleBits(d);
	return `${head(d.title)}
<section class="lab-hero lab-hero--slim">
	<img class="lab-hero-art" src="${d.art.normal}" alt="">
	<div class="lab-hero-body">
		<div class="lab-hero-title">${t.rank}<h1>${esc(d.title)}</h1></div>
		<div class="card-meta">${t.sinner}${t.season}${d.keywords
			.map((k) => `<span class="tag">${esc(k)}</span>`)
			.join('')}</div>
	</div>
</section>
<div class="lab-split">
	<aside class="lab-side">
		<img class="lab-side-art" src="${d.art.awake}" alt="">
		<p class="lab-side-cap">동기화 III</p>
		<section class="panel"><div class="panel-h"><h3>기본</h3></div><div class="panel-b">${facts(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>저항</h3></div><div class="panel-b">${resistList(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>속도</h3></div><div class="panel-b">${speedList(d)}</div></section>
		<section class="panel"><div class="panel-h"><h3>소속</h3></div><div class="panel-b">${chips(d.associations)}</div></section>
	</aside>
	<div class="lab-main">
		<section class="panel"><div class="panel-h"><h3>스킬</h3><span class="hint">${d.skills.length}</span></div>
			<div class="panel-b lab-stack">${d.skills.map((s) => skillCard(s, shown)).join('')}</div></section>
		<section class="panel"><div class="panel-h"><h3>패시브</h3><span class="hint">${d.passives.length}</span></div>
			<div class="panel-b lab-stack">${d.passives.map((p) => passiveCard(p, shown)).join('')}</div></section>
		${statusPanel(d, shown)}
	</div>
</div>
${foot}`;
}

/* ── 기믹 키워드 설명 ──────────────────────────────────────
   **게임 데이터에 없는 것이라 밖에서 가져왔다.** 상태 설명이 「{1}번 … {0}만큼」 꼴인데
   그 두 자리가 서로 다른 것이라는 사실을 어느 출처도 말하지 않는다.

   나무위키 「Limbus Company/키워드」 문서에서 확인했다(2026-08-05). 문장을 옮겨 적지 않고
   사실만 우리 말로 줄여 적는다.

   **여기 두는 것은 임시다.** 밖에서 온 지식이라 캐노니컬에 넣을 수 없고(ADR-04),
   `app` 스키마의 어휘 표가 제자리다 — `docs/backlog/13-frontend-data-debt.md` 10 번. */

/**
 * 상태 설명.
 *
 * 게임 데이터의 설명은 수치 자리가 `{0}` · `{1}` 로 비어 있는 틀이라 그대로는 읽히지
 * 않는다. 나무위키 「Limbus Company/키워드」의 정의 문장을 그대로 쓴다(2026-08-05 확인).
 * 「효과 위력」·「횟수」·「수치」가 무엇인지가 문장 안에 이미 들어 있다.
 *
 * `canonical.status` 의 id 를 열쇠로 쓴다. 여기 없는 상태는 게임 데이터의 문장을
 * `generalize()` 로 다듬어 낸다.
 *
 * **여기 두는 것은 임시다.** 게임 데이터가 아니라 밖에서 온 값이라 캐노니컬에 넣을 수
 * 없고(ADR-04), `app` 스키마의 어휘 표가 제자리다 —
 * `docs/backlog/13-frontend-data-debt.md` 10 번.
 */
const STATUS_DESC = {
	/* 기믹 일곱 */
	Combustion: '턴 종료 시, 효과 위력만큼 고정 피해를 받고 횟수 1 감소',
	Laceration:
		'공격 스킬의 코인 판정 시, 효과 위력만큼 고정 체력 피해를 받음. 공격 스킬의 코인 판정 후 횟수 1 감소',
	Vibration: '진동 폭발 스킬로 피격 시, 효과 위력만큼 흐트러짐 손상. 턴 종료 후 횟수 1 감소',
	Burst: '공격 스킬로 피격 시, 효과 위력만큼 고정 체력 피해를 받음. 피격 후 횟수 1 감소',
	Sinking:
		'공격 스킬로 피격 시, 효과 위력만큼 고정 정신력 피해를 받음 (정신력이 없는 대상에게는 우울 속성 피해로 적용됨) 피격 후 횟수 1 감소',
	Breath: '적중 시 효과 위력에 비례한 확률로 치명타 피해를 입힘. 턴 종료 시, 치명타 발동 후 횟수 1 감소',
	Charge: '소모 시 특정 스킬의 위력이 상승함. 횟수를 최대 20까지 얻을 수 있음. 턴 종료 시 횟수 1 감소',

	/* 전투 중 자주 붙는 것 */
	Paralysis: '한 턴 동안 수치만큼 코인 위력이 0으로 고정',
	Vulnerable: '한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)',
	Protection: '한 턴 동안 스킬로 받는 피해가 수치에 비례하여 감소 (최대 10)',
	Agility: '한 턴 동안 속도가 수치만큼 증가',
	Binding: '한 턴 동안 속도가 수치만큼 감소',
	ResultEnhancement: '한 턴 동안 스킬의 최종 위력이 수치만큼 증가',
	ResultReduction: '한 턴 동안 스킬의 최종 위력이 수치만큼 감소',
	Enhancement: '한 턴 동안 공격 스킬의 최종 위력이 수치만큼 증가',
	Reduction: '한 턴 동안 공격 스킬의 최종 위력이 수치만큼 감소',
	Endurance: '한 턴 동안 수비 스킬의 최종 위력이 수치만큼 증가',
	Disarming: '한 턴 동안 수비 스킬의 최종 위력이 수치만큼 감소',
	ParryingResultUp: '합 진행 시, 합 위력이 수치만큼 증가',
	ParryingResultDown: '합 진행 시, 합 위력이 수치만큼 감소',
	PlusCoinValueUp: '한 턴 동안 더하기 코인 위력이 수치만큼 증가',
	PlusCoinValueDown: '한 턴 동안 더하기 코인 위력이 수치만큼 감소',
	MinusCoinValueUp: '한 턴 동안 빼기 코인 위력이 수치만큼 증가',
	MinusCoinValueDown: '한 턴 동안 빼기 코인 위력이 수치만큼 감소',
	AttackDmgUp: '한 턴 동안 스킬로 가하는 피해가 수치에 비례하여 10%씩 증가 (최대 10)',
	AttackDmgDown: '한 턴 동안 스킬로 가하는 피해가 수치에 비례하여 10%씩 감소 (최대 10)',
	AttackUp: '한 턴 동안 공격 레벨이 수치에 비례하여 증가',
	AttackDown: '한 턴 동안 공격 레벨이 수치에 비례하여 감소',
	DefenseUp: '한 턴 동안 방어 레벨이 수치에 비례하여 증가',
	DefenseDown: '한 턴 동안 방어 레벨이 수치에 비례하여 감소',
	TakeHpHealIncrease: '이번 턴 동안 패시브, 스킬, 코인의 효과로 회복하는 체력 +10% (최대 5)',
	TakeHpHealReduce: '이번 턴 동안 패시브, 스킬, 코인의 효과로 회복하는 체력 -10% (최대 5)',
	Inactible: '1턴 동안 행동하지 않음',
	Aggro: '집중 전투에서 도발치가 높은 슬롯일수록 적에게 공격받을 확률 증가함',
	AttackLevelAdder: '한 턴 동안 공격 레벨이 수치에 비례하여 증가',
	AttackDmgUp_Weak: '한 턴 동안 약점 공격 시 가하는 피해가 수치에 비례하여 증가',

	/* 둘 이상의 인격·E.G.O·기프트가 공유하는 것 */
	Bullet: '특정 스킬 사용 시 탄환이 소모됨. 탄환이 없을 때 공격이 취소됨',
	Muckworm: '턴 종료 시 수치만큼 탐식 피해를 받고 출혈 횟수가 1 증가한 뒤 수치 1 감소',
	Curse:
		'턴 종료 시 다음 턴에 공격 위력 감소 1, 수비 위력 감소 1, 공격 레벨 감소 2, 방어 레벨 감소 2 중 무작위 1개의 효과를 얻고, 수치 1 감소',
	DimensionRift: '턴 종료 시 수치만큼 파열 횟수가 증가한 뒤 이 효과 소멸',
	BurstProtection: '한 턴 동안 파열 효과로 받는 피해 수치당 1 감소',
	Assemble: '이번 턴 동안 못이 부여된 대상 공격 시 최종 위력이 수치만큼 증가',
	AssemblePersonality: '이번 턴 동안 못이 부여된 대상 공격 시 최종 위력이 수치만큼 증가',
	ChargeForceField:
		'(충전 역장 수치 × 3)만큼 보호막을 얻음. 그만큼 보호막을 잃으면 충전 역장 1 감소. 턴 종료 시 충전 횟수를 충전 역장 수치만큼 얻고, 충전 역장과 그 보호막이 소멸',
};

/*
	속성별 피해량·취약·보호.

	위키가 틀로 적어 둔 것이다 — 「(공격 유형/죄악 속성) 스킬로 가하는/받는 피해량이
	수치에 비례하여 10%씩 증가/감소 (최대 10)」. 40 종이 같은 꼴이라 표를 손으로 늘어놓지
	않고 그 틀에 속성 이름만 끼워 넣는다.
*/
const ATTR = {
	Slash: '참격', Penetrate: '관통', Hit: '타격',
	Crimson: '분노', Scarlet: '색욕', Amber: '나태',
	Shamrock: '탐식', Azure: '우울', Indigo: '오만', Violet: '질투',
};

for (const [key, name] of Object.entries(ATTR)) {
	const give = (dir) => `한 턴 동안 ${name} 속성 스킬로 가하는 피해량이 수치에 비례하여 10%씩 ${dir} (최대 10)`;
	const take = (dir) => `한 턴 동안 ${name} 속성 스킬로 받는 피해량이 수치에 비례하여 10%씩 ${dir} (최대 10)`;
	STATUS_DESC[`${key}DamageUp`] = give('증가');
	STATUS_DESC[`${key}DamageDown`] = give('감소');
	STATUS_DESC[`${key}TakeDamageUp`] = take('증가');
	STATUS_DESC[`${key}TakeDamageDown`] = take('감소');
	// 속성별 위력 증감도 같은 틀이다 — 「한 턴 동안 스킬의 최종 위력이 수치만큼 증가/감소」.
	STATUS_DESC[`${key}ResultUp`] = `한 턴 동안 ${name} 속성 스킬의 최종 위력이 수치만큼 증가`;
	STATUS_DESC[`${key}ResultDown`] = `한 턴 동안 ${name} 속성 스킬의 최종 위력이 수치만큼 감소`;
}

/* ── 표시용 텍스트 ─────────────────────────────────────── */

/**
 * 치환된 스킬·코인 문구.
 *
 * **캐노니컬이 이것을 담지 않았다.** `skill_coin.effects` 는 `[OnSucceedAttack]
 * [Laceration] 2 부여` 처럼 토큰이 박힌 원문이다. v1 은 같은 줄을 두 벌로 갖고 있다 —
 * `desc` 는 「[적중시] 출혈 2 부여」로 치환된 것이고 `descRaw` 는 토큰과
 * `<style="highlight">` 강조 표시가 남은 것이다.
 *
 * 프로젝트문의 프리뷰 카드가 타이밍 태그를 지우지 않고 색으로 가르는 것을 보면,
 * **치환된 쪽을 쓰되 태그와 상태 이름을 표시로 살리는 것**이 원작에 맞다. 그래서 둘 다
 * 읽는다 — 문장은 `desc`, 어느 낱말이 상태인지는 `descRaw` 의 토큰으로 안다.
 *
 * **이 곁눈질은 데이터층에 있어야 한다** — 캐노니컬이 `desc` · `desc_raw` 를 담으면
 * 화면이 두 층을 동시에 읽을 이유가 없다. `docs/backlog/13-frontend-data-debt.md` 8 번.
 */
async function loadShown(skillIds) {
	const ids = skillIds.map(Number);
	const [stages, coins, statusTexts, passiveTexts] = await Promise.all([
		v1.skillStageText.findMany({ where: { skillId: { in: ids }, locale: 'ko' } }),
		v1.skillCoinText.findMany({ where: { skillId: { in: ids }, locale: 'ko' } }),
		db.status.findMany({ include: { texts: { where: { locale: 'ko' } } } }),
		// 패시브도 같다 — 캐노니컬 `passive_text.desc` 는 토큰이 박힌 원문이다.
		v1.passiveText.findMany({ where: { locale: 'ko' } }),
	]);

	/*
		상태는 이름만이 아니라 **설명과 그림까지** 갖고 있다. 화면이 그 셋을 다 쓴다 —
		본문에서는 이름만 보이고, 눌러서 내려가면 설명이 있다.
	*/
	const koOf = new Map();
	const stOf = new Map();
	for (const st of statusTexts) {
		const t = st.texts[0];
		if (!t) continue;
		koOf.set(st.id, t.name);
		stOf.set(st.id, { id: st.id, name: t.name, desc: t.desc ?? '', sprite: st.sprite });
	}

	/*
		**두 층의 동기화 단계 수가 다르다.** 캐노니컬은 1~5 를 갖고 v1 은 1~4 다. 캐노니컬의
		마지막 단계로 v1 을 찾으면 하나도 걸리지 않는다 — 그래서 v1 쪽에서 스킬마다 가장
		높은 단계를 스스로 골라 쓴다.
	*/
	const top = new Map();
	for (const r of stages) top.set(r.skillId, Math.max(top.get(r.skillId) ?? 0, r.uptie));

	const stageOf = new Map();
	for (const r of stages) if (r.uptie === top.get(r.skillId)) stageOf.set(r.skillId, r);

	const coinOf = new Map();
	for (const r of coins) {
		if (r.uptie !== top.get(r.skillId)) continue;
		coinOf.set(`${r.skillId}:${r.index}`, r);
	}
	/*
		단계별로도 담는다.

		**계산기를 만들지 않으므로 동기화는 수치를 다시 계산하는 장치가 아니다.** 단계마다
		스킬 문구가 다르니 「무엇을 보여줄지」만 바꾼다.
	*/
	const stageAt = new Map();
	for (const r of stages) stageAt.set(`${r.skillId}:${r.uptie}`, r);
	const coinAt = new Map();
	for (const r of coins) coinAt.set(`${r.skillId}:${r.uptie}:${r.index}`, r);

	/*
		**단계 행은 바뀔 때만 있다.**

		1051504 방어 스킬은 v1 에 1 · 4 단계만 있다 — 2 · 3 에서는 문구가 그대로라 행이
		없을 뿐 스킬이 사라진 것이 아니다. 그런데 그 단계를 찾으면 빈손이라 아코디언이
		펼쳐지지 않았다. **앞 단계를 이어서 쓴다.**

		1051503 은 다르다 — 3 단계부터 행이 생긴다. 캐노니컬도 같아서(1051503 은 uptie 3
		부터) 그 앞에서는 **정말로 쓸 수 없는 스킬**이다. 이월할 앞 단계가 없으면 그렇게
		읽고 화면이 「동기화 N 부터」라고 밝힌다.
	*/
	const uptieOf = new Map();
	for (const r of stages) {
		const list = uptieOf.get(r.skillId) ?? [];
		list.push(r.uptie);
		uptieOf.set(r.skillId, list.sort((a, b) => a - b));
	}
	/** 고른 단계 이하에서 가장 늦은 것. 없으면 그 단계에는 스킬이 없다. */
	const at = (skillId, uptie) => {
		const list = uptieOf.get(skillId) ?? [];
		let found = null;
		for (const u of list) if (u <= uptie) found = u;
		return found;
	};
	const firstUptie = (skillId) => (uptieOf.get(skillId) ?? [])[0] ?? null;

	const passiveOf = new Map(passiveTexts.map((t) => [t.passiveId, t]));
	return { stageOf, coinOf, stageAt, coinAt, at, firstUptie, koOf, stOf, top, passiveOf };
}

/**
 * 한 줄을 색으로 가른다.
 *
 * 두 가지를 집는다 — 줄 앞의 `[적중시]` 같은 **타이밍 태그**와 문장 속의 **상태 이름**이다.
 * 어느 낱말이 상태인지는 원문(`descRaw`)의 `[Token]` 을 한국어 이름으로 바꿔 알아낸다.
 * 게임이 색으로 가르는 것과 같은 자리다.
 */
function paint(shownLine, rawLine, koOf) {
	const hits = [...String(rawLine ?? '').matchAll(/\[([A-Za-z][A-Za-z0-9_]*)\]/g)]
		.map((m) => [m[1], koOf.get(m[1])])
		.filter(([, n]) => n);

	let out = esc(shownLine);
	// 긴 이름을 먼저 바꾼다 — 짧은 이름이 긴 이름 안에 들어 있으면 조각난다.
	const seen = new Map(hits);
	for (const [id, n] of [...seen].sort((a, b) => b[1].length - a[1].length)) {
		// 이름을 누르면 아래 「상태」 칸의 그 자리로 내려간다.
		out = out.split(esc(n)).join(`<a class="fx-st" href="#st-${esc(id)}">${esc(n)}</a>`);
	}
	return out.replace(/^\[([^\]]+)\]/, '<span class="fx-when">[$1]</span>');
}

/**
 * 본문에 나오는 상태를 모은다.
 *
 * **인격이 다룬다고 등록된 것이 아니라 실제로 글에 나오는 것**을 모은다. 두 목록이
 * 어긋나는데(`identity_status` 는 넓게 잡혀 있다), 읽는 사람이 궁금해하는 것은 지금 눈에
 * 보이는 낱말이다. 나오지 않는 상태를 아래에 늘어놓으면 찾을 이유가 없는 것을 읽힌다.
 */
function usedStatuses(d, shown) {
	const { stageOf, coinOf, passiveOf, stOf } = shown;
	const raws = [];
	for (const s of d.skills) {
		raws.push(stageOf.get(Number(s.id))?.descRaw);
		for (const c of s.coins) raws.push(coinOf.get(`${Number(s.id)}:${c.index}`)?.descRaw);
	}
	for (const p of d.passives) raws.push(passiveOf.get(p.id)?.descRaw);

	const ids = new Set();
	for (const raw of raws) {
		for (const m of String(raw ?? '').matchAll(/\[([A-Za-z][A-Za-z0-9_]*)\]/g)) {
			if (stOf.has(m[1])) ids.add(m[1]);
		}
	}
	return [...ids].map((id) => stOf.get(id)).sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * 수치 자리를 일반 설명으로 바꾼다.
 *
 * 게임이 상태 설명을 틀로 갖고 있어 수치 자리가 `{0}` · `{1}` 로 비어 있다. 실측으로
 * `{0}` 167 · `{1}` 18 · `{2}` 7 건이 쓰인다.
 *
 * **그 자리에 들어갈 수는 상태가 몇 겹 걸렸는지에 따라 매번 다르다.** 상세 화면은 특정
 * 전투의 값을 말하는 자리가 아니므로 채울 숫자가 없다.
 *
 * 그래서 **자리가 무엇인지를 그대로 적는다** — `{0}` 은 「효과 위력」이고 `{1}` · `{2}` 는
 * 「횟수」다. 기믹 일곱의 정의(`KEYWORD_DESC`)가 쓰는 말과 같아서 두 종류의 문장이 한
 * 말투로 읽힌다.
 *
 * 부호와 이어 붙이기도 함께 푼다.
 *
 *   ±{0}0%   →  (효과 위력×10)%만큼 증가 / 감소   51 건. 숫자를 이어 붙인 틀이라 곱으로 푼다
 *   ±{0}     →  효과 위력만큼 증가 / 감소         43 건. 「-3」 은 읽히지만 부호만 남으면 안 읽힌다
 *   {0}개    →  (효과 위력)개                     세는 말이 뒤에 붙으면 괄호로 묶는다
 *   {0}      →  효과 위력
 *   {1} {2}  →  횟수
 *
 * **이 규칙은 데이터층에 있어야 한다** — 표시용 문자열이 담기면 사라진다.
 * `docs/backlog/13-frontend-data-debt.md` 9 번.
 */
const generalize = (s) =>
	String(s ?? '')
		.replace(/([+\-−])\{0\}0%/g, (_, sign) => `(효과 위력×10)%만큼 ${sign === '+' ? '증가' : '감소'}`)
		.replace(/\{\d+\}0%/g, '(효과 위력×10)%')
		.replace(/([+\-−])\{0\}/g, (_, sign) => `효과 위력만큼 ${sign === '+' ? '증가' : '감소'}`)
		.replace(/\{0\}(?=[개번턴회명장])/g, '(효과 위력)')
		.replace(/\{0\}/g, '효과 위력')
		.replace(/\{\d+\}(?=[개번턴회명장])/g, '(횟수)')
		.replace(/\{\d+\}/g, '횟수');

/** 상태 칸. 공식 프리뷰도 패시브 옆에 이것을 붙인다. */
function statusPanel(d, shown) {
	const rows = usedStatuses(d, shown);
	if (!rows.length) return '';

	return `<section class="panel"><div class="panel-h"><h3>이 인격이 쓰는 상태</h3><span class="hint">${rows.length}</span></div>
	<div class="panel-b st-grid">${rows
		.map(
			(st) => `<article class="st-card" id="st-${esc(st.id)}">
		<div class="st-head">
			${st.sprite ? `<img src="../assets/statuses/limbus-assets/${esc(st.sprite)}.webp" alt="" loading="lazy">` : ''}
			<strong>${esc(st.name)}</strong>
		</div>
		<div class="st-body">${
			STATUS_DESC[st.id] || st.desc
				? esc(STATUS_DESC[st.id] ?? generalize(st.desc))
						.split('\n')
						.filter((v) => v.trim())
						.map((v) => `<p class="fx-line">${v}</p>`)
						.join('')
				: '<p class="absent">설명 없음</p>'
		}</div>
	</article>`,
		)
		.join('')}</div></section>`;
}

const lines = (text, raw, koOf) => {
	const a = String(text ?? '').split('\n').filter((v) => v.trim());
	const b = String(raw ?? '').split('\n');
	return a.map((v, i) => `<p class="fx-line">${paint(v, b[i], koOf)}</p>`).join('');
};

/** 코인 수는 동전 그림으로 센다. 게임의 프리뷰 카드가 그렇게 한다. */
const coinDots = (n) =>
	`<span class="coin-dots">${'<img src="../assets/icons/limbus-assets/coin.webp" alt="">'.repeat(n)}</span>`;

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ'];

/**
 * E. 프로젝트문 프리뷰 구조.
 *
 * 공식 카드 세 장(IDENTITY INFO · SKILL · PASSIVE)의 짜임을 한 화면에 옮긴 것이다.
 *
 *   - 우상단에 인격명 배너 + 등급, 그 아래 수감자 배너. 공식이 쓰는 위계 그대로다
 *   - 스킬은 아이콘 + 동전 + 이름 배너(죄악색) + 효과 줄
 *   - 코인별 효과는 로마자 배지로 묶는다
 *   - 타이밍 태그와 상태 이름을 색으로 가른다
 *   - 각주 두 줄을 단다. 공식이 항상 붙이는 것이며 어느 단계 기준인지 밝히는 일이다
 */
function variantE(d, shown) {
	const { stageOf, coinOf, koOf, passiveOf } = shown;

	const skill = (s, label) => {
		const st = stageOf.get(Number(s.id));
		const body = lines(st?.desc, st?.descRaw, koOf);
		const coins = s.coins
			.map((c, i) => {
				const ct = coinOf.get(`${Number(s.id)}:${c.index}`);
				return `<li><span class="coin-r">${ROMAN[i] ?? i + 1}</span><div>${lines(ct?.desc, ct?.descRaw, koOf)}</div></li>`;
			})
			.join('');

		return `<article class="pm-skill">
	<div class="pm-skill-slot">${esc(label)}</div>
	<img class="pm-skill-icon" src="${skillIcon(s.id)}" alt="" loading="lazy">
	<div class="pm-skill-body">
		${coinDots(s.coins.length)}
		<div class="pm-name" data-sin="${esc(s.sin ?? 'none')}">${esc(st?.name ?? s.name)}</div>
		<div class="pm-lines">${body}</div>
		<ol class="pm-coins">${coins}</ol>
	</div>
</article>`;
	};

	const attacks = d.skills.filter((s) => s.role === 'attack');
	const others = d.skills.filter((s) => s.role !== 'attack');

	return `${head(d.title)}
<section class="pm-hero">
	<img class="pm-hero-art" src="${d.art.normal}" alt="">
	<div class="pm-hero-name">
		<div class="pm-banner pm-banner--id">${esc(d.title)}<img class="lab-rank" src="${rarityIcon(d.star)}" alt=""></div>
		<div class="pm-banner pm-banner--sinner">${esc(d.sinner)}</div>
	</div>
	<div class="pm-hero-foot">
		<h2>IDENTITY INFO</h2>
		<p>* 최대 레벨 · 최대 동기화 기준입니다.</p>
		<p>* 실제 수치는 데이터 갱신에 따라 달라질 수 있습니다.</p>
	</div>
</section>

<section class="panel"><div class="panel-h"><h3>스킬</h3><span class="hint">${d.skills.length}</span></div>
	<div class="panel-b pm-stack">
		${attacks.map((s, i) => skill(s, `스킬 ${i + 1}`)).join('')}
		${others.map((s) => skill(s, s.role === 'defense' ? '방어' : '패닉')).join('')}
	</div></section>

<section class="panel"><div class="panel-h"><h3>패시브</h3><span class="hint">${d.passives.length}</span></div>
	<div class="panel-b pm-stack">${d.passives
		.map(
			(p) => `<article class="pm-passive">
		<div class="pm-skill-slot">${p.role === 'supporter' ? '서포트 패시브' : '패시브'}</div>
		<div class="pm-skill-body">
			<div class="pm-name" data-sin="none">${esc(p.name)}</div>
			<div class="pm-lines">${(() => {
				const t = passiveOf.get(p.id);
				return lines(t?.desc ?? p.desc, t?.descRaw ?? p.desc, koOf);
			})()}</div>
			<p class="pm-req">동기화 ${roman(p.level)}</p>
		</div>
	</article>`,
		)
		.join('')}</div></section>

${statusPanel(d, shown)}

<div class="grid2">
	<section class="panel"><div class="panel-h"><h3>저항</h3></div><div class="panel-b">${resistList(d)}</div></section>
	<section class="panel"><div class="panel-h"><h3>속도 · 기본</h3></div><div class="panel-b">${speedList(d)}${facts(d)}</div></section>
</div>
${foot}`;
}

/**
 * F. 정보 카드.
 *
 * 단테의 게젤샤프트가 쓰는 상단 카드를 가져오되 **계산기는 만들지 않는다.** 그 사이트가
 * 스킬마다 한 화면을 먹는 것은 조건을 켜고 끄며 최종 피해를 다시 계산하기 때문이고,
 * 우리는 정보만 내므로 그 자리가 통째로 필요 없다.
 *
 * 그래서 스킬을 **한 줄 요약 + 펼치기**로 둔다. 다섯이 한 화면에 들어와 서로 비교되고,
 * 필요한 것만 열어 코인까지 본다.
 *
 * 동기화는 수치를 다시 계산하는 장치가 아니라 **무엇을 보여줄지 고르는 것**이다 — 단계마다
 * 스킬 문구와 속도가 다르다. 라디오와 `:has()` 로만 움직여 자바스크립트가 없다.
 */
function variantF(d, shown) {
	const { stageAt, coinAt, at, firstUptie, koOf } = shown;
	const upties = [...new Set(d.speeds.map((s) => s.uptie))].sort((a, b) => a - b);

	/*
		레벨.

		**체력은 레벨에 따라 는다** — `hp + hpLevel × 레벨` 이다. 단테의 게젤샤프트가 레벨
		60 에서 10515 를 212, 10116 을 241 로 내는데 이 식과 소수점 버림까지 맞는다
		(69 + 2.39×60 = 212.4 · 60 + 3.03×60 = 241.8). 두 인격으로 확인했다.
	*/
	const MAX_LEVEL = 60;

	/* 흐트러짐 구간. 배열이며 인격마다 수가 다르다. */
	const bar = `<span class="f-hp-bar">${(d.stagger ?? [])
		.map((v) => `<i style="left:${v}%"><b>${v}%</b></i>`)
		.join('')}</span>`;

	const stat = (label, value, icon) =>
		`<div class="f-stat"><span>${icon ? `<img src="${icon}" alt="">` : ''}${esc(label)}</span><b>${value}</b></div>`;

	const skill = (s, label) => {
		const id = Number(s.id);
		const first = firstUptie(id);
		return `<details class="f-skill">
		<summary>
			<img class="f-skill-icon" src="${skillIcon(s.id)}" alt="" loading="lazy">
			<span class="f-skill-slot">${esc(label)}</span>
			${upties
				.map((u) => {
					const su = at(id, u);
					const st = su ? stageAt.get(`${id}:${su}`) : null;
					return `<strong data-up="${u}">${esc(st?.name ?? s.name)}${
						su ? '' : ` <em class="f-locked">동기화 ${roman(first)} 부터</em>`
					}</strong>`;
				})
				.join('')}
			<span class="f-skill-tags">
				${coinDots(s.coins.length)}
				${iconTag(sinIcon(s.sin), SIN[s.sin] ?? '—')}
				${iconTag(atkIcon(s.atk), ATK[s.atk] ?? '—')}
			</span>
		</summary>
		${upties
			.map((u) => {
				const su = at(id, u);
				if (!su) {
					return `<div class="f-skill-body" data-up="${u}"><p class="absent">동기화 ${roman(first)} 부터 쓸 수 있다</p></div>`;
				}
				const st = stageAt.get(`${id}:${su}`);
				const coins = s.coins
					.map((c, i) => {
						const ct = coinAt.get(`${id}:${su}:${c.index}`);
						return ct
							? `<li><span class="coin-r">${ROMAN[i] ?? i + 1}</span><div>${lines(ct.desc, ct.descRaw, koOf)}</div></li>`
							: '';
					})
					.join('');
				return `<div class="f-skill-body" data-up="${u}">
			<div class="pm-lines">${lines(st?.desc, st?.descRaw, koOf)}</div>
			<ol class="pm-coins">${coins}</ol>
		</div>`;
			})
			.join('')}
	</details>`;
	};

	const attacks = d.skills.filter((s) => s.role === 'attack');
	const others = d.skills.filter((s) => s.role !== 'attack');
	const battle = d.passives.filter((p) => p.role !== 'supporter');
	const support = d.passives.filter((p) => p.role === 'supporter');

	const passivePanel = (title, rows) =>
		rows.length
			? `<section class="panel"><div class="panel-h"><h3>${title}</h3><span class="hint">${rows.length}</span></div>
	<div class="panel-b lab-stack">${rows.map((p) => passiveCard(p, shown)).join('')}</div></section>`
			: '';

	return `${head(d.title)}
<section class="f-card">
	<div class="f-art">
		<input type="checkbox" id="awake" hidden>
		<img class="f-art-normal" src="${d.art.normal}" alt="">
		<img class="f-art-awake" src="${d.art.awake}" alt="">
		<i class="f-mount"></i>
		<label for="awake" title="기본 · 3 동기화 일러스트 바꾸기" aria-label="일러스트 바꾸기">${SWAP_ICON}</label>
	</div>
	<div class="f-body">
		<header class="f-head">
			<div class="f-ident">
				<div class="f-title">
					<span class="f-emblem"><img src="${sinnerSymbol(
						d.sinnerId,
					)}" alt="" aria-hidden="true"></span>
					<img class="lab-rank" src="${rarityIcon(d.star)}" alt="${'0'.repeat(d.star)}">
					<h1>${esc(d.title)}<span class="f-sinner">${esc(d.sinner)}</span></h1>
				</div>
				<div class="f-affil">${chips(d.associations)}</div>
			</div>
			<dl class="f-file">
				<div><dt>NO.</dt><dd>${esc(String(d.id))}</dd></div>
				<div><dt>시즌</dt><dd>${esc(String(d.season ?? '—'))}</dd></div>
				<div><dt>출시</dt><dd>${esc(d.released ?? '—')}</dd></div>
			</dl>
		</header>

		<div class="f-picks">
			<div class="f-pick f-pick--lv">
				<span class="f-lab">레벨</span>
				<input class="f-lv-range" type="range" min="1" max="${MAX_LEVEL}" value="${MAX_LEVEL}" id="lv">
				<input class="f-lv-num" type="number" min="1" max="${MAX_LEVEL}" value="${MAX_LEVEL}" id="lvn" aria-label="레벨">
			</div>
			<div class="f-pick">
				<span class="f-lab">동기화</span>
				${upties
					.map(
						(u) =>
							`<input type="radio" name="up" id="up${u}" ${u === upties[upties.length - 1] ? 'checked' : ''} hidden><label for="up${u}">${roman(u)}</label>`,
					)
					.join('')}
			</div>
		</div>

		<div class="f-hp">
			<span class="f-lab">체력</span>
			<span class="f-hp-n" id="hp" data-base="${d.hp ?? 0}" data-per="${d.hpLevel ?? 0}">${Math.floor(
				(d.hp ?? 0) + (d.hpLevel ?? 0) * MAX_LEVEL,
			)}</span>
			${bar}
		</div>

		<div class="f-stats">
			<div class="f-statrow">
				<span class="f-lab">스탯</span>
				<div class="f-stat"><span><img src="${
					STAT_ICON.offense
				}" alt="">공격 레벨</span><b id="atklv">${MAX_LEVEL}</b></div>
				<div class="f-stat"><span><img src="${
					STAT_ICON.defense
				}" alt="">방어 레벨 <em>보정 ${signed(
					d.defCorrection ?? 0,
				)}</em></span><b id="deflv" data-corr="${d.defCorrection ?? 0}">${
					MAX_LEVEL + (d.defCorrection ?? 0)
				}</b></div>
				<div class="f-stat"><span><img src="${STAT_ICON.speed}" alt="">속도</span>${upties
					.map((u) => {
						const sp = d.speeds.find((x) => x.uptie === u);
						return `<b data-up="${u}">${sp ? `${sp.min}–${sp.max}` : '—'}</b>`;
					})
					.join('')}</div>
			</div>
			<div class="f-statrow">
				<span class="f-lab">저항</span>
				${d.resists.map((r) => stat(ATK[r.type] ?? r.type, `×${r.value}`, atkIcon(r.type))).join('')}
			</div>
		</div>

		<div class="f-tags">
			<div><span class="f-lab">키워드</span>${
				d.keywords.length
					? d.keywords
							.map(
								(k, i) =>
									`<span class="tag tag--icon"><img src="${keywordIcon(
										d.keywordIconKeys[i],
									)}" alt="">${esc(k)}</span>`,
							)
							.join('')
					: '<span class="absent">없음</span>'
			}</div>
		</div>
	</div>
</section>

<section class="panel"><div class="panel-h"><h3>스킬</h3><span class="hint">${d.skills.length}</span></div>
	<div class="panel-b f-skills">
		${attacks.map((s, i) => skill(s, `스킬 ${i + 1}`)).join('')}
		${others.map((s) => skill(s, '방어')).join('')}
	</div></section>

${passivePanel('전투 패시브', battle)}
${passivePanel('서포트 패시브', support)}
${statusPanel(d, shown)}
<script>
/*
	레벨은 미리 그려 둘 수 없다.

	앞선 시안은 단계를 몇 개만 두고 CSS 의 :has() 로 골랐지만, 1~60 을 자유롭게 고르려면 값을
	그때 계산해야 한다. **여기서만 자바스크립트를 쓴다** — 동기화·일러스트는 여전히 CSS 다.

	체력 = 기본 체력 + 레벨당 증가 × 레벨. 게젤샤프트의 값 둘(212 · 241)과 소수점 버림까지
	맞는 것을 확인했다.
*/
(() => {
	const hp = document.getElementById('hp');
	const range = document.getElementById('lv');
	const num = document.getElementById('lvn');
	const base = Number(hp.dataset.base);
	const per = Number(hp.dataset.per);
	const atk = document.getElementById('atklv');
	const def = document.getElementById('deflv');
	const corr = Number(def.dataset.corr);
	const draw = (v) => {
		const lv = Math.min(60, Math.max(1, Math.round(Number(v) || 1)));
		range.value = num.value = lv;
		hp.textContent = Math.floor(base + per * lv);
		// 공격 레벨 = 레벨. 방어 레벨 = 레벨 + 보정. 피해 배율 = 1 + 0.03 × (공격 − 방어).
		atk.textContent = lv;
		def.textContent = lv + corr;
	};
	range.addEventListener('input', (e) => draw(e.target.value));
	num.addEventListener('change', (e) => draw(e.target.value));
})();
</script>
${foot}`;
}

const INDEX = (d) => `${head('시안 목록')}
<div class="seclabel"><h2>인격 상세 시안</h2><span class="kr">${esc(d.title)} · ${esc(d.sinner)}</span><span class="rule"></span></div>
<ul class="plain">
	<li><a href="identity-a.html"><strong>A · 히어로 머리</strong></a><p class="lede">초상을 전폭으로 깔고 이름을 그 위에 얹는다. 목록 카드를 키운 꼴이라 넘어온 눈이 같은 것을 본다. 첫 화면에서 스킬이 밀린다.</p></li>
	<li><a href="identity-b.html"><strong>B · 좌측 고정</strong></a><p class="lede">초상과 수치를 왼쪽에 붙여 두고 스킬만 오른쪽에서 흐른다. 스킬을 읽는 동안 등급과 저항이 계속 보인다.</p></li>
	<li><a href="identity-c.html"><strong>C · 띠 머리 + 넓은 스킬</strong></a><p class="lede">초상을 작게 두고 수치를 한 띠에 압축한다. 스킬이 전폭을 써서 코인 효과가 줄바꿈 없이 들어간다.</p></li>
	<li><a href="identity-f.html"><strong>F · 정보 카드 (계산기 없음)</strong></a><p class="lede">단테의 게젤샤프트의 상단 카드를 가져오되 계산기는 만들지 않는다. 스킬은 한 줄 요약 + 펼치기라 다섯이 한 화면에 들어온다. 동기화는 수치를 다시 계산하지 않고 무엇을 보여줄지만 고른다.</p></li>
	<li><a href="identity-e.html"><strong>E · 프로젝트문 프리뷰 구조</strong></a><p class="lede">공식 인격 프리뷰 카드(IDENTITY INFO · SKILL · PASSIVE)의 짜임을 옮겼다. 코인을 동전으로 세고 코인 효과를 로마자로 묶으며, 타이밍 태그와 상태 이름을 색으로 가른다.</p></li>
	<li><a href="identity-d.html"><strong>D · 히어로 머리 + 좌측 고정</strong></a><p class="lede">A 의 첫인상과 B 의 읽기를 합쳤다. 초상 높이를 낮춰 스킬이 첫 화면에 걸리게 하고, 그 아래에서는 수치가 왼쪽에 붙어 따라온다. 왼쪽 그림은 3 동기화다.</p></li>
</ul>
${foot}`;

/* ── 실행 ──────────────────────────────────────────────── */

const d = await load(ID);
const shown = await loadShown(d.skills.map((s) => s.id));

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'identity-a.html'), variantA(d, shown));
writeFileSync(join(OUT, 'identity-b.html'), variantB(d, shown));
writeFileSync(join(OUT, 'identity-c.html'), variantC(d, shown));
writeFileSync(join(OUT, 'identity-d.html'), variantD(d, shown));
writeFileSync(join(OUT, 'identity-e.html'), variantE(d, shown));
writeFileSync(join(OUT, 'identity-f.html'), variantF(d, shown));
writeFileSync(join(OUT, 'index.html'), INDEX(d));
await Promise.all([db.$disconnect(), v1.$disconnect()]);

console.log(`${d.title} · ${d.sinner} — 스킬 ${d.skills.length} · 패시브 ${d.passives.length} · 저항 ${d.resists.length} · 속도 ${d.speeds.length}`);
console.log('publish/lab/identity-{a,b,c}.html');
