import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Difficulty } from '@prisma/client';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { HWAJIN_DECK, recommendForDeck } from '@/lib/queries/recommend';
import { one, type SearchParams } from '@/lib/queries/shared';
import { Nothing, Panel, SecLabel } from '@/components/ui';

/**
 * 추천 슬라이스.
 *
 * 3단계 엔진이 실데이터 위에서 도는지 보이는 화면이다. **런 상태 입력은 없다** —
 * 그것은 4단계이고 여기서는 덱이 고정이다. 층과 보유 기프트만 주소로 받는다.
 *
 * 검증 대상은 화진 덱(화상+진동, 새벽 사무소 3 + 엄지 4)이다. 온필드 정원 7과 맞고
 * 두 소속 조건을 동시에 만족해 조건 평가를 실제로 켜 볼 수 있다.
 */
export default async function RecommendPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<SearchParams>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const sp = await searchParams;
	const ko = locale === 'ko';

	const floor = Number(one(sp['floor']) ?? '3');
	const difficulty = (one(sp['difficulty']) === 'normal' ? 'normal' : 'hard') as Difficulty;
	const idList = (key: string): number[] =>
		(one(sp[key]) ?? '')
			.split(',')
			.map(Number)
			.filter((n) => Number.isInteger(n) && n > 0);
	const ownedIds = idList('owned');
	// 편성과 출전이 갈리는지 여기서 열어 둔다. 비우면 편성 전체가 출전이라 지금과 동작이 같다.
	const deployedIds = idList('deployed');

	const rec = await recommendForDeck(locale, {
		identityIds: HWAJIN_DECK,
		deployedIds,
		floor: Number.isFinite(floor) && floor >= 1 && floor <= 15 ? floor : 3,
		difficulty,
		ownedIds,
	});

	const t = UI[locale];
	const supply = Object.entries(rec.feature.statusSupply).sort((a, b) => b[1] - a[1]);
	const sins = Object.entries(rec.feature.sinSupply).sort((a, b) => b[1] - a[1]);
	const affil = Object.entries(rec.feature.affiliation.deployed).sort((a, b) => b[1] - a[1]);
	// 질의가 준 id 중 실제로 덱에 있는 것만 센다 — 없는 id 는 recommendForDeck 이 이미 버린다.
	const deployedCount = deployedIds.length === 0
		? rec.deck.length
		: rec.deck.filter((i) => deployedIds.includes(i.id)).length;

	const floors = [1, 2, 3, 4, 5, 7, 12];

	return (
		<>
			<SecLabel
				title={ko ? '추천 (슬라이스)' : 'Recommendation (slice)'}
				sub={ko ? '화상·진동 덱 — 새벽 사무소 3 + 엄지 4' : 'Burn + Tremor deck'}
				hint={`${rec.difficulty} ${rec.floor}${ko ? '층' : 'F'}`}
			/>

			<p className="lede">
				{ko
					? '3단계 추천 엔진이 실제 적재 데이터 위에서 도는지 보이는 화면이다. 런 상태를 입력하는 흐름은 4단계이며 여기에는 없다 — 덱은 고정이고 층만 바꾼다.'
					: 'A slice showing the stage-3 engine running on real loaded data. Run-state input belongs to stage 4; the deck is fixed here.'}
			</p>

			<div className="filters">
				{floors.map((f) => (
					<Link
						key={f}
						href={`/${locale}/recommend?difficulty=${difficulty}&floor=${f}`}
						className="chip"
						aria-pressed={f === rec.floor}
					>
						{f}
						{ko ? '층' : 'F'}
					</Link>
				))}
			</div>

			<div className="grid2">
				<div>
					<Panel
						title={ko ? '추천 팩' : 'Recommended packs'}
						hint={`${ko ? '후보' : 'of'} ${rec.candidateCount}`}
					>
						{rec.result.ranked.length === 0 ? (
							<Nothing kind="absent">{t.empty}</Nothing>
						) : (
							<ol className="plain rank">
								{rec.result.ranked.map((r, i) => (
									<li key={r.packId}>
										<div className="row-head">
											<span className="coin-i">{i + 1}</span>
											<strong>
												<Link href={`/${locale}/packs/${r.packId}`}>{r.name}</Link>
											</strong>
											<span className="tag">{r.score.toFixed(1)}</span>
										</div>
										{/* 점수 하나로 답하지 않는다. 항목별 분해와 근거를 함께 낸다. */}
										<ul className="comp">
											{Object.entries(r.components)
												.filter(([, v]) => Math.abs(v) > 0.005)
												.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
												.map(([k, v]) => (
													<li key={k}>
														<span className="comp-k">{k}</span>
														<span className="comp-v">{v.toFixed(2)}</span>
													</li>
												))}
										</ul>
										{r.reasons.length > 0 && (
											<ul className="why">
												{r.reasons.map((reason, j) => (
													<li key={j}>{reason}</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ol>
						)}
					</Panel>

					{/* 조용히 버리지 않는다 — 무엇을 왜 뺐는지 보인다. */}
					{rec.result.dropped.length > 0 && (
						<Panel
							title={ko ? '후보에서 뺀 팩' : 'Excluded'}
							hint={rec.result.dropped.length}
						>
							<ul className="inline-list">
								{rec.result.dropped.map((d) => (
									<li key={d.packId} className="tag">
										{d.name} · {d.reason === 'hidden' ? (ko ? '히든' : 'hidden') : ko ? '기간 한정' : 'limited'}
									</li>
								))}
							</ul>
						</Panel>
					)}
				</div>

				<aside>
					<Panel title={ko ? '덱' : 'Deck'} hint={`${rec.deck.length}/7`}>
						<ul className="plain compact">
							{rec.deck.map((i) => (
								<li key={i.id}>
									<Link href={`/${locale}/identities/${i.id}`}>{i.name}</Link>
									<span className="card-meta">
										{i.statuses.map((s) => (
											<span key={s} className="tag">
												{s}
											</span>
										))}
									</span>
								</li>
							))}
						</ul>
					</Panel>

					{/* 덱을 단일 키워드로 요약하지 않는다. 축별 공급을 그대로 낸다. */}
					<Panel title={ko ? '상태 공급' : 'Status supply'}>
						<ul className="dist">
							{supply.map(([k, v]) => (
								<li key={k}>
									<span className="dist-key">{k}</span>
									<span
										className="dist-bar"
										style={{ width: `${Math.round((v / rec.deck.length) * 100)}%` }}
									/>
									<span className="dist-n">{v}</span>
								</li>
							))}
						</ul>
					</Panel>

					<Panel title={ko ? '죄악 (공명 판정)' : 'Sins (resonance)'}>
						<ul className="dist">
							{sins.map(([k, v]) => (
								<li key={k}>
									<span className="dist-key">{k}</span>
									<span
										className="dist-bar"
										style={{ width: `${Math.round((v / rec.deck.length) * 100)}%` }}
									/>
									<span className="dist-n">{v}</span>
								</li>
							))}
						</ul>
					</Panel>

					{/* 조건 판정은 편성이 아니라 출전을 본다 — 어느 범위로 셌는지 밝힌다. */}
					<Panel
						title={ko ? '소속 (조건 판정)' : 'Affiliations'}
						hint={
							deployedCount === rec.deck.length
								? ko
									? `출전 ${deployedCount} (편성 전체)`
									: `${deployedCount} deployed (all)`
								: ko
									? `출전 ${deployedCount}/${rec.deck.length}`
									: `${deployedCount}/${rec.deck.length} deployed`
						}
					>
						<ul className="inline-list">
							{affil.map(([k, v]) => (
								<li key={k} className="tag">
									{k} {v}
								</li>
							))}
						</ul>
					</Panel>
				</aside>
			</div>
		</>
	);
}
