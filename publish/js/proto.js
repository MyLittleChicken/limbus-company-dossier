/*
	프로토타입 거동.
	================

	이 파일이 하는 일은 셋이다.

	1. **축 색 훅을 붙인다.** 마크업에 죄악·키워드를 식별하는 속성이 없어서 아이콘 파일명에서
	   유도한다. 제품에 옮길 때는 서버 렌더가 `data-sin` · `data-kw` · `data-atk` 를 직접
	   내면 되고, 그러면 이 부분은 버린다. 구조 변경이 아니라 속성 하나다.

	2. **표기를 게임 표기로 바꾼다.** 현재 구현이 `attack` · `pride` · `slash` 같은 원본 enum
	   을 그대로 노출하고 있다. 게임 표기와 1:1 로 대응해야 하며 자체 용어를 만들지 않는다는
	   제약을 어긴 상태다. 한국어 라벨 맵은 이미 있고(`listSquadAxes` 의 `labels`) 편성 화면은
	   그것을 쓰는데 상세 화면만 쓰지 않는다. **여기서는 보여주기 위해 덮어쓰지만, 고칠 자리는
	   `components/uptie-skills.tsx` 다.**

	3. **정적 화면에서 상태 전환을 흉내낸다.** 내용까지 바꾸지는 못한다 — 덤프가 한 시점의
	   DOM 이기 때문이다. 동기화 단계 버튼이 눌린 표시만 바뀌고 수치는 그대로인 것이 그 예다.
*/

