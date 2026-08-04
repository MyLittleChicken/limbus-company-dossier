/**
 * 메카닉 축과 트리거·효과의 참조 유도.
 *
 * `trigger` 와 `effect` 는 id 하나뿐인 통제 어휘 라벨이다 — 무엇을 참조하는지가
 * 테이블에 없다. 이름으로 유도하되 **오매칭이 실재한다.** 적재 시 한 번 풀어
 * 굳히고, 질의는 그 결과만 읽는다.
 *
 * 설계 docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md';

/** 트리거가 참조하는 8축. keyword 7 + BULLET */
const AXIS_IDS = [
	'COMBUSTION', 'LACERATION', 'VIBRATION', 'BURST',
	'SINKING', 'BREATH', 'CHARGE', 'BULLET',
] as const;

/**
 * 이름 매칭이 못 푸는 것. **표로 둔다.**
 *   Bloodfiend  소속이 아니라 unit_keyword 다
 *   Yurodivy    소속은 YURODIVY 인데 표시명이 'Yurodiviye' 라 안 붙는다
 */
const TRIGGER_EXCEPTION: Record<string, { refKind: string; refId: string }> = {
	'Bloodfiend Identities': { refKind: 'unit_keyword', refId: 'BLOODFIEND' },
	'Yurodivy Identities': { refKind: 'association', refId: 'YURODIVY' },
};

const ATTACK_TYPES = ['slash', 'pierce', 'blunt'] as const;
const SKILL_KINDS = ['counter', 'guard', 'evade'] as const;

export interface AxisInput {
	statusCategory: Array<{ statusId: string; category: string }>;
	statusTextEn: Array<{ statusId: string; name: string }>;
	associationTextEn: Array<{ associationId: string; name: string }>;
	triggerIds: string[];
	effectIds: string[];
	unitKeywords: string[];
	sinIds: string[];
}

/**
 * `refId` 는 nullable 이 아니다 — Task 1 스키마의 실제 정의를 따른다.
 *
 * 브리프는 `refId: string | null` 로 적었으나 `@@id([triggerId, refKind, refId])`
 * 에 refId 가 nullable 이면 Prisma 가 P1012 로 거부한다. `@@unique` 로 우회하면
 * PostgreSQL 이 NULL 을 서로 다르게 봐(NULLS DISTINCT) 중복이 뚫린다 — `refKind='none'`
 * 행이 39건 이상 나올 예정이라 실질적 구멍이었다. 그래서 실제 스키마는
 * `refId String @default("")` 다. 「참조 대상 없음」은 `null` 이 아니라 빈 문자열 `''` 이다.
 * (선례: `model FieldGap` 의 `locale String @default("")` — 로케일 무관이면 빈 문자열)
 */
export interface AxisTables {
	axis: Array<{ id: string; kind: string; note: string | null }>;
	triggerRef: Array<{
		triggerId: string; refKind: string; refId: string;
		resonanceMode: string | null; threshold: number | null; evaluability: string;
	}>;
	effectRef: Array<{ effectId: string; refKind: string; refId: string; mode: string }>;
}

/**
 * 트리거·효과 이름이 어느 축을 가리키나.
 *
 * **최장일치하되 축이 없으면 짧은 매칭으로 내려간다.** `Trigger Tremor Burst` 는
 * 최장일치하면 `Tremor Burst`(VibrationExplosion)에 걸리는데 그것은
 * VIBRATION_CONVERTED 라 축이 아니다. `Tremor`(Vibration) → VIBRATION 이 정답이다.
 */
function axisOf(
	name: string,
	statusToAxis: Map<string, string>,
	enToStatus: Array<{ en: string; statusId: string }>,
): string | null {
	const hits = enToStatus
		.filter((x) => name.includes(x.en))
		.sort((a, b) => b.en.length - a.en.length);
	for (const h of hits) {
		const axis = statusToAxis.get(h.statusId);
		if (axis !== undefined) return axis;
	}
	return null;
}

/** `… Skill` · `… Identities` 는 편성만으로 확정된다 */
function evaluabilityOf(id: string): string {
	if (id === 'Always') return 'always';
	if (id === 'Other Uncommon Triggers') return 'unclassified';
	if (id.endsWith(' Identities') || id.endsWith(' Skill')) return 'roster';
	// **편성이 가능성을 정하고 런타임이 발생을 정한다.** 분노 스킬이 없는 편성에서는
	// 영원히 안 켜지고, 있으면 언젠가 켜진다. roster 도 runtime 도 아니다
	if (id.endsWith('Skill Used') || id.endsWith('Resonance') || id === 'Deployment Position') {
		return 'roster_gated';
	}
	return 'runtime';
}

