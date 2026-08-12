/**
 * 절 조건의 **공급**을 센다 — 「이 편성에 그것이 몇이나 있나」.
 *
 * **`Profile` 과 따로 둔다.** 그쪽은 `identity_axis` 만 세고 `affects` 게이트를
 * 다룬다. 절 조건은 여덟 갈래를 세야 하고 갈래마다 보는 표가 다르다 — 한
 * 파일에 밀어 넣으면 `Profile` 의 책임이 흐려진다.
 *
 * **DB 를 모른다.** 표를 주입받는 순수 함수라 검사가 DB 없이 돈다.
 */
import type { Squad } from './types.js';

/** refKind 마다 세는 자리가 다르다. 값은 「그것을 가진 인격 id」 집합이다 */
export interface SupplyTables {
	/** 게임이 그 인격을 그 축으로 분류하는가 — identity_axis */
	axisTag: Map<string, Set<string>>;
	/** 스킬이 실제로 그 상태를 주는가 — coin_token */
	axisSkill: Map<string, Set<string>>;
	association: Map<string, Set<string>>;
	/** identity_unit_keyword 다. identity_keyword 가 아니다 — 후자는 축 7종뿐이다 */
	unitKeyword: Map<string, Set<string>>;
	/** sin 과 resonance 가 같이 쓴다. 묻는 것만 다르다 */
	sin: Map<string, Set<string>>;
	attackType: Map<string, Set<string>>;
	skillKind: Map<string, Set<string>>;
	/** 코인 위력이 음수인 스킬을 가진 인격 — skill_stage.coin_value < 0 */
	minusCoin: Set<string>;
}

export interface SupplyCond {
	refKind: string;
	refId: string;
	scope: string;
	supply: string;
	slot: number | null;
}

/** 이 조건이 보는 모집단 */
function poolOf(squad: Squad, scope: string): string[] {
	const roster = squad.roster.map((r) => r.identityId);
	if (scope === 'roster') return roster;
	if (scope === 'waiting') return roster.filter((id) => !squad.field.includes(id));
	return squad.field;
}

/**
 * 몇이 공급하나.
 *
 * **못 세면 `-1` 이다.** 0 과 갈라야 한다 — 0 은 「없다」라 배제 근거가 되고
 * -1 은 「셀 방법이 없다」라 배제하면 안 된다. 둘을 뭉치면 어휘 밖 조건
 * 하나가 기프트를 통째로 죽인다.
 */
export function countSupply(t: SupplyTables, squad: Squad, c: SupplyCond): number {
	if (c.refKind === 'deployment') {
		const n = c.slot ?? Number((/[0-9]+/.exec(c.refId) ?? ['0'])[0]);
		if (n < 1) return -1;
		return squad.field.length >= n ? 1 : 0;
	}

	const pool = poolOf(squad, c.scope);
	const count = (m: Set<string> | undefined): number =>
		m === undefined ? -1 : pool.filter((id) => m.has(id)).length;

	if (c.refKind === 'axis') {
		if (c.supply === 'skill') return count(t.axisSkill.get(c.refId));
		if (c.supply === 'any') {
			const tag = count(t.axisTag.get(c.refId));
			const skill = count(t.axisSkill.get(c.refId));
			return tag < 0 && skill < 0 ? -1 : Math.max(tag, skill);
		}
		return count(t.axisTag.get(c.refId));
	}
	if (c.refKind === 'association') return count(t.association.get(c.refId));
	if (c.refKind === 'unit_keyword') return count(t.unitKeyword.get(c.refId));
	if (c.refKind === 'sin' || c.refKind === 'resonance') return count(t.sin.get(c.refId));
	if (c.refKind === 'attack_type') return count(t.attackType.get(c.refId));
	if (c.refKind === 'skill_kind') return count(t.skillKind.get(c.refId));
	if (c.refKind === 'coin') return c.refId === 'minus' ? count(t.minusCoin) : -1;
	// other · enemy_state 그리고 어휘 밖 — 셀 방법이 없다
	return -1;
}
