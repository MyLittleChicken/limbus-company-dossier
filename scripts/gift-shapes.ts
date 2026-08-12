/**
 * 설명문의 **문형 표지**와 그 문형에 적용할 **절 나누기 규칙**.
 *
 * 456건을 하나씩 판단하지 않기 위한 장치다. 같은 문형이면 같은 규칙으로 절을
 * 나눌 수 있으므로, 검수가 「이 묶음의 규칙이 맞나」 한 번으로 끝난다.
 *
 * **표지는 판단하지 않는다 — 문장에 있는가만 본다.** 그 문형이 어떤 절 구조가
 * 되는지는 `ruleTextOf` 가 말하고, 그것이 맞는지는 사람이 정한다.
 *
 * 묶는 도구(`cluster-gift-shapes.ts`)와 검수 페이지(`build-review-page.ts`)가
 * 같은 정의를 써야 하므로 여기 한 곳에 둔다.
 */

export interface Shape {
	key: string;
	label: string;
	test: (desc: string) => boolean;
	/** 이 표지가 붙으면 절을 어떻게 나누는가 */
	rule: string;
}

const firstPara = (d: string): string => d.split(/\n\s*\n/)[0] ?? '';

export const SHAPES: Shape[] = [
	{
		key: 'GATE', label: '첫 문단이 「…이면 발동」 — 소속·인원 게이트',
		test: (d) => /발동/.test(firstPara(d)) && /이상|이면|일 때/.test(firstPara(d)),
		rule: '첫 문단의 「N인 이상 … 발동」은 <b>그 기프트 전체의 게이트</b>다. ' +
			'뒤 문단들이 전부 이 조건에 딸린다 — 게이트가 안 서면 아무 절도 안 돈다.',
	},
	{
		key: 'TIER', label: '「…수에 따라 기프트 효과 강화」 + 「- N인 이상」 티어',
		test: (d) => /기프트 효과 강화/.test(d),
		rule: '「- N인 이상」 티어는 <b>각각 독립된 절</b>이다. ' +
			'<b>티어가 미달이어도 앞의 기본 절은 그대로 돈다</b> — 티어는 발동 조건이 아니다. ' +
			'기본 절이 아예 없으면(데스페라도) 최저 티어 미달일 때 죽는 것이 옳다.',
	},
	{
		key: 'SLOT', label: '「[편성 N번 인격 전용 효과]」 자리 한정',
		test: (d) => /\[편성[^\]]*번[^\]]*전용/.test(d),
		rule: '<b>[편성 N번]은 범위가 아니라 조건이다</b> — 그 대괄호 뒤부터 ' +
			'다음 대괄호(또는 끝)까지의 절에 <code>scope=slot</code> 조건으로 붙는다. ' +
			'출격이 7인이라 자리는 1~7 이다.',
	},
	{
		key: 'ONLY', label: '「[… 전용 효과]」 — 자리가 아닌 다른 한정',
		test: (d) => /\[[^\]]*전용[^\]]*\]/.test(d) && !/\[편성[^\]]*번[^\]]*전용/.test(d),
		rule: '대괄호가 특정 인격·소속을 한정한다. 자리와 같은 방식으로 ' +
			'<b>그 뒤 절들의 조건</b>이 된다.',
	},
	{
		key: 'OR', label: '「…거나」·「또는」 — 조건이 OR 다',
		test: (d) => /하였거나|하거나|이거나|또는/.test(d),
		rule: '「…거나」로 이어진 조건은 <b>같은 group 에 넣어 OR 로 읽는다</b>. ' +
			'하나만 서면 그 절이 돈다 — 옛 엔진이 이것을 논리곱으로 읽어 죽였다.',
	},
	{
		key: 'AMPLIFY', label: '「효과가 강화되어」 — 앞 절에 딸린 강화판',
		test: (d) => /효과가 강화되어|효과가 강화된다/.test(d),
		rule: '「효과가 강화되어」는 <b>앞 절의 강화판</b>이다(<code>refines</code>). ' +
			'앞 절이 죽으면 같이 죽고, <b>켜짐 판정에 따로 참여하지 않는다</b>.',
	},
	{
		key: 'REPLACE', label: '「효과가 변경되어」 — 조건은 같고 효과만 갈린다',
		test: (d) => /효과가 변경되어/.test(d),
		rule: '「효과가 변경되어」는 강화가 아니라 <b>대체</b>다. 조건이 같고 주는 효과만 ' +
			'갈리므로 <b>절을 따로 만들지 않는다</b> — 쪼개면 OR 로 읽혀 판정이 헐거워진다.',
	},
	{
		key: 'SUBBULLET', label: '「- 」 하위 불릿 — 앞 문장을 키우는 항목',
		test: (d) => /\n\s*-\s/.test(d),
		rule: '「- 」 하위 항목은 <b>앞 문장을 키우는 것</b>이지 앞 문장이 돌기 위한 ' +
			'조건이 아니다. 조건으로 세면 안 된다.',
	},
	{
		key: 'ASSOC', label: '「… 소속 인격」 — 소속 조건이 있다',
		test: (d) => /소속 인격|소속의 인격|소속이면/.test(d),
		rule: '소속은 <b>그 절에만</b> 붙는다. 다른 절까지 끌고 가지 않는다 — ' +
			'절이 전부 소속에 묶였는지(모든 것의 뼈대), 무조건 절이 따로 있는지(결의)가 갈린다.',
	},
	{
		key: 'COUNT', label: '「N인 이상」·「N명 이상」 — 인원 문턱',
		test: (d) => /[0-9]+인 이상|[0-9]+명 이상/.test(d),
		rule: '수를 <code>threshold</code> 로 적는다. <b>문장에 수가 없으면 null 로 두고 결손으로 남긴다</b> — ' +
			'1 로 가정하지 않는다.',
	},
	{
		key: 'DENOM', label: '분모를 직접 말한다 — 편성·출격·대기',
		test: (d) => /대기 인원|편성 인원|출격 인원/.test(d),
		rule: '설명문이 분모를 직접 말한다. <b>「편성 인원 기준」·「대기 인원 포함」 → roster(12인)</b>, ' +
			'<b>「출격 인원 기준」·「대기 인원 제외」 → field(7인)</b>, <b>「대기 인원에」 → waiting(5인)</b>.',
	},
	{
		key: 'RESO', label: '공명 조건',
		test: (d) => /공명/.test(d),
		rule: '공명은 <b>전투 중 조건이 아니다</b> — 상한이 출격 인원 중 그 속성 스킬 보유 수라 ' +
			'편성으로 정해진다. 「완전 공명」은 <code>resonanceMode=absolute</code> 이고 ' +
			'슬롯에서 연속 3개 이상이라야 서므로 <code>threshold≥3</code> 이다.',
	},
	{
		key: 'SCALE', label: '크기가 편성 수에 비례한다',
		test: (d) => /편성된 수|편성 인원 수|편성된 인격 수/.test(d),
		rule: '<b>크기는 안 담는다.</b> 대신 문턱값으로 옮긴다 — 「(편성된 수 - 2)만큼 얻음」은 ' +
			'3명은 있어야 1을 준다는 뜻이니 <code>gte 3</code> 이다. 0개를 주는 것은 안 주는 것이다.',
	},
	{
		key: 'PRIORITY', label: '「(… 우선으로 지정)」 — 조건이 아니라 우선순위 주석',
		test: (d) => /우선으로 지정|우선하여 지정/.test(d),
		rule: '<b>조건이 아니다.</b> 누구에게 먼저 줄지를 말할 뿐이다 — ' +
			'옛 엔진이 이것을 조건으로 읽어 휴대용 전지 소켓을 죽였다.',
	},
	{
		key: 'RUNTIME', label: '전투 중 상태를 본다 — 적 상태·정신력·보유 효과',
		test: (d) => /적이 보유한|보유한 적|정신력이|흐트러짐|보유하고 있/.test(d),
		rule: '전투 중에만 아는 조건은 <code>runtime=true</code> 로 두고 ' +
			'<b>배제 근거로 쓰지 않는다</b> — 편성만 보고 「아니다」라고 할 수 없다.',
	},
];

export function shapeKeysOf(desc: string): string[] {
	return SHAPES.filter((s) => s.test(desc)).map((s) => s.key);
}

/** 이 문형 묶음에 적용할 규칙을 사람 문장으로. 표지가 없으면 기본 규칙 하나다 */
export function ruleTextOf(keys: string[]): string[] {
	const base = '설명문의 <b>문단 하나가 절 하나</b>다. 빈 줄로 갈린 문단을 각각 능력으로 만든다.';
	if (keys.length === 0) {
		return [
			base,
			'조건 표지가 하나도 없다 — <b>전부 <code>unconditional=true</code></b> 로 두고 조건을 달지 않는다.',
			'절이 하나라도 무조건이면 <b>그 기프트는 편성과 무관하게 켜진다</b>.',
		];
	}
	const map = new Map(SHAPES.map((s) => [s.key, s.rule]));
	return [base, ...keys.map((k) => map.get(k) ?? k)];
}
