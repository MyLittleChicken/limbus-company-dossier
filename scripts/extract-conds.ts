/**
 * 절마다 **조건**을 뽑는다. 절 구조는 이미 확정됐다(`split-clauses.ts`).
 *
 * **옛 적재기와 무엇이 다른가.** 그쪽은 기프트 **전체** 산문에 정규식 6개를
 * 돌리고 못 찾으면 `need = 1` 로 **가정**해 118짝 중 76짝을 틀렸다. 여기서는
 * 문단 하나(+물림)만 보고, **못 찾으면 비워 둔다.** 비면 굽는 쪽이 결손으로
 * 남기고 판정은 그 조건을 배제 근거로 쓰지 않는다.
 *
 * **조건과 효과를 가른다.** 「출혈을 부여하는 스킬을 사용하여」는 조건이고
 * 「대상에게 출혈 위력 3 부여」는 효과다. 앞의 것만 뽑는다 — 뒤엣것까지 뽑으면
 * 「이 기프트가 출혈을 주니까 출혈 인격이 필요하다」는 거꾸로 된 판정이 된다.
 *
 * 실행: npm run gift:conds -- --in /tmp/clause-skeleton.jsonl --out /tmp/conds.jsonl
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';

const argv = process.argv.slice(2);
const arg = (n: string, d: string): string => {
	const i = argv.indexOf(`--${n}`);
	return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};
const inPath = arg('in', '/tmp/clause-skeleton.jsonl');
const outPath = arg('out', '/tmp/conds.jsonl');

const prisma = new PrismaClient();
const assoc = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
	SELECT association_id AS id, name FROM canonical.association_text WHERE locale = 'ko'
`;
await prisma.$disconnect();

/** 축 — 게임 키워드 이름 → 축 id. 탄환은 keyword 어휘 밖이라 따로 적는다 */
const AXIS: Array<[RegExp, string]> = [
	[/화상/, 'COMBUSTION'], [/출혈/, 'LACERATION'], [/파열/, 'BURST'],
	[/호흡/, 'BREATH'], [/진동/, 'VIBRATION'], [/침잠/, 'SINKING'],
	[/충전/, 'CHARGE'], [/탄환/, 'BULLET'],
];
const SIN: Array<[RegExp, string]> = [
	[/분노/, 'wrath'], [/색욕/, 'lust'], [/나태/, 'sloth'], [/탐식/, 'gluttony'],
	[/우울/, 'gloom'], [/오만/, 'pride'], [/질투/, 'envy'],
];
const ATTACK: Array<[RegExp, string]> = [
	[/참격/, 'slash'], [/관통/, 'pierce'], [/타격/, 'blunt'],
];
const SKILL_KIND: Array<[RegExp, string]> = [
	[/반격 스킬/, 'counter'], [/회피 스킬/, 'evade'], [/가드 스킬|수비 스킬/, 'guard'],
];
const COIN: Array<[RegExp, string]> = [
	[/빼기 코인/, 'minus'], [/더하기 코인/, 'plus'], [/단일 코인/, 'single'],
];
/** 소속은 긴 이름부터 봐야 「엄지」가 「동부 엄지」를 먹지 않는다 */
const ASSOC = assoc
	.filter((a) => a.name.trim() !== '')
	.sort((a, b) => b.name.length - a.name.length);

interface Clause {
	giftId: string; level: number; ordinal: number; klass: string;
	sourceText: string; refines: number | null; inherits: string[]; tier: number | null;
}
interface Cond {
	group: number; idx: number; refKind: string; refId: string; op: string;
	threshold: number | null; scope: string; supply: string;
	slot: number | null; runtime: boolean; resonanceMode: string | null;
}

const clauses: Clause[] = readFileSync(inPath, 'utf8').split('\n')
	.map((l) => l.trim()).filter((l) => l !== '').map((l) => JSON.parse(l) as Clause);

/**
 * 이 문장에서 **조건절**만 남긴다.
 *
 * 한국어 조건절은 「…시」 「…경우」 「…면」 「…때」 「…하여」 「…보유한」 으로
 * 끝난다. 그 뒤는 효과다. 조건절 표지가 없으면 문장 전체가 효과이므로
 * 무조건 절이다.
 */
const conditionPart = (s: string): string | null => {
	const flat = s.replace(/⏎/g, ' ').replace(/\([^)]*\)/g, ' ');
	const m = /^(.*?(?:할 경우|한 경우|일 경우|인 경우|했으면|하였다면|한다면|이라면|있다면|이면|일 때|할 때|보유한|사용하여|사용할 경우|적중 시|사용 시|승리 시|처치 시|이상이면|이상일 때))/.exec(flat);
	return m === null ? null : m[1];
};

/** 분모를 문장이 직접 말하는가 */
const scopeOf = (text: string): string => {
	if (/대기 인원에|대기 인원 중/.test(text)) return 'waiting';
	if (/대기 인원 제외|출격 인원을 기준|전투에 참여/.test(text)) return 'field';
	if (/대기 인원 포함|편성 인원 포함|편성 인원을 기준|편성된|덱에 편성/.test(text)) return 'roster';
	return 'field';
};

