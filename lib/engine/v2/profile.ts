/**
 * 설계 16절 1·2단계 — 편성에서 갈래별 인원을 센다.
 *
 * **게이트를 두 단계로 평가한다.** `identity_axis` 의 행은 조건 없이(`always`)
 * 붙기도 하고, E.G.O 장착·기프트 보유·편성 인원·전투 중 상태 같은 조건이
 * 붙기도 한다(`gate_kind`). `roster_count` 게이트는 「그 소속 인격이 편성에
 * N명 이상인가」를 묻는데 그 인원 자체가 조건 없는 능력에서 나오므로, 조건
 * 없는 것을 먼저 세고 그 수로 조건부를 판정해야 한다. 자세한 사정은
 * `activeCapabilities` 주석에 있다.
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
 * 게이트를 평가해 살아 있는 능력만 남긴다.
 *
 * **두 단계로 돈다.** `roster_count` 게이트가 「그 소속 인격이 편성에 N명
 * 이상인가」를 묻는데, 그 인원은 조건 없는 능력에서 나온다. 그래서 조건 없는
 * 것을 먼저 세고, 그 수를 근거로 조건부를 판정한다.
 *
 * `status_held` 는 전투 중에만 아는 조건이다(2026-08-10, 사용자 확정으로 되살림).
 * 거울 던전 추적은 편성과 기프트 선택까지를 다루고 전투 안을 보지 않으므로,
 * 이 조건은 **판정 범위 밖**이다. 범위 밖의 조건을 「아니다」로 읽으면 실제로는
 * 켜지는 것을 죽인다 — `threshold` 가 없을 때 배제하지 않는 것과 같은 원칙이라
 * `open()` 은 `status_held` 를 **연다**(`true`). 어휘에 없는 게이트(`default`)는
 * 계속 닫는다 — 모르는 값이 조용히 통과하면 과대 판정이 된다.
 */
export function activeCapabilities(
	squad: Squad,
	capabilities: Capability[],
	heldGiftIds: string[] = [],
): Capability[] {
	const inSquad = new Set(squad.roster.map((r) => r.identityId));
	const equipped = new Map<string, Set<string>>();
	for (const r of squad.roster) equipped.set(r.identityId, new Set(r.egoIds));
	const held = new Set(heldGiftIds);

	const unconditional = capabilities.filter(
		(c) => inSquad.has(c.identityId) && c.gateKind === 'always',
	);

	/** 1단계 — 조건 없는 것으로 (refKind, refId) 별 편성 인원을 센다 */
	const tally = new Map<string, Set<string>>();
	for (const c of unconditional) {
		const key = `${c.refKind}\t${c.refId}`;
		const set = tally.get(key);
		if (set === undefined) tally.set(key, new Set([c.identityId]));
		else set.add(c.identityId);
	}
	const rosterCount = (refId: string): number =>
		tally.get(`association\t${refId}`)?.size ?? 0;

	/** 2단계 — 게이트를 판정한다 */
	const open = (c: Capability): boolean => {
		switch (c.gateKind) {
			case 'always': return true;
			case 'ego_equipped': return equipped.get(c.identityId)?.has(c.gateRef) === true;
			case 'gift_held': return held.has(c.gateRef);
			case 'roster_count': return rosterCount(c.gateRef) >= (c.gateMin ?? 1);
			// 전투 중에만 아는 상태다. 거울 던전 추적은 편성·기프트 선택까지만 다루고
			// 전투 안을 보지 않으므로 이 조건은 판정 범위 밖이다. 범위 밖을 「아니다」로
			// 읽으면 실제로는 켜지는 것을 죽인다 — threshold 가 없을 때 배제하지 않는
			// 것과 같은 원칙이라 배제 근거로 쓰지 않는다(연다)
			case 'status_held': return true;
			// 모르는 게이트는 켜지 않는다 — 조용히 통과시키면 과대 판정이 된다
			default: return false;
		}
	};

	return capabilities.filter((c) => inSquad.has(c.identityId) && open(c));
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

	constructor(squad: Squad, capabilities: Capability[], heldGiftIds: string[] = []) {
		this.bySlot = [...squad.field];
		const denom = denominatorsOf(squad);
		const active = activeCapabilities(squad, capabilities, heldGiftIds);
		/**
		 * **인격 취급(tag)만 센다.** `count`·`countInSlots` 는 「이 축의 인격이
		 * 몇 명인가」를 묻는데, `affects === 'skill'` 인 행은 「그 인격의 스킬이
		 * 이 축을 부여한다」는 뜻이지 「그 인격이 이 축이다」가 아니다. 안 거르면
		 * 10104(개화 E.G.O::동백 이상) 같은 예외가 진동 인격으로 잘못 세인다.
		 * `tag`·`both` 는 세고 `skill` 만은 뺀다. 스킬 취급을 묻는 조회는 이
		 * 클래스의 몫이 아니다 — 기프트 조건에 `supply` 칸이 생기는 다음 PR 이 낸다.
		 */
		const tagLike = active.filter((c) => c.affects === 'tag' || c.affects === 'both');
		for (const c of tagLike) {
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
