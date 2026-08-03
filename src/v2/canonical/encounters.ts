/**
 * 전투 조우 251종과 적 1,342종.
 *
 * **적 저항이 10축이고 부위마다 따로 있다** — 물리 3축(slash·pierce·blunt) +
 * 죄악 7축. 인격 3축 · E.G.O 7축과 다르다(마스터북 인카운터 편).
 *
 * `targets` 와 배타적인 다른 모양이 셋 더 있다(`waves` 59 · `phases` 13 ·
 * `battles` 27). 구조가 갈리므로 원문을 JSONB 로 남긴다.
 *
 * **전투 풀 2,525종은 여전히 못 잇는다.** mj packs_detail 의 7자리 숫자와
 * assets 의 UUID·이름표가 이어지지 않으며 연결표가 리포에 없다(backlog/10).
 */
import { arr, num, str, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const ASSETS = 'limbus-assets';
const LOC = 'loc-ko/en/ja';
const EVIDENCE = 'docs/data/encounter/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/** 적 저항 10축 — 물리 3 + 죄악 7 */
const AXES = [
	'slash', 'pierce', 'blunt',
	'wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy',
] as const;

function obj(v: unknown): Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: {};
}

export interface EncounterInput {
	/** encounters/limbus-assets/*.json — id 가 파일명 stem 이다 */
	encounters: RawIndex;
	/** mirror-dungeon/limbus-assets/encounters.json — 그룹별 이름표 */
	groups: RawIndex;
	enemyKo: RawIndex;
	enemyEn: RawIndex;
	enemyJa: RawIndex;
	/** 팩 bossEncounters 를 잇기 위한 팩 id 집합 */
	knownPacks: Set<string>;
	packs: RawIndex;
}

// 원본은 타깃을 네 갈래로 담는다 — top(targets 최상위) · wave · phase · battle.
// 스키마(0060c49)의 TargetKind 와 짝을 맞춘다.
export type TargetKind = 'top' | 'wave' | 'phase' | 'battle';

export interface EncounterTables {
	encounter: Array<{ id: string; group: string | null; name: string; siteId: string; waves?: unknown; phases?: unknown; battles?: unknown }>;
	encounterTarget: Array<{ encounterId: string; kind: TargetKind; groupIndex: number; index: number; name: string; portrait: number | null; num: number | null }>;
	encounterTargetPart: Array<{ encounterId: string; kind: TargetKind; groupIndex: number; targetIndex: number; partId: string; name: string; hpBase: number | null; hpLevel: number | null; defCorrection: number | null; speedMin: number | null; speedMax: number | null }>;
	encounterPartResist: Array<{ encounterId: string; kind: TargetKind; groupIndex: number; targetIndex: number; partId: string; axis: string; value: number }>;
	enemy: Array<{ id: string }>;
	enemyText: Array<{ enemyId: string; locale: Loc; name: string; roleLabel: string | null }>;
	packBossEncounter: Array<{ packId: string; encounterId: string }>;
}

