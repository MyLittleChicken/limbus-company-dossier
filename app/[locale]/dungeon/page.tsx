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
			{/* 명칭을 쓰고 내부 키는 표에만 둔다(05-ui-foundation 10절). */}
			<SecLabel
				title={dungeon.text?.name ?? t.nav.dungeon}
				sub={ko ? '층 구조와 은총' : 'Floor structure and graces'}
				hint={dataset?.snapshotDate.toISOString().slice(0, 10) ?? undefined}
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
								[
									ko ? '명칭' : 'Name',
									dungeon.text?.name ?? (
										<Nothing kind="missing">{ko ? '없음' : 'None'}</Nothing>
									),
								],
								[ko ? '내부 키' : 'Internal key', <code key="v" className="idcode">{dungeon.version}</code>],
								[ko ? '전체 층' : 'Total floors', dungeon.totalFloors],
								[ko ? '기본 층' : 'Base floors', dungeon.baseFloors],
							]}
						/>
					</Panel>
				</aside>
			</div>
		</>
	);
}