(() => {
	'use strict';

	/* ── 1. 축 색 훅 ─────────────────────────────────────── */

	const SINS = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']);
	const KEYWORDS = new Set([
		'bleed', 'burn', 'tremor', 'rupture', 'sinking', 'charge', 'poise',
		'haste', 'bind', 'fragile', 'poison',
	]);
	const ATK = new Set(['slash', 'pierce', 'blunt']);

	/** 축 색을 실을 수 있는 그릇. 아이콘에서 가장 가까운 것을 고른다. */
	const HOSTS = '.tag, .chip, .dist li, .skill-tile, .coins li, .res-track, .comp li';

	/**
	 * 파일명에서 축을 읽는다.
	 *
	 * 죄악 아이콘은 소문자 enum 그대로이고(`wrath.webp`) 키워드·공격 타입은 첫 글자만
	 * 대문자다(`Burn.webp`). 스킬 프레임은 `{죄악}-{등급}` 이고 `-bg` 짝이 있다
	 * (`wrath-2-bg.webp`) — 방어와 죄악 없는 스킬은 `def` 하나를 쓴다.
	 */
	function axisOf(src) {
		if (!src) return null;
		let base = src.split('/').pop() || '';
		try {
			base = decodeURIComponent(base);
		} catch {
			/* 인코딩이 깨진 이름은 그대로 둔다 */
		}
		base = base.replace(/\.(webp|png|jpe?g)$/i, '').toLowerCase();

		const frame = base.match(/^([a-z]+)-[1-9](?:-bg)?$/);
		if (frame) base = frame[1];

		if (base === 'def') return ['sin', 'none'];
		if (SINS.has(base)) return ['sin', base];
		if (KEYWORDS.has(base)) return ['kw', base];
		if (ATK.has(base)) return ['atk', base];
		return null;
	}

	const ATTR = { sin: 'data-sin', kw: 'data-kw', atk: 'data-atk' };

	/**
	 * 이름으로 축을 찾는 되짚기 표.
	 *
	 * 팩 상세의 분포는 아이콘 없이 이름만 낸다. 아이콘이 없으면 축을 모르므로 막대가 금색으로
	 * 물러서는데, 그것은 폴백이 옳게 동작한 결과이지 의도한 모습이 아니다.
	 * **제품에서는 서버가 `data-kw` 를 내면 되고 이 되짚기는 필요하지 않다.**
	 */
	const BY_NAME = {
		분노: ['sin', 'wrath'], 색욕: ['sin', 'lust'], 나태: ['sin', 'sloth'],
		탐식: ['sin', 'gluttony'], 우울: ['sin', 'gloom'], 오만: ['sin', 'pride'],
		질투: ['sin', 'envy'], 없음: ['sin', 'none'],
		출혈: ['kw', 'bleed'], 화상: ['kw', 'burn'], 진동: ['kw', 'tremor'],
		파열: ['kw', 'rupture'], 침잠: ['kw', 'sinking'], 충전: ['kw', 'charge'],
		호흡: ['kw', 'poise'],
		참격: ['atk', 'slash'], 관통: ['atk', 'pierce'], 타격: ['atk', 'blunt'],
	};

	function markAxes(root) {
		for (const img of root.querySelectorAll('img[src]')) {
			const axis = axisOf(img.getAttribute('src'));
			if (!axis) continue;
			const host = img.closest(HOSTS);
			if (!host) continue;
			const attr = ATTR[axis[0]];
			// 먼저 붙은 것을 덮지 않는다 — 한 그릇에 아이콘이 여럿일 때 첫 것이 그 행의 축이다.
			if (!host.hasAttribute(attr)) host.setAttribute(attr, axis[1]);
		}

		/*
			분포 행만 이름으로 되짚는다.

			`.dist li` 로 좁히는 이유는 그 안의 `.dist-key` 가 축 이름 자체이기 때문이다.
			범위를 넓히면 "없음"처럼 여러 뜻으로 쓰이는 낱말이 엉뚱한 곳에 색을 입힌다 —
			부재 표기가 죄악 색을 얻는 식이다.
		*/
		for (const row of root.querySelectorAll('.dist li')) {
			if (row.hasAttribute('data-sin') || row.hasAttribute('data-kw') || row.hasAttribute('data-atk')) continue;
			const key = row.querySelector('.dist-key');
			if (!key) continue;
			const hit = BY_NAME[key.textContent.trim()];
			if (hit) row.setAttribute(ATTR[hit[0]], hit[1]);
		}
	}

	/* ── 1-2. 팩 그림 합성 ───────────────────────────────── */

	/**
	 * 테마 팩 그림을 두 장으로 합성한다.
	 *
	 * 애셋이 `{sprite}.webp`(가운데가 빈 봉지)와 `{sprite}_boss.webp`(프레임 없는 투명
	 * 보스 그림) 두 장이고 게임은 그것을 겹쳐 쓴다. 34 종이 보스 그림을 갖는다.
	 *
	 * 목록 카드는 봉지만 내고 있어 가운데가 텅 빈 카드로 보인다. 상세의 「보스 층」 그림은
	 * 반대로 봉지 없이 보스만 떠 있다. 양쪽을 같은 구조로 합친다.
	 *
	 * **제품에서는 컴포넌트가 두 층을 직접 렌더해야 한다.** `<Icon>` 하나로는 표현할 수 없고
	 * `pack.icon` 과 `pack.bossIcon` 을 함께 받는 자리가 필요하다. 여기서는 파일명 규칙으로
	 * 짝을 찾아 넣는다 — 있는지 없는지는 실제로 불러 보고 판단한다.
	 */
	/**
	 * 카드 형식이 둘이고 이름 띠의 높이가 다르다.
	 *
	 * 봉지는 380 × 690 이고 띠가 74%~90% 에 있다. 극한 카드는 314 × 628(하나는 317)이고
	 * 띠가 86%~99% 에 있다. **둘 다 이름을 인쇄한다** — 위키의 극한 완성 카드에서 확인했다.
	 *
	 * **파일 실측으로 확인한 규칙이다** — 350px 미만 폭인 애셋 20 개가 모두 `_Extreme` 로
	 * 끝나고, 나머지 94 개는 전부 380 폭이다. 파일명으로 가르면 이미지가 로드되기를 기다릴
	 * 필요가 없다(목록의 그림은 `loading="lazy"` 라 화면 밖이면 치수를 모른다).
	 */
	const EXTREME_CARD = /_Extreme\.(webp|png)$/i;

	function wrapPackArt(baseImg, name, bossSrc) {
		// **보스 그림이 없는 팩도 통을 만든다.** 이름은 117 종 전부에 얹혀야 한다.
		const box = document.createElement('span');
		box.className = 'packart';
		baseImg.parentNode.insertBefore(box, baseImg);
		box.appendChild(baseImg);

		/*
			이름을 얹는다.

			봉지(380 폭)만 대상이다. 극한 팩은 314 폭의 다른 카드 형식이고 제목이 아트에
			구워져 있어 덧쓰면 겹친다. 애셋의 실제 폭으로 갈라내므로 분류 데이터가 필요 없다.
		*/
		/** 글자 크기가 카드 폭에 비례해야 한다. CSS 가 통의 폭을 알 수 없으므로 재서 넘긴다. */
		const measure = () => {
			const w = box.offsetWidth;
			if (w) box.style.setProperty('--packart-w', `${w}px`);
		};

		if (name) {
			const ext = EXTREME_CARD.test(baseImg.getAttribute('src') ?? '');
			const el = document.createElement('span');
			el.className = ext ? 'packart-name packart-name--ext' : 'packart-name';
			el.textContent = name;
			/*
				팩마다 다른 글자 색. 게임 카드에서 뽑은 값이며 없으면 CSS 기본값(크림)으로 간다.
				제품에서는 팩 id 로 키를 잡아야 한다 — 여기서 이름으로 잡는 이유는 덤프가
				링크를 파일명으로 바꿔 id 가 마크업에 남지 않기 때문이다.
			*/
			const tint = window.PACK_NAME_COLOR?.[name];
			if (tint) el.style.setProperty('--packart-name-color', tint);
			box.appendChild(el);
			measure();
			// 폭이 바뀌면 글자도 따라가야 한다 — 반응형에서 칸 수가 달라진다.
			if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(box);
			else baseImg.addEventListener('load', measure, { once: true });
		}

		if (!bossSrc) return;

		const probe = new Image();
		probe.addEventListener('load', () => {
			const boss = document.createElement('img');
			boss.className = 'packart-boss';
			boss.setAttribute('src', bossSrc);
			boss.setAttribute('alt', '');

			/*
				그림 내용 기준 맞춤. 파일마다 알파 여백이 달라 고정 좌표로는 어긋난다.
				스프라이트 키로 찾아 CSS 변수로 넘긴다.
			*/
			const sprite = (bossSrc.split('/').pop() ?? '').replace(/\.(webp|png)$/i, '').replace(/_boss$/i, '');
			const fit = window.PACK_BOSS_FIT?.[sprite];
			if (fit) {
				boss.style.setProperty('--boss-top', `${fit.top}%`);
				boss.style.setProperty('--boss-left', `${fit.left}%`);
				boss.style.setProperty('--boss-h', `${fit.h}%`);
			}
			// 이름보다 아래, 봉지보다 위. 광택이 그 사이에 온다.
			box.insertBefore(boss, box.querySelector('.packart-name'));

			const gloss = document.createElement('span');
			gloss.className = 'packart-gloss';
			box.insertBefore(gloss, box.querySelector('.packart-name'));
		});
		probe.src = bossSrc;
	}

	/**
	 * 파일명 규칙으로 짝을 찾을 수 없는 팩.
	 *
	 * 공격 타입 팩 6 종이 스프라이트를 범용 둘(`AttackType_normal` · `AttackType_effective`)로
	 * 공유해서 `{sprite}_boss` 규칙이 통하지 않는다. 참격·관통·타격을 가리는 필드도 DB 에 없다.
	 *
	 * **아래 표는 추측이 아니라 대조 결과다.** 위키의 카드 이미지와 로컬 애셋을 그림 단위로
	 * 맞춰 확인했다.
	 *   가르고 베는 이들   = Slicers & Dicers        → 검은 형상 + 흰 가면 역병의사 + 붉은 척추 개체
	 *   꿰고 뚫는 이들     = Piercers & Penetrators  → 녹색 갑각 개체 + 흰붉은 국화 다발
	 *   부수고 깨뜨릴 이들  = Crushers & Breakers     → 청염 황소 + 회색 눈알 개체
	 *   베어낼 것          = To be Cleaved           → 네잎 모자 녹색 인물 + 늑대 + 고목
	 *
	 * 애셋의 난이도 접미가 DB 와 어긋난다 — DB 는 `_normal`·`_effective` 인데 애셋은
	 * `_hard`·`_effective` 다. 위 대조로 `_normal` 팩이 `_hard` 그림을 쓰는 것을 확인했다.
	 *
	 * **제품에서는 팩 id 로 키를 잡아야 한다.** 여기서 이름으로 잡는 것은 덤프가 링크를
	 * 프로토타입 파일명으로 바꿔 id 가 마크업에 남지 않기 때문이며, 이 표는 파이프라인이
	 * 스프라이트를 교정하거나 공격 타입을 필드로 담으면 사라진다.
	 */
	const PACK_BOSS_BY_NAME = {
		/*
			해방된 분노 — `Crimson_hard_boss` 가 상류에 없다.

			**보스 그림은 팩 테마가 아니라 그 층의 보스에 딸린다.** 인게임 HARD 5 층 팩 선택
			화면에서 `해방된 분노` 와 `화왕지절`(`Burn_hard`)이 나란히 나오며 **같은 보스
			그림**을 쓴다 — 청염 황소 · 불꽃 나방 · 붉은 열매 나무다. 그 파일이
			`Burn_hard_boss` 이고 `Crimson_normal_boss` 와도 같은 그림이다.

			그래서 없는 파일을 지어내지 않고 같은 보스의 파일을 가리킨다.
		*/
		'해방된 분노': 'Burn_hard_boss',

		'가르고 베는 이들': 'AttackTypeSlash_hard_boss',
		'베어낼 것': 'AttackTypeSlash_effective_boss',
		'꿰고 뚫는 이들': 'AttackTypePierce_hard_boss',
		'꿰뚫을 것': 'AttackTypePierce_effective_boss',
		'부수고 깨뜨릴 이들': 'AttackTypeBlunt_hard_boss',
		'바스라질 것': 'AttackTypeBlunt_effective_boss',
	};

	/** 이름과 `{sprite}_boss` 규칙, 그리고 예외 표를 합쳐 보스 그림 경로를 정한다. */
	function bossSrcFor(baseSrc, name) {
		const override = name ? PACK_BOSS_BY_NAME[name] : undefined;
		return override
			? baseSrc.replace(/[^/]+\.webp$/i, `${override}.webp`)
			: baseSrc.replace(/\.webp$/i, '_boss.webp');
	}

	function compositePackArt(root) {
		// 목록 카드 — 117 종 전부에 이름을 얹고, 보스 그림이 있는 것은 함께 얹는다.
		for (const img of root.querySelectorAll('.cardgrid-wide .card > img.icon')) {
			const src = img.getAttribute('src');
			if (!src || /_boss\.webp$/i.test(src)) continue;
			const name = img.parentNode.querySelector('.card-body strong')?.textContent.trim();
			wrapPackArt(img, name, bossSrcFor(src, name));
		}

		/*
			상세 화면.

			그림이 둘일 수 있다 — 「일반 층」은 봉지, 「보스 층」은 보스만 들고 있다.
			보스 층은 봉지를 기반으로 바꿔 깔고 그 위에 다시 얹는다. 둘 다 이름을 갖는다.
		*/
		const title = root.querySelector('.seclabel h2')?.textContent.trim();
		for (const img of root.querySelectorAll('.pack-arts figure > img.icon')) {
			const src = img.getAttribute('src');
			if (!src) continue;

			if (/_boss\.webp$/i.test(src)) {
				const base = src.replace(/_boss\.webp$/i, '.webp');
				img.setAttribute('src', base);
				wrapPackArt(img, title, src);
				continue;
			}

			/*
				기반 그림 하나뿐인 자리.

				공격 타입 팩은 규칙으로 짝을 못 찾아 「보스 층」 그림이 아예 렌더되지 않는다.
				그 경우에만 예외 표로 보스를 얹는다. 나머지는 봉지 그대로에 이름만 얹는다.
			*/
			const single = root.querySelectorAll('.pack-arts figure').length === 1;
			const override = title ? PACK_BOSS_BY_NAME[title] : undefined;
			wrapPackArt(img, title, single && override ? bossSrcFor(src, title) : null);
		}
	}

	/* ── 2. 게임 표기 ────────────────────────────────────── */

	const LABEL = {
		// 죄악 7종
		wrath: '분노', lust: '색욕', sloth: '나태',
		gluttony: '탐식', gloom: '우울', pride: '오만', envy: '질투',
		// 공격 타입 3종
		slash: '참격', pierce: '관통', blunt: '타격',
		// 방어 구분. 게임은 이것을 공격과 나란한 축으로 둔다.
		attack: '공격', guard: '방어', counter: '반격', evade: '회피',
	};

	/**
	 * 태그의 글자가 정확히 enum 하나일 때만 바꾼다.
	 *
	 * 부분 치환을 하지 않는다 — 설명문 안의 같은 낱말을 건드리면 원문을 훼손한다.
	 */
	function relabel(root) {
		// `.facts dt` 는 저항 패널의 축 이름이다 — E.G.O 는 죄악 7종, 인격은 공격 타입 3종이며
		// 둘 다 여기로 온다.
		for (const tag of root.querySelectorAll('.tag, .chip, .comp-v, .facts dt')) {
			// 자식 요소(아이콘)를 건너뛰고 글자 노드만 본다.
			for (const node of tag.childNodes) {
				if (node.nodeType !== Node.TEXT_NODE) continue;
				const raw = node.nodeValue.trim();
				if (!raw) continue;
				const hit = LABEL[raw.toLowerCase()];
				if (hit) node.nodeValue = node.nodeValue.replace(raw, hit);
			}
		}
	}

	/* ── 3. 상태 전환 ────────────────────────────────────── */

	/** 한 묶음 안에서 하나만 켜지는 것. 동기화 단계 · 덱 레일 · 모달 탭이 같은 규칙이다. */
	function exclusive(group, target, attr) {
		for (const el of group) el.setAttribute(attr, 'false');
		target.setAttribute(attr, 'true');
	}

	function wire() {
		// 동기화 단계 1–4. 내용은 바뀌지 않는다 — 덤프가 4단계 시점의 DOM 이다.
		for (const pick of document.querySelectorAll('.uptie-pick')) {
			const buttons = [...pick.querySelectorAll('button')];
			for (const b of buttons) {
				b.addEventListener('click', () => exclusive(buttons, b, 'aria-pressed'));
			}
		}

		// 필터 칩은 여러 개가 동시에 켜진다.
		for (const chip of document.querySelectorAll('.chip:not(.chip-clear)')) {
			chip.addEventListener('click', (e) => {
				e.preventDefault();
				chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
			});
		}

		for (const clear of document.querySelectorAll('.chip-clear')) {
			clear.addEventListener('click', (e) => {
				e.preventDefault();
				for (const c of document.querySelectorAll('.chip:not(.chip-clear)')) {
					c.setAttribute('aria-pressed', 'false');
				}
			});
		}

		// 덱 레일 — 하나만 선택된다.
		const rails = [...document.querySelectorAll('.rail-slot')];
		for (const r of rails) {
			r.addEventListener('click', () => exclusive(rails, r, 'aria-pressed'));
		}

		// 모달 탭.
		for (const tabs of document.querySelectorAll('.mtabs')) {
			const group = [...tabs.querySelectorAll('.mtab')];
			for (const t of group) {
				t.addEventListener('click', () => exclusive(group, t, 'aria-selected'));
			}
		}

		/*
			출전 체크. 색과 체크가 함께 움직여야 한다 — 출전 여부를 색만으로 표시하지 않는다.
		*/
		for (const box of document.querySelectorAll('.sslot-deploy input[type="checkbox"]')) {
			box.addEventListener('change', () => {
				const slot = box.closest('.sslot');
				if (slot) slot.classList.toggle('sslot-on', box.checked);
			});
		}

		/*
			칸을 누르면 선택 모달이 열린다.

			정적 화면에는 모달 마크업이 없으므로 모달이 열린 상태의 화면으로 보낸다.
			흐름을 보이는 것이 목적이고 실제 열림은 제품의 몫이다.
		*/
		const hasModal = document.querySelector('.modal');
		if (!hasModal) {
			for (const main of document.querySelectorAll('.sslot-main, .sslot-ego')) {
				main.addEventListener('click', () => {
					window.location.href = 'squad-picker.html';
				});
			}
		}

		// 모달 닫기 — 스크림과 머리의 닫기 버튼.
		for (const scrim of document.querySelectorAll('.modal-scrim')) {
			scrim.addEventListener('click', () => {
				window.location.href = 'squad.html';
			});
		}
		for (const close of document.querySelectorAll('.mhead button')) {
			close.addEventListener('click', () => {
				window.location.href = 'squad.html';
			});
		}

		// 고른 것 표시. 같은 등급에 이미 다른 것이 있으면 교체다 — 막지 않는다.
		for (const card of document.querySelectorAll('.pickcard')) {
			card.addEventListener('click', (e) => {
				e.preventDefault();
				const on = card.getAttribute('aria-pressed') === 'true';
				card.setAttribute('aria-pressed', on ? 'false' : 'true');
			});
		}

		// 정적 화면에서 폼이 이동하지 않게 막는다.
		for (const form of document.querySelectorAll('form')) {
			form.addEventListener('submit', (e) => e.preventDefault());
		}
	}

	function boot() {
		markAxes(document);
		compositePackArt(document);
		relabel(document);
		wire();
		document.documentElement.setAttribute('data-proto', 'ready');
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}
})();
