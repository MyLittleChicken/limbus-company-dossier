/**
 * 「상시 절이 하나라도 있는 기프트」가 몇이나 되는가. 조사만 한다.
 *
 * 기프트는 절(문단)의 묶음이고, **절 하나라도 켜지면 기프트는 켜진다.**
 * 그러므로 상시 절이 하나라도 있으면 그 기프트는 편성과 무관하게 켜진다 —
 * 발동 판정 문제 자체가 성립하지 않는다.
 *
 * 이 수가 크면 「켜질 수 없나」를 정밀하게 다룰 대상이 그만큼 줄어든다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';

const prisma = new PrismaClient();

type Row = { giftId: string; level: number; desc: string };
const rows = await prisma.$queryRaw<Row[]>`
	SELECT t.gift_id AS "giftId", t.level, t."desc"
	FROM canonical.gift_stage_text t
	JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon' AND t.level = 0
	  AND length(t."desc") > 0
`;

/** 조건을 여는 표지 — 하나라도 걸리면 그 절은 조건부다 */
const COND = [
	/할 경우|한 경우|일 경우|인 경우/, /할 때|했을 때|일 때|였을 때/,
	/하였다면|한다면|이라면|있다면|없다면|면,/, /할 때마다|때마다/,
	/발동하였|사용할|적중 시|적중시|승리 시|승리시|처치 시/,
	/이상일|이하일|이상 있|초과|미만/, /보유하고 있|보유 시|걸린 적|걸렸다/,
	/소속 인격이 [0-9]/, /^-/,
];
/** 시점만 말하는 것은 조건이 아니다 — 언제나 오는 순간이다 */
const TIMING_ONLY = /^(턴 시작 시|턴 종료 시|전투 시작 시|스테이지 시작 시|첫 턴)/;

let anyUncond = 0;
let allCond = 0;
const uncondIds: string[] = [];

for (const r of rows) {
	const paras = r.desc.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
	if (paras.length === 0) continue;
	const hasUncond = paras.some((p) => {
		if (TIMING_ONLY.test(p)) {
			// 시점 뒤에 조건이 더 붙는지 본다
			const rest = p.replace(TIMING_ONLY, '');
			return !COND.some((re) => re.test(rest));
		}
		return !COND.some((re) => re.test(p));
	});
	if (hasUncond) { anyUncond += 1; uncondIds.push(r.giftId); }
	else allCond += 1;
}

console.log(`거울 던전 기프트 ${rows.length} (강화 0단계 기준)`);
console.log(`  상시 절이 하나라도 있다  ${anyUncond}  (${((anyUncond / rows.length) * 100).toFixed(0)}%)`);
console.log(`  모든 절이 조건부다        ${allCond}  (${((allCond / rows.length) * 100).toFixed(0)}%)`);
console.log(`\n상시 절을 가진 기프트는 편성과 무관하게 켜진다 — 발동 판정의 대상이 아니다.`);
console.log(`정밀 모형이 실제로 필요한 것은 나머지 ${allCond} 개다.`);
console.log(`\n표본 (모든 절이 조건부인 것): ${rows.filter((r) => !uncondIds.includes(r.giftId)).slice(0, 12).map((r) => r.giftId).join(' ')}`);

await prisma.$disconnect();
process.exit(0);
