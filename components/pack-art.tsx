import { packBossIcon, packIcon } from '@/lib/assets';
import { PACK_BOSS_FIT, PACK_BOSS_SPRITE, PACK_NAME_COLOR, isExtremeCard } from '@/lib/pack-art';

/**
 * 테마 팩 카드 그림.
 *
 * **애셋이 두 장이고 게임은 그것을 겹쳐 쓴다** — 가운데가 빈 봉지와 프레임 없는 보스
 * 그림이다. 봉지만 내면 8각 창이 텅 빈 카드가 되어 팩을 식별할 수 없다. 이름도 애셋에
 * 없어서 하단 금색 괘선 사이 띠가 비어 있다. 조사 기록은 `publish/PACK-ART.md` 다.
 *
 * 쌓는 순서는 게임과 같다 — 봉지 · 보스 · 비닐 광택 · 이름.
 *
 * **보스 그림이 있는지 없는지는 파일을 찾아서 안다.** 프로토타입은 브라우저에서
 * `Image()` 로 찔러 봐야 했지만 여기서는 애셋 인덱스에 물어보면 된다. 41 종이 걸리고
 * 나머지 76 종(canto · event · extreme · walpurgis · railway)은 아트가 통째로 구워져
 * 있어 창이 없다 — 결손이 아니다.
 */
export function PackArt({
	id,
	sprite,
	name,
	showBoss = true,
}: {
	id: string;
	sprite: string;
	/** 띠에 인쇄할 이름. 없으면 봉지만 낸다. */
	name: string | null;
	/**
	 * 보스를 얹을지. 상세 화면이 「일반 층」과 「보스 층」을 나란히 낼 때 앞의 것은
	 * 봉지만 내야 해서 끈다.
	 */
	showBoss?: boolean;
}) {
	const base = packIcon(sprite);
	if (!base) return <span className="icon icon-none packart-none" aria-hidden="true" />;

	// 규칙 밖인 7 종은 표를 먼저 본다. 나머지는 `{sprite}_boss` 다.
	const boss = showBoss ? packBossIcon(PACK_BOSS_SPRITE[id] ?? sprite) : null;
	const fit = boss ? PACK_BOSS_FIT[PACK_BOSS_SPRITE[id] ?? sprite] : undefined;
	const tint = PACK_NAME_COLOR[id];

	return (
		<span className="packart">
			{/* eslint-disable-next-line @next/next/no-img-element -- 로컬 정적 파일이다 */}
			<img className="packart-base" src={base} alt="" loading="lazy" />
			{boss ? (
				<>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						className="packart-boss"
						src={boss}
						alt=""
						loading="lazy"
						style={
							fit
								? {
										top: `${fit.top}%`,
										left: `${fit.left}%`,
										height: `${fit.h}%`,
									}
								: undefined
						}
					/>
					{/* 봉지에 구워진 광택이 보스에 가리므로 그 위에 다시 깐다. */}
					<span className="packart-gloss" />
				</>
			) : null}
			{name ? (
				<span
					className={isExtremeCard(sprite) ? 'packart-name packart-name--ext' : 'packart-name'}
					style={tint ? ({ '--packart-name-color': tint } as React.CSSProperties) : undefined}
				>
					{name}
				</span>
			) : null}
		</span>
	);
}
