/**
 * 기프트 능력 저작 payload — 타입과 형식 검사.
 *
 * 저작 파일(`data/authored/gift-ability.jsonl`)은 사람이 손으로 고친다.
 * 형식이 틀어진 채 DB 로 들어가면 굽는 쪽에서 뒤늦게 터지므로 여기서 막는다.
 *
 * **DB 를 안 본다.** 참조가 실재하는지(`refId` 가 진짜 소속인지)는 여기서
 * 안 보고 `unknownRefs`(authored.ts)가 굽기 직전에 본다 — `schema-ops.ts` 와
 * 같은 갈래다.
 */

/** 세는 모집단. 거울 던전은 편성 12인 · 출격 7인 · 대기 5인이다 */
export const SCOPES = ['field', 'roster', 'waiting', 'slot', 'enemy', 'none'] as const;
/** 공급을 어디서 세는가. skill 은 coin_token, tag 는 identity_axis */
export const SUPPLIES = ['skill', 'tag', 'any'] as const;
export const OPS = ['gte', 'eq', 'has'] as const;
/** 발동 시점. 닫힌 집합이다 — 밖의 것이 나오면 'other' 로 두고 결손을 남긴다 */
export const TIMINGS = [
	'combat_start', 'turn_start', 'turn_end', 'on_use', 'on_hit',
	'on_kill', 'on_clash', 'floor_start', 'none', 'other',
] as const;
/** 출격이 7인이므로 자리는 7번까지 있다 — 9759 불 꺼진 랜턴이 「편성 7번」이다 */
export const MAX_SLOT = 7;

export interface AbilityCond {
	group: number;
	idx: number;
	refKind: string;
	refId: string;
	op: (typeof OPS)[number];
	/** 문장에 없으면 null. **1 로 가정하지 않는다** */
	threshold: number | null;
	scope: (typeof SCOPES)[number];
	supply: (typeof SUPPLIES)[number];
	slot: number | null;
	/** 전투 중에만 아는가. 참이면 편성만 보고 배제할 수 없다 */
	runtime: boolean;
	/** activate(일반 공명) · absolute(완전 공명). resonance 조건에만 붙는다 */
	resonanceMode: string | null;
}

export interface AbilityPayload {
	timing: string;
	/**
	 * 조건 없이 도는가.
	 *
	 * 참이면 `conds` 가 반드시 비어 있다. **거짓인데 비어 있으면 결손이다** —
	 * 조건이 있는 줄은 아는데 못 뽑은 자리이고, 굽는 쪽이 `field_gap` 을 남긴다.
	 * 두 경우가 같은 모양이 되지 않게 이 칸을 따로 둔다.
	 */
	unconditional: boolean;
	/**
	 * 다른 능력의 강화판인가. 그 능력의 ordinal, 독립이면 null.
	 *
	 * **「- N인 이상」 티어는 여기 안 쓴다.** 티어는 원 능력과 독립으로 켜지고
	 * 꺼지므로 독립 능력이다. 데스페라도(9235)가 그 증거다 — 기본 절이 아예
	 * 없고 최저 티어가 2인이라 원 능력이라 부를 것이 없다. `refines` 는
	 * 「효과가 강화되어」처럼 앞 절의 결과를 전제하는 것에만 쓴다.
	 */
	refines: number | null;
	/** 설명문에서 이 능력에 해당하는 문단 원문. 검수와 재현의 근거다 */
	sourceText: string;
	conds: AbilityCond[];
}

const has = <T extends readonly string[]>(pool: T, v: string): boolean =>
	(pool as readonly string[]).includes(v);

/** 형식 문제를 사람 말로 낸다. 빈 배열이면 통과다 */
export function validatePayload(p: AbilityPayload): string[] {
	const out: string[] = [];

	if (!has(TIMINGS, p.timing)) out.push(`timing 이 어휘에 없다: ${p.timing}`);
	if (p.unconditional && p.conds.length > 0) {
		out.push(`unconditional=true 인데 조건이 ${p.conds.length}개 있다`);
	}
	if (p.sourceText.trim() === '') out.push('sourceText 가 비어 있다 — 근거 없이 굽지 않는다');

	for (const c of p.conds) {
		const at = `조건 ${c.group}/${c.idx}`;
		if (!has(OPS, c.op)) out.push(`${at} 의 op 가 어휘에 없다: ${c.op}`);
		if (!has(SCOPES, c.scope)) out.push(`${at} 의 scope 가 어휘에 없다: ${c.scope}`);
		if (!has(SUPPLIES, c.supply)) out.push(`${at} 의 supply 가 어휘에 없다: ${c.supply}`);
		if (c.threshold !== null && c.threshold < 1) {
			out.push(`${at} 의 threshold 가 1 미만이다: ${c.threshold}`);
		}
		if (c.scope === 'slot') {
			if (c.slot === null || c.slot < 1 || c.slot > MAX_SLOT) {
				out.push(`${at} 의 slot 이 1~${MAX_SLOT} 이 아니다: ${c.slot}`);
			}
		} else if (c.slot !== null) {
			out.push(`${at} 은 scope='slot' 이 아닌데 slot 이 있다: ${c.slot}`);
		}
		if (c.supply === 'skill' && c.refKind !== 'axis') {
			out.push(`${at} 은 supply='skill' 인데 refKind 가 axis 가 아니다: ${c.refKind}`);
		}
		if (c.resonanceMode !== null && c.refKind !== 'resonance') {
			out.push(`${at} 은 refKind 가 resonance 가 아닌데 resonanceMode 가 있다: ${c.resonanceMode}`);
		}
	}

	/** group 과 idx 가 0 부터 빈틈없이 이어지는가 — 빈틈은 뽑다 만 흔적이다 */
	const groups = new Map<number, number[]>();
	for (const c of p.conds) groups.set(c.group, [...(groups.get(c.group) ?? []), c.idx]);
	const gNums = [...groups.keys()].sort((a, b) => a - b);
	for (let i = 0; i < gNums.length; i += 1) {
		if (gNums[i] !== i) {
			out.push(`group 이 0..${gNums.length - 1} 로 이어지지 않는다: ${gNums.join(',')}`);
			break;
		}
	}
	for (const [g, idxs] of [...groups].sort((a, b) => a[0] - b[0])) {
		const sorted = [...idxs].sort((a, b) => a - b);
		if (sorted.some((v, i) => v !== i)) {
			out.push(`group ${g} 의 idx 가 0..${sorted.length - 1} 로 이어지지 않는다: ${sorted.join(',')}`);
		}
	}

	return out;
}
