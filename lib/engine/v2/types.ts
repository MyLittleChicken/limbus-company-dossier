/**
 * 축 그래프 평가기의 입출력.
 *
 * **레거시 `lib/engine` 과 별개다.** 그쪽은 `public` 스키마의 토큰을 TypeScript
 * 사전(`vocab.ts`)으로 옮기는 저작층이고, 이쪽은 `canonical` 이 이미 구조로 들고
 * 있는 것을 읽기만 한다. 이 파일들에는 게임 지식이 없다 — 있으면 잘못 놓인 것이다.
 *
 * 설계 16절의 평가 흐름을 그대로 옮긴다.
 */

/** 편성 한 자리. E.G.O 는 등급 슬롯별로 여럿 장착한다 */
export interface RosterSlot {
	identityId: string;
	egoIds: string[];
}

/**
 * 편성과 출전.
 *
 * **분모가 둘이라 둘 다 필요하다.** 기프트의 49건이 「대기 인원 제외」라 출전만
 * 세고, 9건은 편성 전체를 센다. 하나만 받으면 절반이 틀린다.
 *
 * `field` 는 **순서가 뜻을 갖는다** — 배치 슬롯 1번부터다.
 */
export interface Squad {
	roster: RosterSlot[];
	/** 출전 인격 id. 편성 순서대로이며 `roster` 의 부분집합이다 */
	field: string[];
}

/** `canonical.v_identity_capability` 한 행 */
export interface Capability {
	identityId: string;
	refKind: string;
	refId: string;
	/** 게이트 종류. always · ego_equipped · gift_held · roster_count · status_held */
	gateKind: string;
	/** 게이트가 보는 값(E.G.O id · 기프트 id · 소속 id …). 무조건이면 빈 문자열 */
	gateRef: string;
	/** roster_count 게이트의 문턱. 그 외는 null */
	gateMin: number | null;
	/**
	 * 이 능력이 어느 취급에 미치나 — tag(인격 취급) · skill(스킬 취급) · both.
	 *
	 * `identity_axis` 만 실제 값을 갖는다. 예: 10104(개화 E.G.O::동백 이상)는
	 * VIBRATION 이 `skill` 이라 「진동 인격 5인」같은 인격 수 조건에는 안 들지만,
	 * 「진동을 부여하는 스킬 사용 시」조건은 받는다. 나머지 갈래는 늘 `both` 다.
	 */
	affects: string;
}

/** `canonical.trigger_ref` 한 행 */
export interface TriggerRef {
	triggerId: string;
	refKind: string;
	refId: string;
	evaluability: string;
}

/** `canonical.gift_trigger_param` 한 행 */
export interface TriggerParam {
	giftId: string;
	triggerId: string;
	kind: string;
	tier: number;
	value: string | null;
	slots: number[];
}

/** 참조 하나의 판정 */
export type RefVerdict = 'satisfied' | 'unsatisfied' | 'unknown';

/**
 * 근거 한 줄. **설계 7단계가 요구하는 것** — 충족한 트리거와 그 갈래를 그대로 낸다.
 *
 * `need` 가 null 이면 임계값이 없어 「하나라도 있으면」으로 본 것이다.
 */
export interface Reason {
	triggerId: string;
	refKind: string;
	refId: string;
	verdict: RefVerdict;
	/**
	 * 충족이 확정인가 가능인가.
	 *
	 * **`roster_gated` 는 필요조건일 뿐이다.** 「화상 스킬 사용 시」는 편성에
	 * 화상 인격이 없으면 절대 안 켜지지만(불충족은 확정), 있다고 반드시 켜지는
	 * 것도 아니다 — 그 턴에 실제로 그 스킬을 써야 한다. 이 둘을 뭉치면
	 * 사용자에게 「켜진다」로 읽혀 과대 판정이 된다.
	 */
	certainty: 'certain' | 'possible';
	have: number;
	need: number | null;
	/** roster | field | waiting. 임계값이 없으면 null */
	denominator: string | null;
}

/**
 * 기프트 하나의 판정.
 *
 * **결합을 접지 않는다(결정 2).** AND 로 가정하면 과소, OR 로 가정하면 과대가 된다.
 * 「5개 중 3개 충족」을 그대로 낸다.
 *
 *   A  참조 전부를 편성으로 판정할 수 있다
 *   B  일부만 판정할 수 있다 — 나머지는 전투 중에 갈린다
 *   C  하나도 판정할 수 없다.  점수에 안 넣되 **목록에는 남긴다**(결정 4)
 */
export interface GiftVerdict {
	giftId: string;
	grade: 'A' | 'B' | 'C';
	/** 판정 가능한 참조 수 */
	decidable: number;
	/** 그중 충족한 수 */
	satisfied: number;
	/** 그중 **확정** 충족한 수. `satisfied` 와 다르면 나머지는 「가능」이다 */
	certain: number;
	/** 전체 참조 수 */
	total: number;
	reasons: Reason[];
	/**
	 * 이 편성에서 켜질 수 있나.
	 *
	 * **하나라도 「미충족·확정」 조건이 있으면 false 다.** 편성에 없는 것은 전투
	 * 중에도 안 생기므로(불충족은 언제나 확정) 그 기프트는 이 편성에서 영영 안 켜진다.
	 *
	 * **이것이 조건 결합 문제의 출구다.** 「셋 중 둘이 맞았다」가 AND 인지 OR 인지는
	 * 데이터가 답하지 않지만(`gift_effect` 와 `gift_trigger` 를 잇는 표가 없다),
	 * 「하나가 확정 불가라 못 켠다」는 결합을 몰라도 참이다.
	 *
	 * **판정 불가(`unknown`)는 false 로 안 만든다** — 모른다와 못 켠다는 다르다.
	 */
	fireable: boolean;
}
