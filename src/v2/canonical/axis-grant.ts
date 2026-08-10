/**
 * 축 부여·제한을 인격 행으로 편다.
 *
 * 저작 `app.axis_grant` 17행이 정본이다. 여기서 하는 일은 **펴기와 제한 적용**
 * 뿐이다 — 무엇이 조건인지는 저작이 정한다(ADR-08 「규칙은 코드 · 사실은 데이터」).
 *
 * **제한은 여기서 이미 적용한다.** `identity_axis` 를 읽는 쪽이 교집합을 다시
 * 취하지 않아도 옳게 만든다. 게임이 「이 인격은 화상, 진동을 부여하는 인격으로만
 * 취급됨」(1091603)이라 말하면 그 인격의 축은 둘뿐이다.
 */
import type { Meta } from './meta.js';
import type { AxisGrantRow } from '../authored.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-axis-grant-design.md';

export interface AxisGrantInput {
	axisGrant: AxisGrantRow[];
	axisIds: string[];
	identityIds: string[];
	identityAssociation: Array<{ identityId: string; associationId: string }>;
	identityUnitKeyword: Array<{ identityId: string; keyword: string }>;
}

export interface GrantedAxisRow {
	identityId: string;
	axisId: string;
	affects: string;
	gateKind: string;
	gateRef: string;
	gateMin: number | null;
}

export interface AxisRestrictRow {
	identityId: string;
	axisId: string;
	affects: string;
	sourceId: string;
}

/**
 * 저작 한 행이 어느 인격들에 걸리는가.
 *
 * **대상과 조건은 다른 칸이다.** 2050911 은 「[검계 우두머리 뫼르소 전용 상시
 * 효과] … 이 인격은 출혈, 호흡을 부여하는 인격으로 취급됨」이라 말한다 —
 * 대상은 10508 하나이고, 조건은 「20509 를 장착했는가」다. 폐기하는
 * `app.ego_granted_axis` 는 이 둘을 구별하지 못해 E.G.O 수감자의 인격 전부로
 * 폈고 62행 중 58행이 과대였다.
 *
 * 그래서 `targetKind='self'` 이면 `targetId` 가 반드시 있어야 한다. 비어 있으면
 * 대상을 정할 수 없으므로 결손으로 남기고 버린다.
 */
function targetsOf(g: AxisGrantRow, input: AxisGrantInput, meta: Meta): string[] {
	if (g.targetKind === 'association') {
		return input.identityAssociation
			.filter((a) => a.associationId === g.targetId)
			.map((a) => a.identityId);
	}
	if (g.targetKind === 'unit_keyword') {
		return input.identityUnitKeyword
			.filter((k) => k.keyword === g.targetId)
			.map((k) => k.identityId);
	}
	if (g.targetId === '') {
		meta.gap('axis_grant', g.id, 'target_id',
			"target_kind='self' 인데 target_id 가 비었다 — 대상을 정할 수 없다", EVIDENCE);
		return [];
	}
	return [g.targetId];
}

export function buildAxisGrant(
	input: AxisGrantInput,
	meta: Meta,
): { granted: GrantedAxisRow[]; restrict: AxisRestrictRow[] } {
	const axes = new Set(input.axisIds);
	const ids = new Set(input.identityIds);
	const granted: GrantedAxisRow[] = [];
	const restrict: AxisRestrictRow[] = [];

	for (const g of input.axisGrant) {
		if (!axes.has(g.axisId)) {
			meta.gap('axis_grant', g.id, 'axis_id', `축 '${g.axisId}' 가 canonical 에 없다`, EVIDENCE);
			continue;
		}
		const targets = targetsOf(g, input, meta).filter((id) => {
			if (ids.has(id)) return true;
			meta.gap('axis_grant', g.id, 'target_id', `인격 '${id}' 가 canonical 에 없다`, EVIDENCE);
			return false;
		});
		if (targets.length === 0 && g.targetKind !== 'self') {
			meta.gap('axis_grant', g.id, 'target_id',
				`${g.targetKind} '${g.targetId}' 에 속한 인격이 하나도 없다`, EVIDENCE);
		}
		for (const identityId of targets) {
			if (g.mode === 'restrict') {
				restrict.push({ identityId, axisId: g.axisId, affects: g.affects, sourceId: g.sourceId });
			} else {
				granted.push({
					identityId, axisId: g.axisId, affects: g.affects,
					gateKind: g.gateKind, gateRef: g.gateRef, gateMin: g.gateMin,
				});
			}
		}
	}

	return { granted: applyRestrict(granted, restrict), restrict };
}

/**
 * 제한을 부여에 건다.
 *
 * 제한이 있는 인격은 그 축들만 남는다. `affects` 가 겹칠 때만 건다 —
 * 태그 제한이 스킬 부여를 지우지 않는다.
 */
export function applyRestrict(
	granted: GrantedAxisRow[],
	restrict: AxisRestrictRow[],
): GrantedAxisRow[] {
	if (restrict.length === 0) return granted;
	/** 인격 → 그 인격이 남길 수 있는 축 (affects 별) */
	const allow = new Map<string, Set<string>>();
	for (const r of restrict) {
		for (const a of expand(r.affects)) {
			const key = `${r.identityId}|${a}`;
			const set = allow.get(key);
			if (set === undefined) allow.set(key, new Set([r.axisId]));
			else set.add(r.axisId);
		}
	}
	/**
	 * `.some()` 으로는 안 된다. `affects='both'` 인 부여가 한 채널만 막혔을 때
	 * `.some()` 은 다른 채널이 살아 있다는 이유로 원본을 통째로 살려 막힌
	 * 채널로 새어나간다. 채널별로 통과 여부를 따로 보고, 일부만 살아남으면
	 * `affects` 를 살아남은 채널로 좁힌다.
	 */
	const out: GrantedAxisRow[] = [];
	for (const g of granted) {
		const channels = expand(g.affects);
		const survived = channels.filter((a) => {
			const set = allow.get(`${g.identityId}|${a}`);
			return set === undefined || set.has(g.axisId);
		});
		if (survived.length === 0) continue;
		if (survived.length === channels.length) {
			out.push(g);
		} else {
			out.push({ ...g, affects: survived[0] ?? g.affects });
		}
	}
	return out;
}

/** both 는 tag 와 skill 둘 다를 뜻한다 */
export function expand(affects: string): string[] {
	return affects === 'both' ? ['tag', 'skill'] : [affects];
}
