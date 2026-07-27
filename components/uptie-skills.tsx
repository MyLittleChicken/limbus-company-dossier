'use client';

import { useState } from 'react';
import type { Locale } from '@prisma/client';
import type { IdentityDetail } from '@/lib/queries/identities';
import { Icon, Name, Nothing } from './ui';

/**
 * 인격 스킬.
 *
 * **동기화 단계마다 수치·설명·코인이 다르다.** 적재된 값은 델타가 아니라 병합된 최종값이다
 * (`02-pipeline.md`). 단계를 고르면 전체 스킬이 그 단계로 바뀐다.
 *
 * **코인 개수에 상한을 두지 않는다** — 실측 최대 9개라 고정 슬롯 UI 를 쓰지 않는다.
 * **방어 스킬을 접지 않는다.** 공격 스킬과 같은 깊이로 기본 표시한다(05-ui-foundation 4.3).
 */

const UPTIES = [1, 2, 3, 4] as const;

export function UptieSkills({
	skills,
	locale,
	notice,
}: {
	skills: IdentityDetail['skills'];
	locale: Locale;
	notice: string;
}) {
	const [uptie, setUptie] = useState(4);
	const ko = locale === 'ko';

	const attack = skills.filter((s) => s.defType === 'attack');
	const defense = skills.filter((s) => s.defType !== 'attack');

	const render = (list: IdentityDetail['skills']) =>
		list.map((skill) => {
			// 고른 단계가 없으면 그 이하에서 가장 높은 단계를 쓴다.
			const stage =
				skill.stages.find((s) => s.uptie === uptie) ??
				[...skill.stages].reverse().find((s) => s.uptie <= uptie) ??
				skill.stages[0];

			return (
				<li key={skill.id} className="skill">
					<div className="row-head">
						{/* 아이콘이 없는 스킬이 12종 있다. 원본 결손이며 대체 표시가 나간다. */}
						<Icon src={skill.icon} alt="" size={28} />
						<strong>
							{stage?.text ? (
								<Name value={stage.text} notice={notice} />
							) : (
								<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
							)}
						</strong>
						<span className="tag">{skill.defType}</span>
						{skill.affinity ? (
							<span className="tag">{skill.affinity}</span>
						) : (
							// 죄악이 없는 스킬이 131건 있다. 패닉·조건부 스킬이다.
							<span className="tag absent">{ko ? '죄악 없음' : 'No sin'}</span>
						)}
						{skill.atkType ? <span className="tag">{skill.atkType}</span> : null}
						<span className="tag">
							{ko ? '덱' : 'Deck'} {skill.deckCount}
						</span>
					</div>

					{stage ? (
						<>
							<p className="skill-nums">
								{ko ? '위력' : 'Base'} {stage.baseValue}
								{' · '}
								{ko ? '코인 위력' : 'Coin'} {stage.coinValue}
								{stage.atkWeight !== null ? (
									<>
										{' · '}
										{ko ? '공격 가중' : 'Weight'} {stage.atkWeight}
									</>
								) : null}
							</p>
							{stage.text ? <p className="desc">{stage.text.desc}</p> : null}
							{stage.coins.length > 0 ? (
								<ol className="coins">
									{stage.coins.map((coin) => (
										<li key={coin.index}>
											<span className="coin-i">{coin.index + 1}</span>
											<span className="coin-t">{coin.type}</span>
											{/* 918행은 어느 언어로도 설명이 없다. 효과 없는 코인이라 결손이 아니다. */}
											{coin.desc ? (
												<span className="coin-d">{coin.desc}</span>
											) : (
												<span className="absent">{ko ? '효과 없음' : 'No effect'}</span>
											)}
										</li>
									))}
								</ol>
							) : null}
						</>
					) : (
						// 수치가 어느 출처에도 없는 스킬이 6종 있다. 분류만 적재했다.
						<Nothing kind="missing">
							{ko ? '수치가 어느 출처에도 없다 (분류만 적재)' : 'No values in any source'}
						</Nothing>
					)}
				</li>
			);
		});

	return (
		<section className="panel">
			<div className="panel-h">
				<h3>{ko ? '스킬' : 'Skills'}</h3>
				<span className="uptie-pick" role="group" aria-label={ko ? '동기화 단계' : 'Uptie'}>
					{UPTIES.map((n) => (
						<button
							key={n}
							type="button"
							className="chip"
							aria-pressed={uptie === n}
							onClick={() => setUptie(n)}
						>
							{n}
						</button>
					))}
				</span>
			</div>
			<div className="panel-b">
				<h4 className="grouph">
					{ko ? '공격' : 'Attack'} <span className="hint">{attack.length}</span>
				</h4>
				<ul className="plain">{render(attack)}</ul>
				<h4 className="grouph">
					{ko ? '방어' : 'Defense'} <span className="hint">{defense.length}</span>
				</h4>
				{defense.length === 0 ? (
					<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
				) : (
					<ul className="plain">{render(defense)}</ul>
				)}
			</div>
		</section>
	);
}
