/**
 * 기프트 트리거의 **정량자**.
 *
 * 트리거는 「무엇을 보는가」만 말한다 — `Allies have Burn Skill`. 「몇 명이어야
 * 켜지는가」와 「무엇을 분모로 세는가」는 트리거 어휘에 없다. 진혼(9088)이 그
 * 자리다: 「화상 공격 스킬 보유 인격이 **5인 이상**이면 발동 (**대기 인원 제외**)」.
 *
 * **어느 출처에도 구조화돼 있지 않다.** raw 를 전수로 확인했다 — `limbus-assets`
 * 의 `triggers` 는 라벨 배열이고 `limbus-data-mj` 에는 수치가 없다. 숫자는
 * `gift_stage_text.desc` 산문에만 있으므로 **적재 시점에 한 번 뽑아 구조로 굳힌다.**
 * 질의 시점에 산문을 다시 읽는 일이 없어야 한다.
 *
 *   min_count    「인격이 N인 이상」          70건이 실측된 게이트다
 *   denominator  「대기 인원 제외」 → field   편성 12 로 세면 전부 틀린다
 *   slot         「편성 N번 인격 전용」        gift_requirement.slots 를 트리거에 귄다
 *
 * 뽑은 행은 `source` 로 유도인지 저작인지 남긴다. 못 뽑은 문장은 조용히 버리지
 * 않고 `field_gap` 에 남긴다 — 침묵이 「없다」로 읽히면 안 된다.
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md';

/**
 * 분모 어휘. **실측이다** — 70건에서 이 여섯 말고는 나오지 않았고 한 기프트가
 * 둘을 갖는 경우도 없다.
 *
 *   field    출전.   「출격 인원을 기준으로 함」 20 · 「대기 인원 제외」 40
 *   roster   편성.   「편성 인원을 기준/포함」 4 · 「대기 인원 포함」 2
 *   waiting  대기.   9778 통상 작전용 장비 하나뿐 — 편성에서 출전을 뺀 자리다
 *
 * 「대기 인원에」가 먼저다. 「대기 인원 포함/제외」보다 뒤에 두면 9778 이
 * 엉뚱한 분모를 받는다.
 */
const DENOMINATOR: Array<[RegExp, string]> = [
	[/대기 인원에/, 'waiting'],
	[/출격 인원을 기준/, 'field'],
	[/대기 인원 제외/, 'field'],
	[/편성 인원을 기준/, 'roster'],
	[/편성 인원 포함/, 'roster'],
	[/대기 인원 포함/, 'roster'],
];

/** 「N인 이상」 · 「N명 이상」. 전역이므로 쓸 때마다 lastIndex 를 0 으로 되돌린다 */
const GATE = /(\d+)\s*(?:인|명)\s*이상/g;
/** 게이트 앞 어디까지를 조건 서술로 보는가. 실측 최장이 96자다 */
const CONTEXT = 130;

export interface GiftTriggerParamInput {
	/**
	 * `gift_stage_text` 의 ko · level 0.
	 *
	 * 강화 단계는 대개 조건이 같아 level 0 만으로 충분하다. 다만 456개 전량
	 * 검수(2026-08-11)에서 14건은 단계마다 조건이 다르다고 확인됐다 — 9117 ·
	 * 9138 · 9148 은 편성 자리 범위 자체가 단계별로 바뀐다. 이 회차는 게이트
	 * 판정에 level 0 만 쓰므로 그 14건은 다루지 않는다.
	 */
	giftDesc: Array<{ giftId: string; desc: string }>;
	giftTrigger: Array<{ giftId: string; triggerId: string }>;
	triggerRef: Array<{ triggerId: string; refKind: string; refId: string; evaluability: string }>;
	/** 소속 한글명 → id. 「검계 소속 인격이 3인 이상」을 BLADE_LINEAGE 로 옮긴다 */
	associationKo: Array<{ associationId: string; name: string }>;
	/** `gift_requirement` 의 kind='slots'. 배치 슬롯은 이미 구조로 있다 */
	giftSlots: Array<{ giftId: string; slots: number[] }>;
	axisIds: string[];
	/**
	 * 축이 아닌 브래킷 토큰 중 트리거 참조로 옮겨지는 것. `app.ref_exception`
	 * 에서 온다(ADR-08). **`kind='token'` 만 본다** — 같은 배열을 axis 도 받고
	 * 거기서는 `kind='trigger'` 만 본다.
	 *
	 * 9795 떨어진 한 방울 — 「[BloodDinner]을 소모하는 스킬을 보유한 인격이 3인
	 * 이상」. `BloodDinner` 는 `status_category` 에 없어 축으로 못 닿지만, 이
	 * 기프트의 `Bloodfiend Identities` 트리거가 정확히 그 조건이다.
	 *
	 * **유도로 풀지 않는다** — 상태 이름과 유닛 키워드 이름이 닮았다는 것은
	 * 근거가 아니다.
	 */
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
}

