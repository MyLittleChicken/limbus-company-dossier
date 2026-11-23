import {cacheReference} from '@/lib/query-cache';
import {createKeysMatcher,createKoreanMatcher,canSearch,searchKeys,type SearchKeys} from '@/lib/korean-search';
import type { Locale } from '@/lib/locale';
import type { $Enums, Prisma } from '@/src/v2/generated/client';
import { canonical } from '@/lib/db-canonical';
import { egoImage, giftIcon, identityImage, packIcon, statusIcon } from '@/lib/assets';
import { multi, one, type Named, type SearchParams } from '@/lib/queries/shared';
import { localeRows, nameOf, textOf } from './locale';

/**
 * 참조 화면이 쓰는 캐노니컬 질의 — about · dungeon · floors · glossary · 홈.
 *
 * **현행 `lib/queries/reference.ts` 를 대체한다.** 층만 다르고 반환 모양은 같다.
 * 하나만 예외다 — `getDataset` 이 `getBuildInfo` 가 된다(설계 5절).
 *
 * 로케일 공통부는 `./locale` 을 쓴다. `@/lib/queries/shared` 의 것은 행의 `locale` 을
 * `ko | en` 으로 받는데 캐노니컬 행은 `ko | en | ja` 라 안 좁혀진다 — 순수 함수
 * (`one` · `multi`)만 그쪽에서 가져온다.
 */

/**
 * 층별 등장 팩.
 *
 * 원본 구간은 hard 가 1 · 2 · 3 · 4 · 5 · 6–10 · 11–15 이고 normal 이 1–5 다.
 * "이번 층에 어떤 팩이 나오는가"의 판단 근거이며, 4단계 런 상태 입력의 전신이다.
 */
export async function listFloorPacks(locale: Locale) {
	const rows = await canonical.floorPack.findMany({
		include: { pack: { include: { texts: localeRows(locale) } } },
	});

	const groups = new Map<
		string,
		{
			difficulty: $Enums.Difficulty;
			range: string;
			packs: Array<{ id: string; icon: string | null; text: Named | null }>;
		}
	>();

	for (const row of rows) {
		const key = `${row.difficulty}|${row.floorRange}`;
		let group = groups.get(key);
		if (!group) {
			group = { difficulty: row.difficulty, range: row.floorRange, packs: [] };
			groups.set(key, group);
		}
		group.packs.push({
			id: row.packId,
			icon: packIcon(row.pack.sprite),
			text: nameOf(row.pack.texts, locale),
		});
	}

	// 구간 표기가 `1` 과 `6-10` 이 섞여 있다. 시작 층 기준으로 정렬한다.
	const start = (range: string) => Number(range.split('-')[0] ?? '0');

	return [...groups.values()]
		.sort((a, b) => a.difficulty.localeCompare(b.difficulty) || start(a.range) - start(b.range))
		.map((g) => ({
			...g,
			packs: g.packs.sort((a, b) => a.id.localeCompare(b.id)),
		}));
}

/**
 * 거울 던전 구성과 은총.
 *
 * **은총은 판본에 안 묶여 있다.** 현행은 `GraceOption` 이 `MirrorDungeon` 에
 * 딸렸지만 캐노니컬의 `grace` 는 독립 표다 — 은총 목록이 판본마다 갈린다는 근거가
 * 원본에 없어서다. 따로 질의해 합친다.
 */
