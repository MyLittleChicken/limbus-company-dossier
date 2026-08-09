/**
 * 설계 16절 1·2단계 — 편성에서 갈래별 인원을 센다.
 *
 * **조건부 축을 여기서 가른다.** `identity_axis` 의 `ego_granted` 행은 그 E.G.O 를
 * 실제로 장착했을 때만 유효하다. 안 거르면 착영휘도를 안 낀 이상까지 출혈
 * 인격이 된다 — 편성 12에 이상이 있으면 거의 항상 새는 자리다.
 *
 * **분모가 셋이다.** 세는 모집단이 갈린다.
 *   roster   편성 전체
 *   field    출전만.  기프트 49건이 여기다 — 편성으로 세면 과대 판정이 된다
 *   waiting  편성에서 출전을 뺀 자리.  9778 통상 작전용 장비 하나뿐이다
 */
import type { Capability, Squad } from './types.js';

/** 분모별 인격 집합. 셋을 미리 갈라 두면 판정이 조회 한 번이다 */
export interface Denominators {
	roster: Set<string>;
	field: Set<string>;
	waiting: Set<string>;
}

export function denominatorsOf(squad: Squad): Denominators {
	const roster = new Set(squad.roster.map((r) => r.identityId));
	// 편성에 없는 출전은 무시한다 — 입력이 어긋나도 분모가 편성보다 커지면 안 된다
	const field = new Set(squad.field.filter((id) => roster.has(id)));
	const waiting = new Set([...roster].filter((id) => !field.has(id)));
	return { roster, field, waiting };
}

/**
 * 이 편성에서 실제로 유효한 능력만 남긴다.
 *
 * 무조건 능력(`egoId === ''`)은 그대로 두고, 조건부는 **그 인격이 그 E.G.O 를
 * 장착했을 때만** 남긴다. 다른 인격이 같은 E.G.O 를 꼈다고 옮겨붙지 않는다.
 */
export function activeCapabilities(squad: Squad, all: Capability[]): Capability[] {
	const equipped = new Map<string, Set<string>>();
	for (const r of squad.roster) equipped.set(r.identityId, new Set(r.egoIds));

	return all.filter((c) => {
		const egos = equipped.get(c.identityId);
		if (egos === undefined) return false;
		return c.egoId === '' || egos.has(c.egoId);
	});
}

/**
 * 갈래별 인원 — `(refKind, refId, 분모)` → 인격 수.
 *
 * 세 분모를 한 번에 센다. 같은 참조를 분모만 바꿔 두 번 조회하는 기프트가 있어서다.
 */
export class Profile {
	private readonly counts = new Map<string, Set<string>>();
	/**
	 * 자리 번호 → 인격 id. **출전 순서가 곧 자리 번호다.**
	 *
	 * 거울 던전은 편성과 전투 순서까지 정하고 진입하므로(설계 2.4) 「1번 인격」은
	 * 추측이 아니라 확정이다. `Squad.field` 가 그 순서를 담고 있다.
	 */
	private readonly bySlot: string[];

	constructor(squad: Squad, capabilities: Capability[]) {
		this.bySlot = [...squad.field];
		const denom = denominatorsOf(squad);
		const active = activeCapabilities(squad, capabilities);
		for (const c of active) {
			for (const [name, members] of Object.entries(denom)) {
				if (!(members as Set<string>).has(c.identityId)) continue;
				const key = `${c.refKind}|${c.refId}|${name}`;
				const seen = this.counts.get(key);
				if (seen === undefined) this.counts.set(key, new Set([c.identityId]));
				else seen.add(c.identityId);
			}
		}
	}

	/** 분모 기본값은 `field` 다 — 실측 49/59 가 출전이고 그것이 게임의 기본이다 */
	count(refKind: string, refId: string, denominator = 'field'): number {
		return this.counts.get(`${refKind}|${refId}|${denominator}`)?.size ?? 0;
	}

	/**
	 * 이 자리들에 있는 인격 중 몇이 이 갈래를 공급하나.
	 *
	 * **「파열 인격이 있나」가 아니라 「1·2번 자리가 파열을 주나」를 묻는다.**
	 * 죽음바라기의 「[편성 1번, 2번 인격 전용 효과]」가 그 조건이고, 전체로는
	 * 공급되는데 그 자리에는 없는 덱에서 켜진다고 판정하는 사고를 막는다.
	 *
	 * 편성보다 큰 자리 번호는 없는 자리다 — 지어내지 않고 뺀다.
	 */
	countInSlots(refKind: string, refId: string, slots: readonly number[]): number {
		const members = this.counts.get(`${refKind}|${refId}|field`);
		if (members === undefined) return 0;
		let n = 0;
		for (const s of slots) {
			const id = this.bySlot[s - 1];
			if (id !== undefined && members.has(id)) n += 1;
		}
		return n;
	}
}