export interface GiftTriggerParamRow {
	giftId: string;
	triggerId: string;
	kind: string;
	tier: number;
	value: string | null;
	slots: number[];
	source: string;
}

/**
 * 게이트 하나가 무엇을 세는지 — 축인가 소속인가.
 *
 * 게이트 **앞쪽**만 본다. 「[Combustion] … 인격이 5인 이상」에서 축은 항상 수
 * 앞에 온다. 둘 다 잡히면 **수에 가까운 쪽**을 쓴다 — 9280 본국검보처럼 한
 * 문장에 소속이 여럿 나오는 경우가 있다.
 */
function subjectOf(
	ctx: string,
	axes: Set<string>,
	assocByName: Map<string, string>,
	tokenExc: Map<string, { refKind: string; refId: string }>,
): { refKind: string; refId: string } | null {
	let best: { refKind: string; refId: string; at: number } | null = null;

	for (const m of ctx.matchAll(/\[(\w+)\]/g)) {
		const id = (m[1] ?? '').toUpperCase();
		const ref = axes.has(id) ? { refKind: 'axis', refId: id } : tokenExc.get(id);
		if (ref === undefined) continue;
		if (best === null || m.index >= best.at) best = { ...ref, at: m.index };
	}
	// **알려진 이름으로 직접 찾는다.** `\S+?\s*소속` 같은 패턴은 「새벽 사무소
	// 소속」의 공백을 못 넘어 「사무소」만 잡는다. 긴 이름이 먼저 걸리도록
	// 정렬해 「중지」가 「중지의 규율」 같은 자리에서 짧게 잘리지 않게 한다
	const names = [...assocByName.keys()].sort((a, b) => b.length - a.length);
	for (const name of names) {
		const needle = `${name} 소속`;
		let at = ctx.indexOf(needle);
		while (at !== -1) {
			if (best === null || at >= best.at) {
				best = { refKind: 'association', refId: assocByName.get(name)!, at };
			}
			at = ctx.indexOf(needle, at + 1);
		}
	}
	if (best === null) return null;
	return { refKind: best.refKind, refId: best.refId };
}