export async function getDungeon(locale: Locale) {
	const [dungeon, graces] = await Promise.all([
		canonical.mirrorDungeon.findFirst({ include: { texts: localeRows(locale) } }),
		canonical.grace.findMany({ orderBy: { index: 'asc' }, include: { texts: localeRows(locale) } }),
	]);
	if (!dungeon) return null;

	return {
		version: dungeon.version,
		// 화면은 내부 키가 아니라 명칭을 쓴다(05-ui-foundation 10절).
		text: nameOf(dungeon.texts, locale),
		totalFloors: dungeon.totalFloors,
		baseFloors: dungeon.baseFloors,
		graces: graces.map((g) => {
			const picked = g.texts.find((t) => t.locale === locale)
				?? g.texts.find((t) => t.locale === 'en');
			return {
				id: g.id,
				cost: g.cost,
				name: picked?.name ?? null,
				fellBack: picked !== undefined && picked.locale !== locale,
				/**
				 * 강화 단계별 효과 설명.
				 *
				 * **캐노니컬은 중첩 배열 원문을 그대로 담는다** — 한 단계가 효과
				 * 여럿을 갖는다. 현행은 적재 시점에 `·` 로 이어 붙여 평평하게
				 * 만들었는데, 그건 표시 결정이라 질의층이 할 일이다. 원문은
				 * `canonical` 에 남고 여기서 화면 모양으로 편다.
				 */
				descs: ((picked?.descs ?? []) as string[][]).map((step) => step.join(' · ')),
			};
		}),
	};
}

export interface GlossaryFilter {
	q?: string | undefined;
	buffTypes: string[];
	page: number;
}

export const GLOSSARY_PAGE = 120;

export function readGlossaryFilter(params: SearchParams): GlossaryFilter {
	const page = Number(one(params['page']) ?? '1');
	return {
		q: one(params['q'])?.trim() || undefined,
		buffTypes: multi(params['buff']),
		page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
	};
}

const statusCorpus=cacheReference(()=>canonical.status.findMany({orderBy:{id:'asc'},include:{texts:{where:{locale:{in:['ko','en']}}}}}));

/** 필터에 맞는 상태 원본 행 — `listStatuses` 와 `listStatusesUnpaged` 가 같이 쓴다. 차례는 id 순 그대로다. */
async function matchStatuses(filter: Omit<GlossaryFilter, 'page'>) {
 const matches=createKoreanMatcher(filter.q??'');
 const candidates=(await statusCorpus()).filter(s=>!filter.buffTypes.length||filter.buffTypes.includes(s.buffType??''));
 return candidates.filter(s=>!filter.q||s.texts.some(t=>matches(t.name)||matches(t.desc)));
}

type StatusSource = Awaited<ReturnType<typeof statusCorpus>>[number];

function toStatusRow(s: StatusSource, locale: Locale) {
	return {
		id: s.id,
		buffType: s.buffType,
		// 아이콘 없는 254종은 수치 변화형이라 게임에도 아이콘이 없다. 결손이 아니다.
		icon: statusIcon(s.sprite),
		text: textOf(s.texts, locale),
	};
}

export async function listStatuses(locale: Locale, filter: GlossaryFilter) {
 const matched=await matchStatuses(filter);
 const total=matched.length;
 const rows=matched.slice((filter.page-1)*GLOSSARY_PAGE,filter.page*GLOSSARY_PAGE);

	return {
		total,
		page: filter.page,
		pageCount: Math.max(1, Math.ceil(total / GLOSSARY_PAGE)),
		items: rows.map((s) => toStatusRow(s, locale)),
	};
}

/**
 * `listStatuses` 를 쪽 없이 — MCP `list_statuses` 가 쓴다. 필터 · 차례 · 행 모양이 같다
 * (`matchStatuses` · `toStatusRow` 를 같이 쓴다). 커서는 호출하는 쪽이 자른다.
 */
export async function listStatusesUnpaged(locale: Locale, filter: Omit<GlossaryFilter, 'page'>) {
	return (await matchStatuses(filter)).map((s) => toStatusRow(s, locale));
}

