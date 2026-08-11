/**
 * 덱 검수가 짚은 시험 설계의 구멍 둘을 메운다. 조사만 한다.
 *
 * ① 다른 소속의 게이트 기프트가 정말 죽는가
 *    앞 조사는 「그 덱의 축·소속을 가리키는 기프트」만 뽑아, 검계 덱에서 흑운회
 *    게이트가 죽었는지 「차단」인지 「목록에 없음」인지 구별되지 않았다
 * ② 게이트는 열렸는데 수혜 대상이 없으면 어떻게 되나
 *    켜지되 값이 낮은 것이 옳다. 죽이면 안 된다 — 이 PR 의 요지다
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

const squadOf = (ids: string[]): Squad =>
	({ roster: ids.map((identityId) => ({ identityId, egoIds: [] })), field: ids });
const judge = (ids: string[]) => {
	const s = squadOf(ids);
	return new Map(evaluateGifts({
		squad: s, profile: new Profile(s, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
	}).map((v) => [v.giftId, v]));
};

const BLADE = ['10103', '10208', '10308', '10508', '10815', '11002'];
const CLOUD = ['10403', '10602', '10712', '10811', '10902', '11208'];

console.log('=== ① 다른 소속의 게이트는 죽는가 ===');
const inBlade = judge(BLADE);
const inCloud = judge(CLOUD);
for (const [id, who] of [
	['9718', '검계3'], ['9719', '검계3'], ['9720', '검계3'], ['9784', '검계3'],
	['9717', '흑운회3'], ['9783', '흑운회3'], ['9785', '흑운회3'],
] as const) {
	const b = inBlade.get(id);
	const c = inCloud.get(id);
	console.log(`  ${id} (${who.padEnd(6)})  검계덱 ${b === undefined ? '없음' : b.fireable ? '켜진다' : '죽는다'}` +
		`   흑운회덱 ${c === undefined ? '없음' : c.fireable ? '켜진다' : '죽는다'}`);
}

console.log('\n=== ② 게이트는 열렸는데 수혜 대상이 없으면 ===');
/** 검계 6인의 공격 타입 분포를 본다 — 참격이 적은 편성을 짜기 위해 */
const atk = await prisma.$queryRaw<Array<{ identityId: string; kinds: string }>>`
	SELECT i.identity_id AS "identityId",
	       string_agg(DISTINCT lower(s.attack_type::text), ',') AS kinds
	FROM canonical.identity_skill i
	JOIN canonical.skill s ON s.id = i.skill_id
	WHERE s.attack_type IS NOT NULL AND i.identity_id = ANY(${BLADE}::text[])
	GROUP BY 1 ORDER BY 1
`;
for (const a of atk) console.log(`  ${a.identityId}  ${a.kinds}`);

const p = new Profile(squadOf(BLADE), data.capabilities);
console.log(`\n  검계 덱의 참격 공급  ${p.count('attack_type', 'slash', 'field')} / 6`);
console.log(`  검계 소속 수         ${p.count('association', 'BLADE_LINEAGE', 'field')} / 6`);

/** 9718 의 근거를 그대로 보인다 — 게이트와 수혜 대상이 갈리는지 */
const v = inBlade.get('9718');
console.log(`\n  9718 검계 기프트 — ${v?.fireable ? '켜진다' : '죽는다'}`);
for (const r of v?.reasons ?? []) {
	console.log(`    ${r.refKind}/${r.refId} have=${r.have} need=${r.need} ${r.verdict} · ${r.blocking ? '막음' : '안막음'}`);
}

await prisma.$disconnect();
process.exit(0);
