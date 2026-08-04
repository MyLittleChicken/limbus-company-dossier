import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listAxisLabels, listEgosFull, listSinners } from '@/lib/queries/canonical/list';
import { egoRankIcon, keywordIcon, sinIcon } from '@/lib/assets';
import { SecLabel } from '@/components/ui';
import { UnitList, type Axis, type Unit } from '@/components/unit-list';

/**
 * E.G.O 목록.
 *
 * 인격과 **같은 골격**을 쓴다 — 수감자별 섹션 · 세로 카드 · 상단에 붙는 인라인 필터.
 * 다른 것은 축뿐이다 — 수감자 · 등급 · 속성 · 키워드. 소속과 특수가 없고 등급이
 * ZAYIN~ALEPH 다.
 *
 * 캐노니컬을 읽는 이유가 여기서 더 분명하다 — **현행 목록 쿼리는 시즌을 내려주는데
 * 화면이 그리지 않았다.** 값이 없는 것이 아니라 쓰지 않던 것이다.
 */
export default async function EgosPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const [rows, sinners, labels] = await Promise.all([
		listEgosFull(locale),
		listSinners(locale),
		listAxisLabels(locale),
	]);

	const usedSins = new Set<string>(rows.flatMap((e) => e.sins));
	const usedRanks = new Set(rows.map((e) => e.rank).filter(Boolean) as string[]);
	const usedKeywords = new Set(rows.flatMap((e) => e.keywords));

	const axes: Axis[] = [
		{
			key: 'sinner',
			label: ko ? '수감자' : 'Sinner',
			options: sinners.map((s) => ({
				id: String(s.id),
				label: s.text?.name ?? String(s.id),
				icon: s.icon,
			})),
		},
		{
			key: 'grade',
			label: ko ? '등급' : 'Rank',
			// 배너 애셋 안에 이름이 그려져 있어 글자를 겹쳐 두지 않는다.
			iconOnly: true,
			options: RANKS.filter((r) => usedRanks.has(r)).map((r) => ({
				id: r,
				label: r,
				icon: egoRankIcon(r),
			})),
		},
		{
			key: 'sin',
			label: ko ? '속성' : 'Affinity',
			options: SINS.filter((s) => usedSins.has(s.id)).map((s) => ({
				id: s.id,
				label: ko ? s.ko : s.id,
				icon: sinIcon(s.id),
			})),
		},
		{
			key: 'keyword',
			label: ko ? '키워드' : 'Keyword',
			options: labels.keywords
				.filter((k) => usedKeywords.has(k.id))
				.map((k) => ({ id: k.id, label: k.text?.name ?? k.id, icon: keywordIcon(k.iconKey) })),
		},
	];

	const units: Unit[] = rows.map((e) => ({
		id: e.id,
		sectionId: String(e.sinnerId),
		rankIcon: e.rank ? egoRankIcon(e.rank) : null,
		rankLabel: e.rank ?? '',
		grade: e.rank ? RANKS.indexOf(e.rank) + 1 : 0,
		season: e.season,
		released: e.released,
		image: e.image,
		name: e.text?.name ?? e.id,
		fellBack: e.text?.fellBack ?? false,
		tags: {
			sinner: [String(e.sinnerId)],
			grade: e.rank ? [e.rank] : [],
			sin: e.sins,
			// 110 중 18 은 비어 있다. 어느 축에도 걸리지 않을 뿐 결손이 아니다.
			keyword: e.keywords,
		},
	}));

	return (
		<>
			<SecLabel
				title={t.nav.egos}
				sub={ko ? '인격에 장착하는 특수 기술' : 'Special abilities equipped to identities'}
				hint={units.length}
			/>
			<UnitList
				units={units}
				axes={axes}
				sections={sinners.map((s) => ({
					id: String(s.id),
					name: s.text?.name ?? String(s.id),
					icon: s.icon,
				}))}
				basePath={`/${locale}/egos`}
				searchPlaceholder={ko ? 'E.G.O 이름 검색' : 'Search E.G.O name'}
			/>
		</>
	);
}

/** E.G.O 등급. 게임이 정한 순서다. ALEPH 는 아직 출시분이 없다 — 부재이지 결손이 아니다. */
const RANKS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'];

const SINS = [
	{ id: 'wrath', ko: '분노' },
	{ id: 'lust', ko: '색욕' },
	{ id: 'sloth', ko: '나태' },
	{ id: 'gluttony', ko: '탐식' },
	{ id: 'gloom', ko: '우울' },
	{ id: 'pride', ko: '오만' },
	{ id: 'envy', ko: '질투' },
];