export const listGlossaryAxes=cacheReference(async(locale: Locale)=>{
	const [sins, keywords, counts] = await Promise.all([
		canonical.sinInfo.findMany({ orderBy: { order: 'asc' }, include: { texts: localeRows(locale) } }),
		canonical.keyword.findMany({ orderBy: { order: 'asc' }, include: { texts: localeRows(locale) } }),
		canonical.status.groupBy({ by: ['buffType'], _count: true }),
	]);

	return {
		sins: sins.map((s) => ({ id: s.sin, attribute: s.attribute, text: nameOf(s.texts, locale) })),
		keywords: keywords.map((k) => ({ id: k.id, text: nameOf(k.texts, locale) })),
		buffTypes: counts.map((c) => ({ id: c.buffType, count: c._count })),
	};
});

/**
 * 이 데이터가 무엇에서 나왔나. 조회 화면에서도 확인 가능해야 한다(05-ui-foundation 10절).
 *
 * **`public.dataset` 을 대체한다.** 그쪽은 `sourceAnchor` 문자열 하나였는데 여기서는
 * 스냅샷·코드·저작으로 갈린다(ADR-08). 다만 화면이 보여주던 것은 전부 대응이 있다 —
 * 실측으로 확인했다.
 *
 * ```
 * gameVersion · sourceAnchor  "차원찢개 이상 인격 출시 시점"  = snapshot.gameAnchor
 * snapshotDate · generatedAt  2026-07-25                    = snapshot.id · createdAt
 * mdVersion                   "MD7"                         = mirrorDungeon.version
 * ```
 */
export async function getBuildInfo() {
	const [build, snapshot, dungeon] = await Promise.all([
		canonical.buildInfo.findFirst(),
		canonical.snapshot.findFirst({ orderBy: { version: 'desc' } }),
		canonical.mirrorDungeon.findFirst(),
	]);
	if (snapshot === null) return null;

	return {
		/** "2026-07-25". 수집 시점이자 스냅샷 id 다 */
		snapshotId: snapshot.id,
		/** 우리 스냅샷 일련. 단조 증가 */
		snapshotVersion: snapshot.version,
		/** "차원찢개 이상 인격 출시 시점" */
		gameAnchor: snapshot.gameAnchor,
		snapshotAt: snapshot.createdAt,
		/** "MD7" */
		mdVersion: dungeon?.version ?? null,
		/** 굽는 데 쓴 코드. 없으면 판 표식 이전에 구워진 판이다 */
		codeCommit: build?.codeCommit ?? null,
		builtAt: build?.builtAt ?? null,
		rowCount: build?.rowCount ?? null,
	};
}

// ── 통합 검색 ────────────────────────────────────────────────────

/**
 * 대상은 **치환된 표시용 `desc`** 이고 `descRaw` 는 쓰지 않는다(05-ui-foundation 5절).
 * 사용자가 입력하는 것은 표시 문자열이며, 원문에는 내부 식별자와 `<noparse>` 마커가 남아 있다.
 *
 * 계산은 서버에서 한다(ADR-05 3.3). 표시 문자열 7,498 KB 를 클라이언트로 보내지 않는다.
 */
const PER_KIND = 8;

export interface SearchHit {
	kind: 'gift' | 'pack' | 'identity' | 'ego';
	id: string;
	href: string;
	icon: string | null;
	name: string | null;
	fellBack: boolean;
	meta: string;
}

