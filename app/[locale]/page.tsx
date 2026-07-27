import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { isLocale } from '@/lib/locale';
import { NAV_PRIMARY, UI } from '@/lib/ui-text';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];

	const [gifts, packs, identities, egos, dataset] = await Promise.all([
		db.gift.count(),
		db.pack.count(),
		db.identity.count(),
		db.ego.count(),
		db.dataset.findFirst(),
	]);

	const counts = { gifts, packs, identities, egos } as const;

	return (
		<>
			<div className="seclabel">
				<h2>{t.appName}</h2>
				<span className="kr">{t.appSub}</span>
				<span className="rule" />
			</div>

			<div className="cardgrid">
				{NAV_PRIMARY.map((key) => (
					<Link key={key} href={`/${locale}/${key}`} className="panel">
						<div className="panel-h">
							<h3>{t.nav[key]}</h3>
							<span className="hint">{counts[key]}</span>
						</div>
					</Link>
				))}
			</div>

			{/* 기준 버전은 /about 에만 두지 않는다 — 05-ui-foundation 10절 */}
			{dataset && (
				<p className="stamp">
					{dataset.mdVersion} · {dataset.snapshotDate.toISOString().slice(0, 10)} 스냅샷
				</p>
			)}
		</>
	);
}