export function buildEncounters(input: EncounterInput, meta: Meta): EncounterTables {
	const t: EncounterTables = {
		encounter: [], encounterTarget: [], encounterTargetPart: [],
		encounterPartResist: [], enemy: [], enemyText: [], packBossEncounter: [],
	};

	// 그룹 이름표 — {luxcavation: {...}, md: {"canto-1-1": "The Forgotten"}, …}
	// 파일명 stem 이 "md__canto-1-1" 꼴이므로 그룹을 앞에서 떼어낸다.
	const groupNames = new Set<string>(input.groups.keys());

	for (const [id, e] of input.encounters) {
		const name = str(e, 'name');
		const siteId = str(e, 'siteId');
		if (name === null || siteId === null) {
			meta.gap('encounter', id, 'core', 'name 이나 siteId 가 없다', EVIDENCE);
			continue;
		}
		const group = [...groupNames].find((g) => id.startsWith(`${g}__`)) ?? null;
		// **JS null 을 주면 Prisma 가 JSON null 을 쓴다** — SQL NULL 이 아니다.
		// 키를 아예 빼야 SQL NULL 이 된다. 아카이브가 「없음」을 거짓말하면 안 된다.
		const row: EncounterTables['encounter'][number] = { id, group, name, siteId };
		if (e['waves'] !== undefined) row.waves = e['waves'];
		if (e['phases'] !== undefined) row.phases = e['phases'];
		if (e['battles'] !== undefined) row.battles = e['battles'];
		t.encounter.push(row);
		meta.source('encounter', id, 'core', 'assets-only', [ASSETS]);

		// 원본은 타깃을 네 갈래로 담는다. **뜻이 서로 달라 한 축으로 뭉개면 안 된다** —
		// battle 은 서로 배타적인 보스 후보고, wave·phase 는 같은 보스전의 내용이다.
		// 초판은 top 만 읽어 보스 데이터가 있는 44팩을 통째로 잃었다.
		const pushTargets = (kind: TargetKind, groupIndex: number, rawTargets: unknown[]) => {
			rawTargets.forEach((rawTarget, index) => {
				const target = obj(rawTarget);
				// **이름이 비어도 버리지 않는다.** 실측 1건(story__9-5-24)이 빈 문자열이며
				// 버리면 부위와 저항까지 통째로 사라진다.
				const targetName = str(target, 'name');
				if (targetName === null) {
					meta.gap(
						'encounter_target', `${id}#${kind}#${groupIndex}#${index}`, 'name',
						'적 이름이 비어 있다 (원본 결함)', EVIDENCE,
					);
				}
				t.encounterTarget.push({
					encounterId: id, kind, groupIndex, index, name: targetName ?? '',
					portrait: num(target, 'portrait'),
					num: num(target, 'num'),
				});

				for (const rawPart of arr(target, 'parts')) {
					const part = obj(rawPart);
					const partId = part['partId'] === undefined ? null : String(part['partId']);
					const partName = str(part, 'name');
					if (partId === null || partName === null) continue;
					// hp 는 {base, level} 이 보통이지만 숫자만 있는 경우도 있다
					const hpRaw = part['hp'];
					const hp = obj(hpRaw);
					const hpFlat = typeof hpRaw === 'number' ? hpRaw : null;
					const speed = arr(part, 'speed');
					t.encounterTargetPart.push({
						encounterId: id, kind, groupIndex, targetIndex: index, partId, name: partName,
						hpBase: num(hp, 'base') ?? hpFlat, hpLevel: num(hp, 'level'),
						defCorrection: num(part, 'defCorrection'),
						speedMin: speed.length === 2 ? Number(speed[0]) : null,
						speedMax: speed.length === 2 ? Number(speed[1]) : null,
					});
					const resists = obj(part['resists']);
					for (const axis of AXES) {
						const value = num(resists, axis);
						if (value === null) continue;
						t.encounterPartResist.push({
							encounterId: id, kind, groupIndex, targetIndex: index, partId, axis, value,
						});
					}
				}
			});
		};

		pushTargets('top', 0, arr(e, 'targets'));
		arr(e, 'waves').forEach((w, i) => pushTargets('wave', i, arr(obj(w), 'targets')));
		arr(e, 'phases').forEach((p, i) => pushTargets('phase', i, arr(obj(p), 'targets')));
		// **battle 안에 다시 waves·phases 가 들어간다**(md__canto-1-2 의 Golden Apple).
		// 중첩된 것도 같은 battle 의 내용이므로 groupIndex 를 그대로 이어 쓴다 —
		// 그래야 「이 보스 후보의 전체 등장 적」이 한 groupIndex 로 모인다.
		arr(e, 'battles').forEach((b, i) => {
			const battle = obj(b);
			pushTargets('battle', i, arr(battle, 'targets'));
			for (const w of arr(battle, 'waves')) pushTargets('battle', i, arr(obj(w), 'targets'));
			for (const p of arr(battle, 'phases')) pushTargets('battle', i, arr(obj(p), 'targets'));
		});
	}

	// ── 팩 보스 조우 — 팩 계열에서 미룬 연결 ────────────────────
	// bossEncounters 는 "md|canto-1-1" 꼴이고 파일명은 "md__canto-1-1" 이다.
	const encounterIds = new Set(t.encounter.map((e) => e.id));
	for (const [packId, p] of input.packs) {
		if (!input.knownPacks.has(packId)) continue;
		let dropped = 0;
		for (const raw of arr(p, 'bossEncounters')) {
			if (typeof raw !== 'string') continue;
			const encounterId = raw.replace('|', '__');
			if (!encounterIds.has(encounterId)) {
				dropped += 1;
				continue;
			}
			t.packBossEncounter.push({ packId, encounterId });
		}
		if (dropped > 0) {
			meta.gap('pack', packId, 'bossEncounters', `조우 목록에 없는 이름표 ${dropped}건`, EVIDENCE);
		}
	}

	// ── 적 표시명 — loc 단독. desc 가 부위 이름이다 ──────────────
	const enemyLoc: Record<Loc, RawIndex> = {
		ko: input.enemyKo, en: input.enemyEn, ja: input.enemyJa,
	};
	const enemyIds = new Set<string>();
	for (const locale of LOCALES) for (const id of enemyLoc[locale].keys()) enemyIds.add(id);
	for (const id of [...enemyIds].sort()) {
		t.enemy.push({ id });
		for (const locale of LOCALES) {
			const o = enemyLoc[locale].get(id);
			const name = str(o ?? {}, 'name');
			if (name === null) {
				meta.gap('enemy', id, 'name', `${locale} 표시명이 없다`, EVIDENCE, locale);
				continue;
			}
			t.enemyText.push({ enemyId: id, locale, name, roleLabel: str(o ?? {}, 'desc') });
		}
		meta.source('enemy', id, 'name', 'loc-only', [LOC]);
	}

	// 전투 풀 2,525종은 여전히 못 잇는다 — backlog/10
	meta.gap(
		'encounter', '*', 'battlePool',
		'mj packs_detail 의 전투 풀 2,525종과 assets 조우 251개를 잇는 표가 리포에 없다',
		'docs/backlog/10-encounter-linkage.md',
	);

	return t;
}
