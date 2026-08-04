import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listAxisLabels, listIdentitiesFull, listSinners } from '@/lib/queries/canonical/list';
import { keywordIcon, rarityIcon, sinIcon, statusIcon } from '@/lib/assets';
import { SecLabel } from '@/components/ui';
import { UnitList, type Axis, type Unit } from '@/components/unit-list';

/**
 * 인격 목록.
 *
 * **캐노니컬 층을 읽는다**(`lib/queries/canonical/list.ts`). 현행 스키마에는 출시일이 없어
 * 「등급 → 출시일」 정렬을 짤 수 없었다.
 *
 * 축은 여섯이다 — 수감자 · 등급 · 속성 · 키워드 · 특수 · 소속. **수감자를 섹션과 필터
 * 양쪽에 둔다.** 섹션은 건너뛰기고 필터는 거르기라 하는 일이 다르다.
 */
export default async function IdentitiesPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const [rows, sinners, labels] = await Promise.all([
		listIdentitiesFull(locale),
		listSinners(locale),
		listAxisLabels(locale),
	]);


	/** 데이터에 실제로 쓰인 값만 축에 올린다. 눌러도 아무것도 걸리지 않는 칩을 두지 않는다. */
	const used = (pick: (u: (typeof rows)[number]) => string[]) => new Set(rows.flatMap(pick));
	const usedSins = used((u) => u.sins);
	const usedKeywords = used((u) => u.keywords);
	const usedMechanics = used((u) => u.mechanics);
	const usedAssociations = used((u) => u.associations);

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
			label: ko ? '등급' : 'Rarity',
			iconOnly: true,
			options: [1, 2, 3].map((n) => ({ id: String(n), label: '0'.repeat(n), icon: rarityIcon(n) })),
		},
		{
			// 게임 밖 정보 사이트들이 이 축을 「속성」이라 부르고, E.G.O 의 각성 죄악과 한 말로 묶인다.
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
		{
			key: 'mechanic',
			label: ko ? '특수' : 'Special',
			options: labels.mechanics
				.filter((m) => usedMechanics.has(m.id))
				.map((m) => ({ id: m.id, label: m.text?.name ?? m.id, icon: statusIcon(m.sprite) })),
		},
		{
			key: 'association',
			label: ko ? '소속' : 'Association',
			options: labels.associations
				.filter((a) => usedAssociations.has(a.id))
				.map((a) => ({ id: a.id, label: a.text?.name ?? a.id })),
		},
	];

	const units: Unit[] = rows.map((u) => ({
		id: u.id,
		sectionId: String(u.sinnerId),
		rankIcon: rarityIcon(u.star),
		rankLabel: '0'.repeat(u.star),
		grade: u.star,
		season: u.season,
		released: u.released,
		image: u.image,
		name: u.text?.name ?? u.id,
		fellBack: u.text?.fellBack ?? false,
		tags: {
			sinner: [String(u.sinnerId)],
			grade: [String(u.star)],
			sin: u.sins,
			keyword: u.keywords,
			mechanic: u.mechanics,
			association: u.associations,
		},
	}));

	return (
		<>
			<SecLabel
				title={t.nav.identities}
				sub={ko ? '전투에 편성하는 단위' : 'Units you deploy in battle'}
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
				basePath={`/${locale}/identities`}
				searchPlaceholder={ko ? '인격 이름 검색' : 'Search identity name'}
			/>
		</>
	);
}

/** 죄악 7. 게임이 정한 순서이며 데이터의 `sin_info.order` 와 같다. */
const SINS = [
	{ id: 'wrath', ko: '분노' },
	{ id: 'lust', ko: '색욕' },
	{ id: 'sloth', ko: '나태' },
	{ id: 'gluttony', ko: '탐식' },
	{ id: 'gloom', ko: '우울' },
	{ id: 'pride', ko: '오만' },
	{ id: 'envy', ko: '질투' },
];
