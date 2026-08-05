import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 애셋 경로 해석.
 *
 * ADR-05 6절 제약 2 — **경로 해석을 한 모듈에 모은다.** 엔티티마다 매칭 키가 다르고
 * 규칙이 화면마다 흩어지면 패치 때 갱신 지점을 놓친다.
 *
 * 핵심은 **파일명이 id 가 아니라는 것**이다(`04-data-inventory.md` 7절).
 * 기프트 456종 중 파일명이 숫자인 것은 76종뿐이고 나머지는 게임 내부 스프라이트 키,
 * 즉 영문 이름이다. id 로 추정해 찾으면 대부분 실패한다.
 *
 * 인덱스는 첫 사용 때 한 번 만들고 프로세스가 사는 동안 재사용한다.
 * 스냅샷은 실행 중에 바뀌지 않는다(`02-pipeline.md` 5절 원칙 5).
 */

const ASSET_ROOT = join(process.cwd(), 'data', 'assets');

/** 같은 카테고리에 출처가 여럿일 때의 우선순위. 정본이 먼저다(ADR-04 2.1). */
const SOURCE_PRIORITY = ['limbus-assets', 'shared-library', 'v1-local'];

export type AssetCategory =
	| 'gifts'
	| 'packs'
	| 'identities'
	| 'egos'
	| 'skills'
	| 'skill-frames'
	| 'statuses'
	| 'sinners'
	| 'icons';

const indexes = new Map<AssetCategory, Map<string, string>>();

function buildIndex(category: AssetCategory): Map<string, string> {
	const map = new Map<string, string>();
	const base = join(ASSET_ROOT, category);
	if (!existsSync(base)) return map;

	const sources = readdirSync(base)
		.filter((name) => statSync(join(base, name)).isDirectory())
		.sort((a, b) => {
			const ai = SOURCE_PRIORITY.indexOf(a);
			const bi = SOURCE_PRIORITY.indexOf(b);
			return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
		});

	for (const source of sources) {
		for (const file of readdirSync(join(base, source))) {
			const key = file.replace(/\.(webp|png|jpg|jpeg)$/i, '');
			// 파일명에 공백과 아포스트로피가 흔하다(`Ashes to Ashes.webp`). URL 로 나갈 때
			// 인코딩하지 않으면 경로가 깨진다. 조각 단위로 인코딩해 `/` 는 남긴다.
			const url = `/assets/${category}/${source}/${encodeURIComponent(file)}`;
			// 우선순위가 높은 출처를 먼저 훑으므로 이미 있으면 덮지 않는다.
			if (!map.has(key)) map.set(key, url);
		}
	}
	return map;
}

function indexFor(category: AssetCategory): Map<string, string> {
	let found = indexes.get(category);
	if (!found) {
		found = buildIndex(category);
		indexes.set(category, found);
	}
	return found;
}

/**
 * 스프라이트 키를 파일명 후보로 바꾼다.
 *
 * 상류가 파일 시스템에 쓸 수 없는 문자를 `_` 로 바꿔 저장했다.
 * `Angel's Cut` 이 `Angel_s Cut.webp` 인 식이다. 아포스트로피는 곧은 것과
 * 굽은 것(U+2019)이 섞여 있어 둘 다 시도한다.
 */
