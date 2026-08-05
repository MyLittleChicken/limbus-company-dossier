/**
 * 거울 던전 판본. **원본에 없는 값을 유도한다.**
 *
 * 판본 번호도 층수도 데이터에 명시돼 있지 않다(`docs/01-data-source.md` 8절 미결).
 * 현행 파이프라인(`src/entities/egos.ts`)이 파일명과 층 표에서 뽑아 만들며, 같은
 * 유도를 `raw.raw_file` 과 `canonical.floor_pack` 위에서 한다.
 *
 * **적재 시점에 한 번 한다.** 질의 시점에 매번 다시 세지 않는다 — 산문 유도를
 * 적재 시점에 굳힌 것과 같은 이유다(2026-08-03 메카닉 축 그래프 설계).
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-05-app-cutover-design.md';

/**
 * 판본 번호를 파일명에서 뽑는 무늬.
 *
 * **표제어 id 로 찾으면 안 된다** — `MD6147` 같은 상태 식별자가 걸려 판본이
 * 6147 이 된다. 파일명의 `_Mirror<n>` · `_MD<n>` 만 본다. 현행이 겪은 함정이고
 * 주석으로 남아 있다.
 */
export const VERSION_PATTERN = /_(?:Mirror|MD)(\d+)(?:\.json$|_)/;

export interface MirrorDungeonInput {
	/** `mirror-dungeon/loc-*` 의 파일 경로. 판본 번호를 여기서 뽑는다 */
	localeFiles: string[];
	floorPack: Array<{ difficulty: string; floorRange: string }>;
	/** `MirrorDungeonName.json` 의 로케일별 항목. id 는 `mirrordungeon_name_<n>` */
	names: Array<{ locale: string; id: string; content: string }>;
}

export interface MirrorDungeonRow {
	version: string;
	totalFloors: number;
	baseFloors: number;
}

export interface MirrorDungeonTextRow {
	version: string;
	locale: string;
	name: string;
}

export interface MirrorDungeonTables {
	mirrorDungeon: MirrorDungeonRow[];
	mirrorDungeonText: MirrorDungeonTextRow[];
}

/**
 * 파일명에서 판본을 뽑는다. 최댓값이 지금 판본이다.
 *
 * 하나도 못 찾으면 `null` 이다 — `'unknown'` 같은 가짜 값을 만들지 않는다.
 * 판본이 없으면 그 사실이 결손으로 남아야 한다.
 */
export function detectVersion(paths: string[]): string | null {
	let max = 0;
	for (const p of paths) {
		const m = VERSION_PATTERN.exec(p);
		if (m?.[1]) max = Math.max(max, Number(m[1]));
	}
	return max > 0 ? `MD${max}` : null;
}

/**
 * 구간 표기의 최댓값. `"11-15"` → 15 · `"7"` → 7.
 *
 * 숫자가 아닌 조각은 0 으로 친다. `Number('boss')` 는 `NaN` 이고 `Math.max` 에
 * 넣으면 결과가 통째로 `NaN` 이 되는데, 그러면 「층수를 모른다」가 아니라
 * 「층수가 NaN 이다」가 DB 에 들어간다.
 */
export function floorBounds(
	rows: Array<{ difficulty: string; floorRange: string }>,
): { totalFloors: number; baseFloors: number } {
	const maxOf = (difficulty: string): number => {
		let max = 0;
		for (const r of rows) {
			if (r.difficulty !== difficulty) continue;
			for (const part of r.floorRange.split('-')) max = Math.max(max, Number(part) || 0);
		}
		return max;
	};
	return { totalFloors: maxOf('hard'), baseFloors: maxOf('normal') };
}

/**
 * 판본의 이름 행 하나를 고른다.
 *
 * **접미사 없는 id 를 쓴다.** `mirrordungeon_name_7` 이 판본 이름이고,
 * `_7_0` · `_7_1` 은 난이도가 붙은 표기다(「… [NORMAL]」 · 「… [HARD]」).
 * 화면은 난이도를 따로 고르므로 이름에 그것이 섞이면 안 된다.
 */
export function nameIdFor(version: string): string {
	return `mirrordungeon_name_${version.replace(/^MD/, '')}`;
}

export function buildMirrorDungeon(input: MirrorDungeonInput, meta: Meta): MirrorDungeonTables {
	const version = detectVersion(input.localeFiles);
	if (version === null) {
		meta.gap('mirror_dungeon', '', 'version', '파일명에서 판본 번호를 못 얻었다', EVIDENCE);
		return { mirrorDungeon: [], mirrorDungeonText: [] };
	}

	const { totalFloors, baseFloors } = floorBounds(input.floorPack);
	if (totalFloors === 0 || baseFloors === 0) {
		// 층 표를 못 읽었다는 뜻이다. 0 을 조용히 넣으면 화면이 「0층 던전」을 그린다
		meta.gap('mirror_dungeon', version, 'floors',
			`층 구간에서 층수를 못 얻었다 (hard ${totalFloors} · normal ${baseFloors})`, EVIDENCE);
	}

	const wanted = nameIdFor(version);
	const texts = input.names
		.filter((n) => n.id === wanted)
		.map((n) => ({ version, locale: n.locale, name: n.content }));

	if (texts.length === 0) {
		meta.gap('mirror_dungeon', version, 'name', `어느 로케일에도 ${wanted} 가 없다`, EVIDENCE);
	}

	return {
		mirrorDungeon: [{ version, totalFloors, baseFloors }],
		mirrorDungeonText: texts,
	};
}
