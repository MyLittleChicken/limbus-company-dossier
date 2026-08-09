import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { $Enums } from '@/src/v2/generated/client';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { HWAJIN_DECK, recommendForDeck } from '@/lib/queries/canonical/recommend';
import { one, type SearchParams } from '@/lib/queries/shared';
import { Nothing, Panel, SecLabel } from '@/components/ui';
import { GiftEvidence } from '@/components/gift-evidence';

/**
 * 추천 슬라이스.
 *
 * **v2 엔진이 실데이터 위에서 도는지 보이는 창이다.** 제품 표면이 아니다 — 런 상태
 * 입력도 없고 덱도 고정이다. 층과 보유 기프트만 주소로 받는다.
 *
 * **순위를 매긴다.** 점수 = 적합도 × 켜짐이다. 적합도는 이 팩에서 하나 뽑으면 내 덱
 * 축에 얼마나 기여하나이고, 켜짐은 이 팩 기프트의 발동 조건 중 몇 %가 내 편성에서 사나다.
 * **정렬과 점수는 질의(`recommendForDeck`)가 계산해서 낸다 — 화면은 표시만 하고
 * 다시 계산하지 않는다.**
 *
 * 축을 하나도 공급하지 않는 편성이면 적합도가 전부 0 이라 순서가 무의미하다.
 * 그럴 때는 `rankable` 이 false 로 오고, 순위 번호와 점수를 안 붙인 채 그 사실을
 * 적는다 — 등급 A/B/C 분포만 낸다. 0 점을 늘어놓고 순위인 척하지 않는다.
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
	const difficulty = (one(sp['difficulty']) === 'normal' ? 'normal' : 'hard') as $Enums.Difficulty;
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

	/**
	 * 공급을 축 종류로 묶는다.
	 *
	 * **여덟 종류를 셋으로 줄이지 않는다.** `v_identity_capability` 가 `axis` ·
	 * `sin` · `association` 말고도 `skill_kind` · `resonance` · `unit_keyword` ·
	 * `coin` · `attack_type` 을 낸다. 조건 평가가 그 전부를 보므로 화면도 전부
	 * 보인다 — 셋만 그리면 나머지 다섯은 왜 켜졌는지 설명할 자리가 없어진다.
	 */
	const supplyGroups = [...new Set(rec.supply.map((s) => s.refKind))].map((kind) => {
		const rows = rec.supply.filter((s) => s.refKind === kind);
		// 막대의 분모는 그 묶음의 최대값이다. 인원으로 나누면 resonance 처럼
		// 인격당 여럿인 축이 100% 를 넘는다.
		const max = Math.max(...rows.map((r) => r.count));
		return { kind, rows, max };
	});

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
					? 'v2 추천 엔진이 캐노니컬 위에서 도는지 보이는 화면이다. 팩 점수는 「이 팩이 내 덱 축과 맞는 정도」 × 「이 팩 기프트의 발동 조건 중 실제로 켜지는 비율」이다. 이미 보유한 기프트는 후보에서 빠지고, 대신 다른 기프트를 켜는 연쇄로 센다.'
					: 'A slice showing the v2 engine running on canonical data. A pack score is how well the pack matches the deck axes, times the share of its trigger conditions that actually fire. Owned gifts leave the candidate pool and count instead as chain enablers.'}
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
						title={ko ? '이 층의 팩 후보' : 'Packs on this floor'}
						hint={
							rec.rankable
								? `${rec.candidateCount}`
								: ko
									? `${rec.candidateCount} · 순위 없음`
									: `${rec.candidateCount} · unranked`
						}
					>
						{/* 축을 안 공급하는 편성은 적합도가 전부 0 이라 순서가 무의미하다.
						    0 점을 늘어놓고 순위인 척하지 않는다 */}
						{!rec.rankable && (
							<Nothing kind="absent">
								{ko
									? '이 편성이 상태 축을 공급하지 않아 팩 순위를 매길 수 없다. 등급 분포만 낸다.'
									: 'This squad supplies no status axis, so packs cannot be ranked.'}
							</Nothing>
						)}
						{rec.packs.length === 0 ? (
							<Nothing kind="absent">{t.empty}</Nothing>
						) : (
							<ul className="plain rank">
								{rec.packs.map((p, i) => (
									<li key={p.id}>
										<div className="row-head">
											{/* 순위를 못 매기면 번호를 안 붙인다 */}
											{rec.rankable && <span className="coin-i">{i + 1}</span>}
											<strong>
												<Link href={`/${locale}/packs/${p.id}`}>{p.name ?? p.id}</Link>
											</strong>
											{/* 순위가 아니라 분포다. 셋을 함께 내야 A 3 이 「12 중 3」인지 「3 중 3」인지 보인다. */}
											<span className="tag">{`A ${p.tally.A} · B ${p.tally.B} · C ${p.tally.C}`}</span>
										</div>
										{/* 점수 하나로 답하지 않는다. 무엇을 곱해 나온 값인지 함께 낸다 */}
										{rec.rankable && (
											<span className="card-meta">
												{ko
													? `${p.score.toFixed(3)} — 적합 ${p.fit.toFixed(3)} + 합성 ${p.fusion.toFixed(3)} × 켜짐 ${p.live.toFixed(3)}`
													: `${p.score.toFixed(3)} — fit ${p.fit.toFixed(3)} + fusion ${p.fusion.toFixed(3)} × live ${p.live.toFixed(3)}`}
											</span>
										)}
										{p.tally.A === 0 ? (
											<Nothing kind="absent">
												{ko ? '이 편성이 켜는 기프트가 없다' : 'nothing this squad turns on'}
											</Nothing>
										) : (
											<ul className="comp">
												{p.gifts
													.filter((g) => g.grade === 'A')
													.slice(0, 5)
													.map((g) => (
														<li key={g.id}>
															<span className="comp-k">{g.name ?? String(g.id)}</span>
															<span className="comp-v">
																{`${g.satisfied}/${g.decidable}`}
																{/* 판정 가능한 것과 확실한 것이 갈리면 밝힌다 — 「가능」을 확정으로 읽히게 두지 않는다 */}
																{g.certain < g.satisfied
																	? ko
																		? ' · 가능 포함'
																		: ' · incl. possible'
																	: ''}
																{g.chainDepth !== null
																	? ko
																		? ` · 연쇄 ${g.chainDepth}홉`
																		: ` · chain ${g.chainDepth}`
																	: ''}
															</span>
														</li>
													))}
											</ul>
										)}
										{/* 계측기 — 상위 5만으론 왜 이 순위인지 검증할 수 없다. 전체 근거를 모달로 낸다(설계 7절) */}
										<GiftEvidence
											packName={p.name ?? p.id}
											gifts={p.gifts}
											label={ko ? `… 전체 ${p.gifts.length}개 근거` : `… all ${p.gifts.length}`}
											ko={ko}
										/>
									</li>
								))}
							</ul>
						)}
					</Panel>

					{rec.owned.length > 0 && (
						<Panel title={ko ? '보유 기프트' : 'Owned gifts'} hint={rec.owned.length}>
							<ul className="inline-list">
								{rec.owned.map((g) => (
									<li key={g.id} className="tag">
										{g.name ?? g.id}
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
										{i.axes.map((a) => (
											<span key={a} className="tag">
												{a}
											</span>
										))}
									</span>
								</li>
							))}
						</ul>
					</Panel>

					{/*
					 * 덱을 단일 키워드로 요약하지 않는다. 엔진이 센 것을 그대로 낸다 —
					 * 화면이 다시 세면 두 수가 갈리고 어느 쪽이 맞는지 알 수 없어진다.
					 *
					 * 조건 판정은 편성이 아니라 출전을 본다. 어느 범위로 셌는지 밝힌다.
					 */}
					<Panel
						title={ko ? '편성이 공급하는 것' : 'What the squad supplies'}
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
						{supplyGroups.length === 0 ? (
							<Nothing kind="absent">{t.empty}</Nothing>
						) : (
							supplyGroups.map((g) => (
								<div key={g.kind}>
									<span className="card-meta">{g.kind}</span>
									<ul className="dist">
										{g.rows.map((r) => (
											<li key={r.refId}>
												<span className="dist-key">{r.refId}</span>
												<span
													className="dist-bar"
													style={{ width: `${Math.round((r.count / g.max) * 100)}%` }}
												/>
												<span className="dist-n">{r.count}</span>
											</li>
										))}
									</ul>
								</div>
							))
						)}
					</Panel>
				</aside>
			</div>
		</>
	);
}