function candidates(key: string): string[] {
	return [
		key,
		key.replace(/['’]/g, '_'),
		key.replace(/[/\\:*?"<>|'’]/g, '_'),
		key.replace(/’/g, "'"),
	];
}

function lookup(category: AssetCategory, key: string | null | undefined): string | null {
	if (!key) return null;
	const index = indexFor(category);
	for (const candidate of candidates(String(key))) {
		const hit = index.get(candidate);
		if (hit) return hit;
	}
	return null;
}

/**
 * 기프트 아이콘. 키는 `gift.sprite` 이며 id 가 아니다.
 *
 * **`null` 을 받는다.** 캐노니컬의 `gift.sprite` 가 nullable 이다 — 초판에 컬럼이
 * 없어 아이콘이 전량 소실된 적이 있고 id 로는 유도되지 않는다(스키마 주석). 지금
 * 거울 던전 기프트 456종은 전부 차 있지만, 없을 수 있는 것을 타입이 말해야 한다.
 * `statusIcon` 이 같은 이유로 그렇게 돼 있다.
 */
export const giftIcon = (sprite: string | null): string | null => lookup('gifts', sprite);

/**
 * 테마 팩 이미지. 키는 `pack.sprite` 다.
 *
 * **보스 층 변형이 따로 있다.** `Amber_hard` 에 `Amber_hard_boss` 가 짝으로 있는 식이며
 * 실측 40개다. 카드 그림 안에 그 층의 보스가 함께 그려져 있다.
 * 난이도(`_normal` · `_hard` · `_effective`)는 이미 스프라이트 키에 들어 있고
 * 우리 데이터에서는 난이도마다 별도 팩 행이다.
 *
 * `Canto_*` 계열은 보스 변형이 없다 — 그 자체가 보스전 팩이고 `bossEncounters` 를 갖는다.
 */
export const packIcon = (sprite: string): string | null => lookup('packs', sprite);

/** 보스 층에 쓰이는 팩 그림. 없으면 null 이며 그것이 정상인 팩이 있다. */
export const packBossIcon = (sprite: string): string | null => lookup('packs', `${sprite}_boss`);

/** 인격 등급. 게임 표기 0 / 00 / 000 이 그대로 파일명이다(00-product 3절). */
export const rarityIcon = (rarity: number): string | null =>
	lookup('icons', '0'.repeat(Math.min(Math.max(rarity, 1), 3)));

/** 죄악 7종. 파일명이 소문자 enum 값과 같다. */
export const sinIcon = (sin: string): string | null => lookup('icons', sin);

/** 공격 타입·방어 구분. 파일명이 첫 글자만 대문자다. */
const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const atkTypeIcon = (atkType: string): string | null =>
	lookup('icons', capitalize(atkType));

export const defTypeIcon = (defType: string): string | null =>
	defType === 'attack' ? null : lookup('icons', capitalize(defType));

/** E.G.O 등급. enum 은 대문자이고 파일명은 소문자다. */
export const egoRankIcon = (rank: string): string | null => lookup('icons', rank.toLowerCase());

/**
 * 기프트 연관 키워드. 상태 7종과 공격 타입 3종을 한 축으로 다룬다(02-data-model 4.3).
 * 파일명이 첫 글자만 대문자라 그대로 쓰면 찾지 못한다.
 */
export const keywordIcon = (keywordId: string): string | null =>
	lookup('icons', capitalize(keywordId));

/** 상태 아이콘. 아이콘이 없는 수치 변화형 상태가 254종 있고 그것은 결손이 아니다. */
export const statusIcon = (sprite: string | null): string | null => lookup('statuses', sprite);

export const sinnerIcon = (sinnerId: number): string | null => lookup('sinners', String(sinnerId));

/**
 * 인격 스킬 아이콘.
 * 12종은 원본에 파일이 없다(`04-data-inventory.md` 7절). null 을 돌려주고 화면이 대체 표시한다.
 */
export const skillIcon = (skillId: number): string | null => lookup('skills', String(skillId));

export type IdentityImageKind = 'profile' | 'full' | 'profileBase' | 'fullAwakened';

/**
 * 인격 이미지.
 *
 * 네 변형이 있고 수가 다르다 — `_normal`(전신) 184 · `_gacksung_profile`(각성 프로필) 184 ·
 * `_normal_profile` 172 · `_gacksung`(각성 전신) 172.
 * 목록 썸네일에는 184종 전부가 가진 각성 프로필을 쓴다.
 */
export function identityImage(id: number, kind: IdentityImageKind = 'profile'): string | null {
	const suffix = {
		profile: '_gacksung_profile',
		profileBase: '_normal_profile',
		full: '_normal',
		fullAwakened: '_gacksung',
	}[kind];
	return lookup('identities', `${id}${suffix}`);
}

export type EgoImageKind = 'awaken' | 'cg' | 'erosion';

/**
 * E.G.O 이미지. 침식 프로필은 98종만 있다 — 침식이 없는 E.G.O 가 12종이기 때문이다.
 */
export function egoImage(id: number, kind: EgoImageKind = 'awaken'): string | null {
	const suffix = { awaken: '_awaken_profile', cg: '_cg', erosion: '_erosion_profile' }[kind];
	return lookup('egos', `${id}${suffix}`);
}

/** 등급·죄악 등 공용 아이콘. 키는 파일명 그대로다. */
export const uiIcon = (key: string): string | null => lookup('icons', key);

/**
 * 스킬 프레임.
 *
 * **`skill.tier` 는 표시용 숫자가 아니라 애셋을 고르는 키다.** 프레임 파일이
 * `{죄악}-{1|2|3}.webp` 형태이고 방어 스킬은 `def.webp` 하나를 쓴다(실측 44개).
 *
 * 아이콘이 없는 스킬 12종에서도 프레임은 뜨므로, 프레임이 곧 대체 표시가 된다 —
 * 죄악과 등급은 프레임만으로 읽힌다.
 */
export function skillFrame(
	affinity: string | null,
	tier: number,
	defType: string,
): { frame: string | null; background: string | null } {
	// 방어 스킬과 죄악이 없는 스킬(131건)은 죄악별 프레임이 없다.
	const key =
		defType !== 'attack' || !affinity
			? 'def'
			: // tier 4 가 1건 있으나 프레임은 3까지다. 넘치면 가장 높은 것을 쓴다.
				`${affinity}-${Math.min(Math.max(tier, 1), 3)}`;
	return {
		frame: lookup('skill-frames', key),
		background: lookup('skill-frames', `${key}-bg`),
	};
}
