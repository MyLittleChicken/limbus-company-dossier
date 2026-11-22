import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../../db-canonical';
import { canonicalReachable, NO_DB } from '../../../src/v2/canonical/db-available';
import { getEgo, getPack } from './detail';
const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });
test('EGO detail localizes coin timing tokens while retaining raw coin effects', {skip: reachable ? false : NO_DB}, async (t) => {
 const sheet = await getEgo(20211, 'ko');
 if (!sheet) { t.skip('Hollow update snapshot is not installed'); return; }
 const descriptions = sheet.skills.flatMap(s => s.stages.flatMap(st => st.coins.map(c => c.desc ?? ''))).join('\n');
 assert.ok(descriptions.includes('[적중시]'));
 assert.ok(!descriptions.includes('[OnSucceedAttack]'));
 const raw = await canonical.egoSkillCoin.findMany({where:{skillId:'2021112',locale:'ko'}});
 assert.ok(raw.some(c => c.effects.some(e => e.includes('[OnSucceedAttack]'))));
 assert.deepEqual(sheet.skills.filter(s => s.role === 'awakening').map(s => s.stages[0]?.text?.name), ['구멍(le trou)', '부셰(boucher un trou)']);
});

test('pack encounter target keys distinguish repeated positions across waves', {skip: reachable ? false : NO_DB}, async t => {
 const pack = await getPack('1129', 'ko');
 if (!pack) { t.skip('Walpurgis 10 snapshot is not installed'); return; }
 for (const boss of pack.bosses) {
  const keys = boss.targets.map(target => `${target.groupIndex}:${target.index}`);
  assert.equal(new Set(keys).size, keys.length);
 }
});