/** 「N인 이상」 문턱 */
const thresholdOf = (text: string): number | null => {
	const m = /([0-9]+)\s*(?:인|명)\s*이상/.exec(text);
	return m === null ? null : Number(m[1]);
};

/** 대괄호 자리 번호들 */
const slotsOf = (text: string): number[] => {
	const m = /\[편성[^\]]*?((?:[0-9]+\s*,?\s*)+)번[^\]]*전용/.exec(text);
	if (m === null) return [];
	return [...m[1].matchAll(/[0-9]+/g)].map((x) => Number(x[0])).filter((n) => n >= 1 && n <= 7);
};

/** 전투 중에만 아는 조건인가 */
const isRuntime = (text: string): boolean =>
	/적이 보유한|보유한 적|대상이 보유한|대상의|정신력이|흐트러짐|사망|걸린 적|걸린 상태|상태인 적|피격|합 승리|합 패배|적중/.test(text);

const out: Array<Clause & { conds: Cond[]; unconditional: boolean; gaps: string[] }> = [];
let matched = 0;
let empty = 0;

for (const c of clauses) {
	const whole = [...c.inherits, c.sourceText].join(' ');
	const cond = conditionPart(c.sourceText);
	const conds: Cond[] = [];
	const gaps: string[] = [];
	let idx = 0;
	/**
	 * 같은 참조가 두 번 오면 **더 구체적인 쪽으로 갱신한다.**
	 *
	 * 티어의 `gte 6` 이 물림의 `has` 뒤에 와서 무시되던 자리다 — 먼저 온 것이
	 * 이기게 두면 「6인 이상」이 「한 명이라도」로 뭉개진다.
	 */
	const push = (o: Partial<Cond> & { refKind: string; refId: string }): void => {
		const prev = conds.find((x) => x.refKind === o.refKind && x.refId === o.refId);
		if (prev !== undefined) {
			if (o.threshold != null && (prev.threshold == null || o.threshold > prev.threshold)) {
				prev.threshold = o.threshold;
				prev.op = o.op ?? 'gte';
				if (o.scope !== undefined) prev.scope = o.scope;
			}
			if (o.supply === 'skill') prev.supply = 'skill';
			if (o.slot != null) { prev.slot = o.slot; prev.scope = 'slot'; }
			return;
		}
		conds.push({
			group: 0, idx: idx++, op: 'has', threshold: null, scope: 'field',
			supply: 'tag', slot: null, runtime: false, resonanceMode: null, ...o,
		});
	};

	// ── ① 물림에서 오는 조건 — 게이트와 대괄호는 이 절 전체를 막는다 ──
	for (const h of c.inherits) {
		const th = thresholdOf(h);
		const sc = scopeOf(h);
		for (const [re, id] of ASSOC.map((a) => [new RegExp(a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), a.id] as [RegExp, string])) {
			if (re.test(h) && /소속/.test(h)) { push({ refKind: 'association', refId: id, op: th === null ? 'has' : 'gte', threshold: th, scope: sc }); break; }
		}
		for (const [re, id] of AXIS) {
			if (re.test(h) && /부여|획득|소모|보유/.test(h)) {
				push({ refKind: 'axis', refId: id, op: th === null ? 'has' : 'gte', threshold: th, scope: sc, supply: 'skill' });
			}
		}
		if (/혈찬/.test(h)) push({ refKind: 'unit_keyword', refId: 'BLOODFIEND', op: th === null ? 'has' : 'gte', threshold: th, scope: sc });
		for (const s of slotsOf(h)) push({ refKind: 'deployment', refId: `slot${s}`, scope: 'slot', slot: s });
		if (th !== null && !conds.some((x) => x.threshold === th)) {
			gaps.push(`물림에 「${th}인 이상」이 있는데 무엇을 세는지 못 찾았다: ${h.slice(0, 40)}`);
		}
	}

	// ── ② 티어는 그 자체가 조건이다 ──
	if (c.tier !== null) {
		const base = c.inherits.find((h) => /기프트 효과 강화/.test(h)) ?? '';
		const sc = scopeOf(base);
		let found = false;
		for (const [re, id] of AXIS) {
			if (re.test(base)) { push({ refKind: 'axis', refId: id, op: 'gte', threshold: c.tier, scope: sc, supply: 'skill' }); found = true; }
		}
		if (/혈찬/.test(base)) { push({ refKind: 'unit_keyword', refId: 'BLOODFIEND', op: 'gte', threshold: c.tier, scope: sc }); found = true; }
		if (!found) gaps.push(`티어 ${c.tier}인인데 무엇을 세는지 못 찾았다: ${base.slice(0, 40)}`);
	}

	/**
	 * ── ③ 주어 한정 — 조건절 표지가 없어도 주어 자체가 조건인 자리 ──
	 *
	 * 「약지 소속 인격 공격 종료시 …」 · 「림버스 컴퍼니 소속 인격이 사용하는
	 * 스킬 2의 …」는 「…시」로 안 끝나지만 <b>약지가 없으면 아무 일도 안 난다</b>.
	 * 소속과 「…스킬을 보유한 인격」은 효과로 줄 수 있는 것이 아니므로 문장
	 * 어디에 있든 조건이다 — 축과 달리 효과와 헷갈릴 일이 없다.
	 */
	{
		const flat = c.sourceText.replace(/⏎/g, ' ');
		const th = thresholdOf(flat);
		const sc = scopeOf(flat);
		for (const a of ASSOC) {
			if (flat.includes(a.name) && /소속/.test(flat)) {
				push({ refKind: 'association', refId: a.id, op: th === null ? 'has' : 'gte', threshold: th, scope: sc });
				break;
			}
		}
		// 「…을 부여하는/획득하는 공격 스킬을 보유한 인격」 — 공급 조건이다
		for (const [re, id] of AXIS) {
			if (new RegExp(`${re.source}[^.]{0,30}(부여|획득|소모)하[^.]{0,10}스킬을 보유한`).test(flat)) {
				push({ refKind: 'axis', refId: id, op: th === null ? 'has' : 'gte', threshold: th, scope: sc, supply: 'skill' });
			}
		}
		if (/혈귀/.test(flat)) push({ refKind: 'unit_keyword', refId: 'BLOODFIEND', op: 'has', threshold: null, scope: sc });
	}

	// ── ④ 이 절의 조건절에서 오는 조건 ──
	if (cond !== null) {
		const th = thresholdOf(cond);
		const sc = scopeOf(cond);
		// 공명은 축보다 먼저 본다 — 「분노 완전 공명」이 sin 으로 잡히면 안 된다
		for (const [re, id] of SIN) {
			if (new RegExp(`${re.source}[^가-힣]*(완전 )?공명`).test(cond)) {
				push({ refKind: 'resonance', refId: id, op: 'gte',
					threshold: th ?? (/완전 공명/.test(cond) ? 3 : null), scope: 'field',
					resonanceMode: /완전 공명/.test(cond) ? 'absolute' : 'activate' });
			}
		}
		for (const [re, id] of AXIS) {
			// 아군이 그 축을 **공급**해야 하는가. 「…을 부여하는 스킬」 「…상태인 아군」
			if (new RegExp(`${re.source}[^.]{0,20}(위력|횟수|상태)?[^.]{0,20}(부여|획득|소모)하는`).test(cond)
				|| new RegExp(`${re.source}[^.]{0,10}(상태인|보유한) 아군`).test(cond)) {
				push({ refKind: 'axis', refId: id, op: th === null ? 'has' : 'gte', threshold: th, scope: sc, supply: 'skill' });
			}
		}
		for (const [re, id] of SIN) {
			if (new RegExp(`${re.source} 속성`).test(cond)) push({ refKind: 'sin', refId: id });
		}
		for (const [re, id] of ATTACK) {
			if (new RegExp(`${re.source}[^가-힣]{0,3}(공격 )?스킬`).test(cond)) push({ refKind: 'attack_type', refId: id });
		}
		for (const [re, id] of SKILL_KIND) if (re.test(cond)) push({ refKind: 'skill_kind', refId: id });
		for (const [re, id] of COIN) if (re.test(cond)) push({ refKind: 'coin', refId: id });
		if (/혈찬/.test(cond)) push({ refKind: 'unit_keyword', refId: 'BLOODFIEND', op: th === null ? 'has' : 'gte', threshold: th, scope: sc });

		if (conds.length === 0) gaps.push(`조건절은 있는데 무엇을 요구하는지 못 찾았다: ${cond.slice(0, 50)}`);
		if (th !== null && !conds.some((x) => x.threshold === th)) {
			gaps.push(`「${th}인 이상」이 있는데 무엇을 세는지 못 찾았다: ${cond.slice(0, 40)}`);
		}
	}

	// ── ⑤ 전투 중에만 아는 조건은 배제 근거로 쓰지 않는다 ──
	if (cond !== null && isRuntime(cond)) {
		for (const x of conds) if (x.refKind === 'axis' && x.supply !== 'skill') x.runtime = true;
	}

	// idx 를 group 안에서 0부터 다시 매긴다
	conds.forEach((x, i) => { x.idx = i; });
	const unconditional = cond === null && conds.length === 0 && c.inherits.length === 0 && c.tier === null;
	if (conds.length > 0) matched += 1; else if (!unconditional) empty += 1;
	out.push({ ...c, conds, unconditional, gaps });
}

writeFileSync(outPath, `${out.map((o) => JSON.stringify(o)).join('\n')}\n`, 'utf8');

const uncond = out.filter((o) => o.unconditional).length;
const gapN = out.filter((o) => o.gaps.length > 0).length;
console.log(`절 ${out.length}`);
console.log(`  조건을 뽑았다        ${matched}  (${Math.round(matched / out.length * 100)}%)`);
console.log(`  무조건 절            ${uncond}  (${Math.round(uncond / out.length * 100)}%)`);
console.log(`  조건이 있는데 못 뽑음  ${empty}  (${Math.round(empty / out.length * 100)}%) — 결손이다`);
console.log(`  결손 메모가 붙은 절    ${gapN}`);
console.log(`\n→ ${outPath}`);
process.exit(0);