export function buildAxis(input: AxisInput, meta: Meta): AxisTables {
	const t: AxisTables = { axis: [], triggerRef: [], effectRef: [] };

	// ── 축 어휘 ────────────────────────────────────────────────
	// status_category 의 카테고리 중 **트리거가 참조하는 8종만** 축이다.
	// 주살(BURSTREACTIVE) · 마탄(FREISHUTZ…) · 원호 방어 등은 트리거가 하나도
	// 참조하지 않으므로 축이 아니다
	const present = new Set(input.statusCategory.map((s) => s.category));
	for (const id of AXIS_IDS) {
		if (!present.has(id)) continue;
		t.axis.push({
			id,
			kind: id === 'BULLET' ? 'bullet' : 'status_keyword',
			note: id === 'BULLET'
				? '마탄 7종(FREISHUTZ_OUTIS_EGO_BULLET)은 BULLET 태그가 없다. 게임이 그렇게 묶지 않았다 — 판정 보류'
				: null,
		});
	}

	const statusToAxis = new Map<string, string>();
	for (const s of input.statusCategory) {
		if ((AXIS_IDS as readonly string[]).includes(s.category)) statusToAxis.set(s.statusId, s.category);
	}
	const enToStatus = input.statusTextEn
		.filter((s) => s.name.length > 0)
		.map((s) => ({ en: s.name, statusId: s.statusId }));

	// 소속 이름 → id. 'Liu Association' 과 'Liu Assoc.' 둘 다 받는다
	const assocByName = new Map<string, string>();
	for (const a of input.associationTextEn) {
		assocByName.set(a.name, a.associationId);
		assocByName.set(a.name.replace('Association', 'Assoc.'), a.associationId);
	}

	const sins = new Set(input.sinIds);

	// ── 트리거 참조 ────────────────────────────────────────────
	for (const id of input.triggerIds) {
		const evaluability = evaluabilityOf(id);
		const push = (refKind: string, refId: string,
		              resonanceMode: string | null = null, threshold: number | null = null) => {
			t.triggerRef.push({ triggerId: id, refKind, refId, resonanceMode, threshold, evaluability });
		};

		// 1) 예외 표가 먼저다
		const exc = TRIGGER_EXCEPTION[id];
		if (exc !== undefined) { push(exc.refKind, exc.refId); continue; }

		// 2) **소속이 상태 이름보다 우선한다.** 'Dawn Office Identities' 가
		//    DawnTeam(Dawn Office) 상태에 걸리는 오매칭을 막는다
		if (id.endsWith(' Identities')) {
			const bare = id.slice(0, -' Identities'.length);
			const assoc = assocByName.get(bare);
			if (assoc !== undefined) { push('association', assoc); continue; }
			meta.gap('trigger', id, 'ref', '소속 이름과 매칭되지 않는다', EVIDENCE);
			push('none', '');
			continue;
		}

		// 3) 공명은 죄악과 다른 갈래다. absolute 를 mode 로 담는다
		if (id.endsWith('Resonance')) {
			const sin = [...sins].find((s) => id.toLowerCase().startsWith(s));
			push('resonance', sin ?? '', id.includes('Absolute') ? 'absolute' : 'activate');
			continue;
		}

		// 4) 축
		const axis = axisOf(id, statusToAxis, enToStatus);
		if (axis !== null) { push('axis', axis); continue; }

		// 5) 죄악 · 공격 타입 · 스킬 종류 · 코인
		const sin = [...sins].find((s) => id.toLowerCase().includes(s));
		if (sin !== undefined) { push('sin', sin); continue; }
		const atk = ATTACK_TYPES.find((a) => id.toLowerCase().includes(a));
		if (atk !== undefined) { push('attack_type', atk); continue; }
		const kind = SKILL_KINDS.find((k) => id.toLowerCase().includes(k));
		if (kind !== undefined) { push('skill_kind', kind); continue; }
		if (id.includes('Coin')) { push('coin', ''); continue; }
		if (id === 'Deployment Position') { push('deployment', ''); continue; }

		// 6) **말없이 버리지 않는다.** none 으로 명시 기록한다
		push('none', '');
	}

	// ── 효과 참조 ──────────────────────────────────────────────
	for (const id of input.effectIds) {
		const mode = id.startsWith('Inflict') ? 'inflict'
			: id.startsWith('Gain') || id.startsWith('Generate') ? 'gain'
			: id.startsWith('Consume') ? 'consume'
			: id.startsWith('Trigger') ? 'trigger'
			: 'gain';
		const axis = axisOf(id, statusToAxis, enToStatus);
		if (axis !== null) { t.effectRef.push({ effectId: id, refKind: 'axis', refId: axis, mode }); continue; }
		const sin = [...sins].find((s) => id.toLowerCase().includes(s));
		if (sin !== undefined) { t.effectRef.push({ effectId: id, refKind: 'sin', refId: sin, mode }); continue; }
		const atk = ATTACK_TYPES.find((a) => id.toLowerCase().includes(a));
		if (atk !== undefined) { t.effectRef.push({ effectId: id, refKind: 'attack_type', refId: atk, mode }); continue; }
		t.effectRef.push({ effectId: id, refKind: 'none', refId: '', mode });
	}

	return t;
}