export function buildGiftTriggerParam(
	input: GiftTriggerParamInput,
	meta: Meta,
): GiftTriggerParamRow[] {
	const axes = new Set(input.axisIds);
	const assocByName = new Map(input.associationKo.map((a) => [a.name, a.associationId]));
	// 토큰 예외를 맵으로 굳힌다. subjectOf 가 기프트마다 불리므로 밖에서 한 번만 만든다
	const tokenExc = new Map(
		input.refException
			.filter((e) => e.kind === 'token')
			.map((e) => [e.key, { refKind: e.refKind, refId: e.refId }]),
	);

	const triggersOf = new Map<string, string[]>();
	for (const gt of input.giftTrigger) {
		const list = triggersOf.get(gt.giftId);
		if (list === undefined) triggersOf.set(gt.giftId, [gt.triggerId]);
		else list.push(gt.triggerId);
	}
	const refsOf = new Map<string, Array<{ refKind: string; refId: string; evaluability: string }>>();
	for (const r of input.triggerRef) {
		const list = refsOf.get(r.triggerId);
		const entry = { refKind: r.refKind, refId: r.refId, evaluability: r.evaluability };
		if (list === undefined) refsOf.set(r.triggerId, [entry]);
		else list.push(entry);
	}

	// 게이트를 어느 트리거에 거는가. **roster 를 먼저 본다** — 진혼은
	// `Allies have Burn Skill`(roster) 과 `Burn Skill Used`(roster_gated) 둘을
	// 갖는데 「보유한 인격이 5인」은 편성을 보는 앞엣것의 조건이다.
	// roster 가 없으면 같은 축·소속을 가리키는 아무 트리거나 쓴다 —
	// 9796 애달픈 날숨은 `Allies have Poise`(runtime) 하나뿐이다
	const attribute = (giftId: string, refKind: string, refId: string): string | null => {
		const candidates = (triggersOf.get(giftId) ?? []).filter((t) =>
			(refsOf.get(t) ?? []).some((r) => r.refKind === refKind && r.refId === refId),
		);
		if (candidates.length === 0) return null;
		const roster = candidates.filter((t) =>
			(refsOf.get(t) ?? []).some(
				(r) => r.refKind === refKind && r.refId === refId && r.evaluability === 'roster',
			),
		);
		// 후보가 여럿이면 이름순으로 굳힌다 — 입력 순서에 결과가 흔들리면 안 된다
		return [...(roster.length > 0 ? roster : candidates)].sort()[0] ?? null;
	};

	const rows: GiftTriggerParamRow[] = [];
	const denomSeen = new Set<string>();
	const gateSeen = new Set<string>();

	for (const g of input.giftDesc) {
		GATE.lastIndex = 0;
		const denom = DENOMINATOR.find(([re]) => re.test(g.desc))?.[1] ?? null;
		// 같은 (기프트, 트리거) 안에서 몇 번째 단인가. 9206 은 5인·10인 두 단이다
		const tierOf = new Map<string, number>();

		/**
		 * **게이트는 첫 문단에만 있다.**
		 *
		 * 「턴 시작 시, 검계 소속 인격이 3인 이상일 때 발동」처럼 기프트 전체를
		 * 여는 문은 설명문 맨 앞에 온다. 뒤 문단의 「…4인 이상 있다면」은 그
		 * 문단만 여는 조건이라 기프트를 죽일 근거가 못 된다(9220 · 9270).
		 *
		 * 「발동」이라는 낱말을 함께 본다 — 9778 「…4인 이상이면 공격 레벨 +1」은
		 * 첫 문단이지만 효과 서술이지 여는 문이 아니다.
		 */
		const firstPara = g.desc.split(/\n+/).find((p) => p.trim().length > 0) ?? '';
		// firstPara.length 는 첫 문단 자기 길이일 뿐이다 — desc 가 개행으로 시작해
		// split 이 앞쪽 빈 조각을 건너뛰면 그 오프셋만큼 실제 경계보다 짧게 잡힌다.
		// indexOf 로 desc 안에서의 절대 시작 위치를 구해 더해야 진짜 경계가 나온다
		const start = g.desc.indexOf(firstPara);
		const gateZone = firstPara.includes('발동') ? start + firstPara.length : -1;

		for (const m of g.desc.matchAll(GATE)) {
			const ctx = g.desc.slice(Math.max(0, m.index - CONTEXT), m.index);
			const subject = subjectOf(ctx, axes, assocByName, tokenExc);
			if (subject === null) {
				// 9173 빛바랜 외투 「정신력이 -45인 **적**이 3명 이상」처럼 편성이
				// 아니라 적을 세는 문장이 있다. 이유를 갈라 남긴다 — 「못 정했다」로
				// 뭉치면 실제 결손과 올바른 배제가 구별되지 않는다
				const reason = /적(?:이|을|에게)?\s*$/.test(ctx.trimEnd())
					? `편성이 아니라 적을 센다: ${m[0]}`
					: `게이트의 대상을 못 정했다: ${m[0]}`;
				meta.gap('gift', g.giftId, 'min_count', reason, EVIDENCE);
				continue;
			}
			const triggerId = attribute(g.giftId, subject.refKind, subject.refId);
			if (triggerId === null) {
				// 1xxx·2xxx 스토리 던전 기프트 126종은 출처에 트리거가 아예 없다
				meta.gap('gift', g.giftId, 'min_count',
					`${subject.refKind}:${subject.refId} 를 가리키는 트리거가 없다`, EVIDENCE);
				continue;
			}

			const tier = tierOf.get(triggerId) ?? 0;
			tierOf.set(triggerId, tier + 1);
			rows.push({
				giftId: g.giftId, triggerId, kind: 'min_count', tier,
				value: m[1] ?? null, slots: [], source: 'desc_derived',
			});

			// 첫 문단 안에서 왔고 그 문단이 여는 문이면 게이트다. 엔진은 이 표시가
			// 있는 짝만 발동을 막는다
			const gateKey = `${g.giftId}|${triggerId}`;
			if (m.index < gateZone && !gateSeen.has(gateKey)) {
				gateSeen.add(gateKey);
				rows.push({
					giftId: g.giftId, triggerId, kind: 'gate', tier: 0,
					value: m[1] ?? null, slots: [], source: 'desc_derived',
				});
			}

			// 분모는 (기프트, 트리거) 당 한 행이다. 다단 임계가 분모를 공유한다
			const key = `${g.giftId}|${triggerId}`;
			if (denom !== null && !denomSeen.has(key)) {
				denomSeen.add(key);
				rows.push({
					giftId: g.giftId, triggerId, kind: 'denominator', tier: 0,
					value: denom, slots: [], source: 'desc_derived',
				});
			}
			if (denom === null) {
				meta.gap('gift', g.giftId, 'denominator', '분모 어휘가 문장에 없다', EVIDENCE);
			}
		}
	}

	// ── 배치 슬롯 ──────────────────────────────────────────────
	// `gift_requirement.slots` 는 이미 구조지만 **어느 트리거의 상세인지**를
	// 모른다. `Deployment Position` 이 그 트리거이며 실측 60/60 으로 유일하다
	for (const s of input.giftSlots) {
		if (!(triggersOf.get(s.giftId) ?? []).includes('Deployment Position')) {
			meta.gap('gift', s.giftId, 'slot', 'slots 요건이 있는데 배치 트리거가 없다', EVIDENCE);
			continue;
		}
		rows.push({
			giftId: s.giftId, triggerId: 'Deployment Position', kind: 'slot', tier: 0,
			value: null, slots: s.slots, source: 'requirement',
		});
	}

	// 456개 전량 검수(2026-08-11)가 찾았으나 이 회차가 담지 않는 것. 기프트
	// 능력 PR 의 입력이다
	meta.gap('gift', '*', 'clause_structure',
		'절마다 조건이 다른데 태그가 평면이라 어느 조건이 어느 효과를 켜는지 모른다. ' +
		'편성쪽 게이트를 가진 절 16건을 포함해, 전량 검수가 86건을 「편성으로 판정해야 ' +
		'하는데 못 담는다」로 분류했다', EVIDENCE);
	for (const id of ['9220', '9270']) {
		meta.gap('gift', id, 'clause_gate',
			'문단 단위 게이트다. 첫 문단이 아니라 이 회차의 규칙이 못 가린다. 본 효과는 ' +
			'실제로 켜지므로 「막지 않는다」가 방향은 맞다', EVIDENCE);
	}
	meta.gap('gift', '9052', 'priority_hint',
		'「(스킬을 사용하여 충전 횟수를 획득하는 인격을 우선으로 지정)」은 우선순위 ' +
		'주석인데 조건으로 읽힌다. 이 기프트의 첫 문단은 무조건 효과라 실제로는 항상 켜진다',
		EVIDENCE);
	meta.gap('gift', '9043', 'or_condition',
		'원문이 「분노 완전 공명을 발동하였거나 충전 … 스킬을 사용할 경우」로 OR 인데 ' +
		'태그에 그 정보가 없다', EVIDENCE);

	return rows;
}
