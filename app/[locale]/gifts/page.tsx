import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import {
	GIFT_TIER_LABEL,
	GIFT_TIERS,
	listAllGifts,
	listCursedGiftIds,
	listKeywords,
} from '@/lib/queries/gifts';
import { keywordIcon } from '@/lib/assets';
import { SecLabel } from '@/components/ui';
import { UnitList, type Axis, type Section, type Unit } from '@/components/unit-list';

/**
 * E.G.O 기프트 목록.
 *
 * 인격·E.G.O 와 **같은 골격**을 쓴다(`components/unit-list.tsx`). 다른 것은 섹션을
 * 수감자가 아니라 키워드로 가른다는 것뿐이다.
 *
 * 축은 둘이다 — 등급 · 키워드. 「팩 전용 / 범용」 풀 축은 뺐다.
 *
 * 죄악 속성은 내지 않는다. 원본에 있는 값이지만 게임에서 무엇을 하는지 확인되지 않았다
 * (`docs/backlog/03-gift-affinity.md`). 확인 전까지 등급·키워드와 같은 무게로 두지 않는다.
 */
export default async function GiftsPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const [gifts, keywords, cursed] = await Promise.all([
		listAllGifts(locale),
		listKeywords(locale),
		listCursedGiftIds(),
	]);

	/**
	 * 키워드가 없는 기프트를 어느 칸에 넣는가.
	 *
	 * 120 종은 **범용**이다 — 결손이 아니라 특정 기믹에 매이지 않는다는 뜻이다. 그중 셋만
	 * 성격이 다르다(`listCursedGiftIds`). 그 셋을 범용에 섞으면 「아군에게 불리한 범용」이
	 * 되어 말이 맞지 않는다.
	 */
	const GENERIC = 'generic';
	const CURSED = 'cursed';
	const sectionOf = (id: number, keywordId: string | null) =>
		keywordId ?? (cursed.has(id) ? CURSED : GENERIC);

	/*
		섹션 차례 — 범용이 맨 위, 그다음 게임이 정한 키워드 순서(화상 · 출혈 · 진동 · 파열 ·
		침잠 · 호흡 · 충전 · 참격 · 관통 · 타격), 특수한 셋이 끝이다. 키워드 순서는 우리가
		정한 것이 아니라 `keyword.order` 에 있는 값 그대로다.
	*/
	const sections: Section[] = [
		{ id: GENERIC, name: ko ? '범용' : 'Generic' },
		...keywords.map((k) => ({
			id: k.id,
			name: k.text?.name ?? k.id,
			icon: keywordIcon(k.id),
		})),
		{ id: CURSED, name: ko ? '저주 · 축복' : 'Curse · Blessing' },
	];

	const axes: Axis[] = [
		{
			key: 'tier',
			label: ko ? '등급' : 'Tier',
			// 게임이 카드에 로마자를 인쇄한다. 애셋으로는 없어 글자로 낸다.
			options: GIFT_TIERS.map((v) => ({ id: v, label: GIFT_TIER_LABEL[v] ?? v })),
		},
		{
			key: 'keyword',
			label: ko ? '키워드' : 'Keyword',
			// 축의 값과 섹션이 같은 목록을 쓴다. 둘이 어긋나면 걸러 놓고도 못 찾는다.
			options: sections.map((s) => ({ id: s.id, label: s.name, icon: s.icon ?? null })),
		},
	];

	const units: Unit[] = gifts.map((g) => ({
		id: String(g.id),
		sectionId: sectionOf(g.id, g.keywordId),
		// 등급 애셋이 없다. 기프트 456 장과 `assets/icons/` 54 종을 다 뒤졌다.
		rankText: GIFT_TIER_LABEL[g.tier] ?? g.tier,
		grade: GIFT_TIERS.indexOf(g.tier as (typeof GIFT_TIERS)[number]),
		image: g.icon,
		name: g.text?.name ?? String(g.id),
		fellBack: g.text?.fellBack ?? false,
		note: g.exclusiveCount > 0 ? (ko ? '팩 전용' : 'Pack-exclusive') : null,
		tags: {
			tier: [g.tier],
			keyword: [sectionOf(g.id, g.keywordId)],
		},
	}));

	return (
		<>
			<SecLabel
				title={t.nav.gifts}
				sub={ko ? '거울 던전에서 획득하는 강화 요소' : 'Mirror Dungeon rewards'}
				hint={units.length}
			/>
			<UnitList
				units={units}
				axes={axes}
				sections={sections}
				basePath={`/${locale}/gifts`}
				searchPlaceholder={ko ? '기프트 이름 검색' : 'Search gift name'}
				variant="icon"
			/>
		</>
	);
}
