import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getDataset, getDungeon } from '@/lib/queries/reference';
import { Facts, Nothing, Panel, SecLabel } from '@/components/ui';

export default async function DungeonPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const [dungeon, dataset] = await Promise.all([getDungeon(locale), getDataset()]);

	if (!dungeon) {
		return (
			<>
				<SecLabel title={t.nav.dungeon} />
				<Nothing kind="missing">{ko ? '구성 데이터 없음' : 'No dungeon data'}</Nothing>
			</>
		);
	}

	return (
		<>
			<SecLabel
				title={t.nav.dungeon}
				sub={ko ? '층 구조와 은총' : 'Floor structure and graces'}
				hint={dataset?.mdVersion ?? dungeon.version}
			/>

			<div className="grid2">
				<div>
					<Panel title={ko ? '은총' : 'Graces'} hint={dungeon.graces.length}>
						{dungeon.graces.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="plain">
								{dungeon.graces.map((g) => (
									<li key={g.id}>
										<div className="row-head">
											<strong>
												{g.name ?? (
													<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
												)}
											</strong>
											{g.fellBack ? (
												<abbr className="fellback" title={t.fallbackNotice}>
													EN
												</abbr>
											) : null}
											<span className="tag">
												{ko ? '비용' : 'Cost'} {g.cost}
											</span>
										</div>
										{/* 원본이 강화 단계별 문자열 배열이다. 단계 번호와 함께 낸다. */}
										{g.descs.length > 0 ? (
											<ol className="grace-steps">
												{g.descs.map((d, i) => (
													<li key={i}>
														<span className="coin-i">{i + 1}</span>
														<span>{d}</span>
													</li>
												))}
											</ol>
										) : (
											<Nothing kind="missing">{ko ? '설명 없음' : 'No description'}</Nothing>
										)}
									</li>
								))}
							</ul>
						)}
					</Panel>
				</div>

				<aside>
					<Panel title={ko ? '구성' : 'Structure'}>
						<Facts
							rows={[
								[ko ? '버전' : 'Version', dungeon.version],
								[ko ? '전체 층' : 'Total floors', dungeon.totalFloors],
								[ko ? '기본 층' : 'Base floors', dungeon.baseFloors],
							]}
						/>
					</Panel>

					{/*
					 * 명칭 '이름과 거미의 거울' 은 원본에 있으나 스키마에 담을 자리가 없다
					 * (05-ui-foundation 12절 미결). 여기서는 내부 키만 낸다.
					 */}
					<p className="absent">
						{ko
							? '버전 명칭은 아직 데이터베이스에 적재되지 않아 내부 키를 노출한다.'
							: 'The version display name is not loaded yet; the internal key is shown.'}
					</p>
				</aside>
			</div>
		</>
	);
}
