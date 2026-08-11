'use client';

import { Fragment, type ReactNode } from 'react';
import { Nothing, Panel } from './ui';

/**
 * 상세 화면 두 장이 나눠 쓰는 조각.
 *
 * 인격(#26)에서 세운 것을 E.G.O 가 그대로 쓴다. **두 화면이 같아 보이는 까닭이 여기 있다** —
 * 문구를 칠하는 규칙과 상태 칸이 한 벌뿐이다.
 */

export const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
export const roman = (n: number) => ROMAN[n] ?? String(n);

/** 부호를 붙여 적는다. 방어 보정은 66 건이 0 이하라 부호가 뜻을 가른다. 빼기표(−)를 쓴다. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** 교체 아이콘. 애셋 스냅샷 4721 장에 화살표가 교차하는 그림이 없어 직접 그린다. */
/** 문구 한 벌. 두 화면이 같은 꼴로 받는다. */
export type Text = { name: string; desc: string | null } | null;

export const SwapIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M4 8h14M15 5l3 3-3 3M20 16H6M9 13l-3 3 3 3" />
	</svg>
);

/**
 * 한 줄을 색으로 가른다.
 *
 * 셋을 집는다.
 *
 *   상태 이름   문장 속의 「출혈」 — 눌러서 아래 상태 칸으로 내려간다
 *   상태 토큰   아직 치환이 안 끝난 `[Laceration]` — **이름으로 바꿔 보인다**
 *   대괄호 태그 `[사용시]` · `[OnSucceedAttack]` — 뜻을 모르는 채 꼴만 태그로 세운다
 *
 * 게임의 공식 인격 프리뷰 카드가 같은 자리를 같은 방식으로 가른다.
 *
 * **짝표를 새로 만들지 않는다.** 토큰을 이름으로 바꾸는 데 쓰는 것은 이미 읽어 온
 * `status_text` 하나뿐이다. 거기 없는 토큰은 그대로 둔다 — 없는 말을 지어내지 않는다.
 *
 * **글자 종류를 가리지 않는다.** 같은 자리가 데이터에 따라 한국어이기도 영문이기도 하다 —
 * 스킬 본문은 「[사용시]」로 오고 코인은 「[OnSucceedAttack]」으로 온다. 어느 쪽이 오든 같은
 * 꼴로 세우므로, **데이터층이 영문 태그를 한국어로 바꿔도 화면은 손댈 것이 없다.**
 *
 * 실측으로 대괄호 안에 오는 한국어는 전부 이 성격이다 — 사용시 · 공격 종료시 · 합 승리시 ·
 * 피아식별불가 …
 */
/*
	대괄호 태그.

	길이 상한은 실측으로 잡았다 — 가장 긴 것이 `[로보토미 E.G.O::엄숙한 애도 이상 전용 상시
	효과]` 이고 `[UnBrokenCoinOnSucceedAttack]` 이 27 자다. 한 문장을 통째로 삼키지 않도록
	줄바꿈을 막고 40 자에서 끊는다.

	**글자가 하나도 없으면 태그로 보지 않는다.** `[+0.2]` 같은 수치 주석이 있어 그것까지
	칩으로 세우면 문장 가운데가 끊긴다.
*/
const TOKEN = /^\[([^\]\n]{1,40})\]/;
const HAS_LETTER = /[A-Za-z가-힣]/;

