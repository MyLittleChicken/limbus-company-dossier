'use client';

import { Panel } from '@/components/ui';
import type { SquadAxes } from '@/lib/queries/squad';

/**
 * 편성 프로필.
 *
 * **덱을 단일 키워드로 요약하지 않는다**(`lib/engine/state.ts` · 마스터북 §8).
 * "이 덱은 화상 덱" 대신 축별 분포를 그대로 낸다.
 *
 * 세 번째 구획이 이 패널의 요지다 — 죄악을 **공급(공격 스킬)과 수요(장착 E.G.O 비용)로 나란히**
 * 놓는다. 이전 프로토타입의 편성창이 가졌고 우리에게 대응물이 없던 것이다
 * (`reference/v1-formation-ui.md` 5절).
 *
 * **이 값은 엔진 점수가 아니다.** 엔진의 `sinSupply` 는 인격 수를 세고(조건 평가의 단위가
 * 그것이다) 여기서는 스킬 수를 센다 — 죄악 자원이 스킬을 쓸 때마다 들어오기 때문이다.
 * E.G.O 는 아직 추천 점수에 반영되지 않으며(07-recommendation-system 5.1) 이 대조도 점수와
 * 무관하다. 화면이 그 사실을 적는다.
 */

export interface ProfileInput {
	/** 편성된 인격 수 */
	filled: number;
	/** 상태 키워드별 인격 수 */
	keywords: Record<string, number>;
	/** 상태 기믹별 인격 수. 키워드와 나란한 독립 축이다 */
	mechanics: Record<string, number>;
	/** 공격 타입별 스킬 수 */
	atkTypes: Record<string, number>;
	/** 죄악별 공격 스킬 수 — 공급 */
	sinSupply: Record<string, number>;
	/** 죄악별 장착 E.G.O 비용 합 — 수요 */
	sinDemand: Record<string, number>;
}

const sorted = (map: Record<string, number>): Array<[string, number]> =>
	Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export function FormationProfile({
	profile,
	axes,
	ko,
}: {
	profile: ProfileInput;
	axes: SquadAxes;
	ko: boolean;
}) {
	const label = (v: string) => axes.labels[v] ?? v;
	// 애셋 경로는 서버가 이미 풀어 실어 보냈다(`lib/queries/squad.ts` — 파일 시스템 인덱스라 서버 전용).
	const icon = (v: string) => axes.icons[v] ?? null;
	const keywords = sorted(profile.keywords);
	const mechanics = sorted(profile.mechanics);
	const atkTypes = sorted(profile.atkTypes);

	// 공급과 수요 어느 쪽에라도 값이 있는 죄악만 낸다. 게임이 정한 표시 순서를 따른다.
	const sins = axes.sinOrder.filter(
		(s) => (profile.sinSupply[s] ?? 0) > 0 || (profile.sinDemand[s] ?? 0) > 0,
	);
	const sinMax = Math.max(1, ...sins.map((s) => Math.max(profile.sinSupply[s] ?? 0, profile.sinDemand[s] ?? 0)));
	const short = sins.filter((s) => (profile.sinDemand[s] ?? 0) > (profile.sinSupply[s] ?? 0));

	if (profile.filled === 0) {
		return (
			<Panel title={ko ? '편성 프로필' : 'Profile'} hint={`0/12`}>
				<p className="lede">
					{ko
						? '칸을 눌러 인격을 배정하면 키워드·죄악 분포가 집계됩니다.'
						: 'Assign identities to see the keyword and sin distribution.'}
				</p>
			</Panel>
		);
	}

	const kwMax = Math.max(1, ...keywords.map(([, v]) => v), ...mechanics.map(([, v]) => v));
	const atkMax = Math.max(1, ...atkTypes.map(([, v]) => v));

	return (
		<Panel title={ko ? '편성 프로필' : 'Profile'} hint={`${profile.filled}/12`}>
			<div className="dist-group">
				<h4>{ko ? '키워드 · 인격 수' : 'Keywords'}</h4>
				{keywords.length === 0 ? (
					<span className="absent">{ko ? '없음' : 'None'}</span>
				) : (
					<Bars rows={keywords} max={kwMax} label={label} icon={icon} />
				)}

				{/* 키워드와 섞지 않는다 — 인격이 공급하는 자원이고 축이 다르다. */}
				{mechanics.length > 0 && (
					<>
						<h4>{ko ? '특수 · 인격 수' : 'Special'}</h4>
						<Bars rows={mechanics} max={kwMax} label={label} icon={icon} />
					</>
				)}

				<h4>{ko ? '공격 타입 · 스킬 수' : 'Attack types'}</h4>
				{atkTypes.length === 0 ? (
					<span className="absent">{ko ? '없음' : 'None'}</span>
				) : (
					<Bars rows={atkTypes} max={atkMax} label={label} icon={icon} />
				)}

				<h4>{ko ? '죄악 자원 · 공급(스킬) / 수요(E.G.O)' : 'Sin — supply / demand'}</h4>
				{sins.length === 0 ? (
					<span className="absent">{ko ? '없음' : 'None'}</span>
				) : (
					<ul className="dist">
						{sins.map((s) => {
							const sup = profile.sinSupply[s] ?? 0;
							const dem = profile.sinDemand[s] ?? 0;
							const src = icon(s);
							return (
								<li key={s} className={dem > sup ? 'res-short' : undefined}>
									<span className="dist-key">
										{src ? (
											/* eslint-disable-next-line @next/next/no-img-element */
											<img src={src} alt="" width={14} height={14} />
										) : null}
										{label(s)}
									</span>
									<span className="res-track">
										<span className="dist-bar" style={{ width: `${(sup / sinMax) * 100}%` }} />
										{dem > 0 && (
											<span
												className="res-demand"
												style={{ left: `${Math.min(100, (dem / sinMax) * 100)}%` }}
												aria-hidden="true"
											/>
										)}
									</span>
									<span className="dist-n">
										{sup} / {dem}
									</span>
								</li>
							);
						})}
					</ul>
				)}

				{/* 색만으로 구분하지 않는다(05-ui-foundation 8절) — 무엇이 모자란지 글로도 적는다. */}
				{short.length > 0 && (
					<p className="notice-inline">
						{ko
							? `장착 E.G.O 비용이 공급을 넘는 죄악: ${short.map(label).join(' · ')}`
							: `E.G.O cost exceeds supply: ${short.map(label).join(', ')}`}
					</p>
				)}

				<p className="notice-inline">
					{ko
						? 'E.G.O는 아직 추천 점수에 반영되지 않습니다. 이 대조는 자원 수급을 보이는 것이며 점수와 무관합니다.'
						: 'E.G.O does not affect scoring yet. This comparison shows resource pressure only.'}
				</p>
			</div>
		</Panel>
	);
}

function Bars({
	rows,
	max,
	label,
	icon,
}: {
	rows: Array<[string, number]>;
	max: number;
	label: (v: string) => string;
	icon: (v: string) => string | null;
}) {
	return (
		<ul className="dist">
			{rows.map(([key, value]) => {
				const src = icon(key);
				return (
					<li key={key}>
						<span className="dist-key">
							{src ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img src={src} alt="" width={14} height={14} />
							) : null}
							{label(key)}
						</span>
						<span className="dist-bar" style={{ width: `${(value / max) * 100}%` }} />
						<span className="dist-n">{value}</span>
					</li>
				);
			})}
		</ul>
	);
}