/*
	검색 열쇠 — 말뭉치를 캐시할 때 행마다 자모 · 초성을 한 번 풀어 둔다(`searchKeys`).
	전에는 질의마다 모든 이름 · 설명문을 다시 풀었다(기프트 설명문이 커서 질의당 수십 ms).
	판정은 `createKeysMatcher` — `createKoreanMatcher` 와 같은 규칙을 같은 파일에서 공유한다.
*/
const searchCorpus=cacheReference(async()=>{
 const searchableTexts={where:{locale:{in:['ko','en'] as $Enums.Locale[]}}};
 // Match the small canonical text corpus on the server, before limiting each group.
 // SQL contains cannot match Korean initial consonants or unfinished IME syllables.
 const [giftRows,packRows,identityRows,egoRows]=await Promise.all([
  canonical.gift.findMany({where:{domain:'mirror_dungeon'},orderBy:{id:'asc'},include:{stages:{orderBy:{level:'asc'},include:{texts:searchableTexts}}}}),
  canonical.pack.findMany({orderBy:{id:'asc'},include:{texts:searchableTexts}}),
  canonical.identity.findMany({orderBy:{id:'asc'},include:{texts:searchableTexts}}),
  canonical.ego.findMany({where:{presentationOnly:false},orderBy:{id:'asc'},include:{texts:searchableTexts}}),
 ]);
 // 질의 텍스트는 캐시 키가 아니다 — 말뭉치만 캐시한다(query-cache 의 규칙).
 return [
  giftRows.map(row=>({row,keys:searchKeys(row.stages.flatMap(s=>s.texts.flatMap(t=>[t.name,t.desc])))})),
  packRows.map(row=>({row,keys:searchKeys(row.texts.map(t=>t.name))})),
  identityRows.map(row=>({row,keys:searchKeys(row.texts.map(t=>t.title))})),
  egoRows.map(row=>({row,keys:searchKeys(row.texts.map(t=>t.name))})),
 ] as const;
});

export async function searchAll(query: string, locale: Locale): Promise<SearchHit[]> {
	const q = query.trim();
	if (!canSearch(q)) return [];

	const matches=createKeysMatcher(q);
 const [giftRows,packRows,identityRows,egoRows]=await searchCorpus();
 const pick=<T,>(rows:ReadonlyArray<{row:T;keys:SearchKeys}>)=>{
  const out:T[]=[];
  for(const r of rows){if(matches(r.keys)){out.push(r.row);if(out.length>=PER_KIND)break;}}
  return out;
 };
 const gifts=pick(giftRows);
 const packs=pick(packRows);
 const identities=pick(identityRows);
 const egos=pick(egoRows);

	const hits: SearchHit[] = [];

	for (const g of gifts) {
		const t = nameOf(g.stages[0]?.texts ?? [], locale);
		hits.push({
			kind: 'gift',
			id: g.id,
			href: `/${locale}/gifts/${g.id}`,
			icon: giftIcon(g.sprite),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: g.tierLabel ?? (g.tier === null ? '' : String(g.tier)),
		});
	}
	for (const p of packs) {
		const t = nameOf(p.texts, locale);
		hits.push({
			kind: 'pack',
			id: p.id,
			href: `/${locale}/packs/${p.id}`,
			icon: packIcon(p.sprite),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: p.category,
		});
	}
	for (const i of identities) {
		const pick = i.texts.find((r) => r.locale === locale) ?? i.texts.find((r) => r.locale === 'en');
		hits.push({
			kind: 'identity',
			id: i.id,
			href: `/${locale}/identities/${i.id}`,
			icon: identityImage(Number(i.id), 'profile'),
			name: pick ? (pick.title ?? pick.name).replace(/\s+/g, ' ').trim() : null,
			fellBack: pick !== undefined && pick.locale !== locale,
			meta: '0'.repeat(i.star),
		});
	}
	for (const e of egos) {
		const t = nameOf(e.texts, locale);
		hits.push({
			kind: 'ego',
			id: e.id,
			href: `/${locale}/egos/${e.id}`,
			icon: egoImage(Number(e.id), 'awaken'),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: e.rank ?? '',
		});
	}

	return hits;
}

/** 적재된 테이블별 행 수. 고지 화면이 데이터의 범위를 밝히는 데 쓴다. */
export const getCounts=cacheReference(async()=>{
	const [gifts, packs, identities, egos, skills, statuses, affiliations, relations] =
		await Promise.all([
			canonical.gift.count(),
			canonical.pack.count(),
			canonical.identity.count(),
			canonical.ego.count(),
			canonical.skill.count(),
			canonical.status.count(),
			canonical.association.count(),
			canonical.giftPack.count(),
		]);
	return { gifts, packs, identities, egos, skills, statuses, affiliations, relations };
});