export function paint(line: string, names: Map<string, string>, key: string) {
	const out: ReactNode[] = [];
	let buffer = '';
	let at = 0;

	const flush = () => {
		if (buffer) out.push(<Fragment key={`${key}-p${out.length}`}>{buffer}</Fragment>);
		buffer = '';
	};

	/*
		**상태 이름을 대괄호보다 먼저 본다.**

		이름 자체에 대괄호가 든 것이 있다 — 「찢긴 색채 [루주]」. 대괄호를 먼저 떼면 그 이름이
		둘로 쪼개져 링크도 깨지고 「[루주]」만 태그로 남는다.
	*/
	while (at < line.length) {
		let hit = false;

		for (const [id, name] of names) {
			if (name && line.startsWith(name, at)) {
				flush();
				out.push(
					<a key={`${key}-n${at}`} className="fx-st" href={`#st-${id}`}>
						{name}
					</a>,
				);
				at += name.length;
				hit = true;
				break;
			}
		}
		if (hit) continue;

		const tag = TOKEN.exec(line.slice(at));
		if (tag && HAS_LETTER.test(tag[1]!)) {
			flush();
			const id = tag[1]!;
			const name = names.get(id);
			out.push(
				name ? (
					<a key={`${key}-t${at}`} className="fx-st" href={`#st-${id}`}>
						{name}
					</a>
				) : (
					<span key={`${key}-t${at}`} className="fx-when">
						{tag[0]}
					</span>
				),
			);
			at += tag[0].length;
			continue;
		}

		buffer += line[at];
		at += 1;
	}
	flush();

	return <>{out}</>;
}

/** 여러 줄을 문단으로 편다. */
export function Lines({ text, names, id }: { text: Text; names: Map<string, string>; id: string }) {
	if (!text?.desc) return null;
	return (
		<>
			{text.desc
				.split('\n')
				.filter((v) => v.trim())
				.map((line, i) => (
					<p className="fx-line" key={`${id}-${i}`}>
						{paint(line, names, `${id}-${i}`)}
					</p>
				))}
		</>
	);
}

/** 코인 수는 동전 그림으로 센다. 게임의 프리뷰 카드가 그렇게 한다. */
export function CoinDots({ n, src }: { n: number; src: string | null }) {
	if (!src || n <= 0) return null;
	return (
		<span className="coin-dots">
			{Array.from({ length: n }, (_, i) => (
				/* eslint-disable-next-line @next/next/no-img-element */
				<img key={i} src={src} alt="" width={12} height={12} />
			))}
		</span>
	);
}

export function Tag({ icon, label }: { icon: string | null; label: string }) {
	return (
		<span className="tag tag--icon">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			{icon ? <img src={icon} alt="" width={14} height={14} /> : null}
			{label}
		</span>
	);
}

/**
 * 상태 칸.
 *
 * 본문에 나오는 상태만 온다 — 고르는 일은 질의가 한다(`canonical/detail.ts#pickStatuses`).
 * 여기서는 그리기만 한다.
 */
export function StatusPanel({
	statuses,
	title,
	ko,
}: {
	statuses: Array<{ id: string; text: { name: string; desc: string | null }; icon: string | null }>;
	title: string;
	ko: boolean;
}) {
	if (!statuses.length) return null;
	return (
		<Panel title={title} hint={statuses.length}>
			<div className="st-grid">
				{statuses.map((st) => (
					<article className="st-card" id={`st-${st.id}`} key={st.id}>
						<div className="st-head">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							{st.icon ? <img src={st.icon} alt="" width={22} height={22} loading="lazy" /> : null}
							<strong>{st.text.name}</strong>
						</div>
						<div className="st-body">
							{st.text.desc?.trim() ? (
								st.text.desc
									.split('\n')
									.filter((v) => v.trim())
									.map((v, i) => (
										<p className="fx-line" key={i}>
											{v}
										</p>
									))
							) : (
								/* 설명이 없는 상태가 있다 — 결손이 아니라 효과가 없는 것이다. */
								<Nothing kind="absent">{ko ? '설명 없음' : 'No description'}</Nothing>
							)}
						</div>
					</article>
				))}
			</div>
		</Panel>
	);
}

/** 긴 이름을 먼저 자르려고 길이 내림차순으로 둔다 — 짧은 이름이 긴 이름 안에 들면 조각난다. */
export const nameMap = (
	statuses: Array<{ id: string; text: { name: string } }>,
): Map<string, string> =>
	new Map(
		[...statuses]
			.sort((a, b) => b.text.name.length - a.text.name.length)
			.map((s) => [s.id, s.text.name] as const),
	);
