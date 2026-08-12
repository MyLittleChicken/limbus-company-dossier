/**
 * 9073 엔도르핀 키트 — 골든 덱을 정한다.
 *
 * 스펙 초안은 화상·진동 골든 덱에서 9073 이 죽는다고 적었으나 그 덱에는
 * 10916 이 호흡 부여 스킬을 실제로 갖고 있어 켜지는 것이 맞다. 사용자가 본
 * 오판정은 **태그로는 호흡 인격인데 스킬은 호흡을 주지 않는** 편성에서 난다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

/** identity_axis 는 BREATH 라 하지만 coin_token 에 호흡 부여 스킬이 없는 인격들 */
const IDS = ['10114', '10206', '10406', '10702', '10808', '11207'];
const SQUAD: Squad = {
	roster: IDS.map((identityId) => ({ identityId, egoIds: [] })),
	field: IDS,
};

const verdicts = evaluateGifts({
	squad: SQUAD,
	profile: new Profile(SQUAD, data.capabilities),
	giftTriggers: data.giftTriggers,
	refsByTrigger: data.refsByTrigger,
	params: data.params,
});
const v = verdicts.find((x) => x.giftId === '9073');

console.log(`편성 ${IDS.join(' ')}`);
console.log(`9073 엔도르핀 키트 — 옛 엔진 판정: ${v === undefined ? '(없음)' : v.fireable ? '유효' : '발동 불가'}  등급 ${v?.grade}`);
for (const r of v?.reasons ?? []) {
	console.log(`  ${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict} ${r.certainty} ${r.denominator ?? ''}`);
}

/** 같은 편성에서 스킬이 실제로 호흡을 주는가 */
const breath = await prisma.$queryRaw<Array<{ n: bigint }>>`
  SELECT count(DISTINCT ct.skill_id) AS n
  FROM canonical.identity_skill i
  JOIN canonical.coin_token ct ON ct.skill_id = i.skill_id AND ct.kind = 'status'
  JOIN canonical.status_category sc ON sc.status_id = ct.status_id
  WHERE sc.category = 'BREATH' AND i.identity_id = ANY(${IDS}::text[])
`;
console.log(`\n같은 편성에서 호흡을 주는 스킬 수 (coin_token): ${breath[0].n}`);

/** 질투 스킬은 있는가 — ordinal 1(강화판)이 걸릴 자리다 */
const envy = await prisma.$queryRaw<Array<{ n: bigint }>>`
  SELECT count(DISTINCT s.id) AS n
  FROM canonical.identity_skill i
  JOIN canonical.skill s ON s.id = i.skill_id
  WHERE s.sin = 'envy' AND i.identity_id = ANY(${IDS}::text[])
`;
console.log(`같은 편성의 질투 속성 스킬 수: ${envy[0].n}`);

await prisma.$disconnect();
process.exit(0);
