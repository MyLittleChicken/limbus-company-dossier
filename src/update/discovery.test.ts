import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetPath, snapshotId } from './discovery.js';
test('new identity/ego detail and image paths are discovered without a manifest entry', () => {
 assert.equal(targetPath('limbus-assets','data/identities/10616.json'),'entities/identity-details/limbus-assets/10616.json');
 assert.equal(targetPath('limbus-assets','data/egos/21210.json'),'entities/ego-details/limbus-assets/21210.json');
 assert.equal(targetPath('limbus-assets','assets/egos/21210_cg.webp'),'assets/egos/limbus-assets/21210_cg.webp');
 assert.equal(targetPath('loc-ko','Skills-newpatch.json'),'entities/identities/loc-ko/Skills-newpatch.json');
 assert.equal(targetPath('loc-ko','UnitKeyword-newpatch.json'),'entities/identities/loc-ko/UnitKeyword-newpatch.json');
 assert.equal(targetPath('loc-en','EgoSkills-newpatch.json'),'entities/egos/loc-en/EgoSkills-newpatch.json');
});
test('gifts/packs and traversal are outside this updater',()=>{
 assert.equal(targetPath('limbus-assets','data/gifts.json'),null);
 assert.equal(targetPath('limbus-assets','data/md_theme_packs.json'),null);
 assert.equal(targetPath('loc-ko','../Skills-evil.json'),null);
});
test('snapshot identifies source vector not wall clock',()=>{
 assert.equal(snapshotId({b:'2',a:'1'}),snapshotId({a:'1',b:'2'}));
 assert.notEqual(snapshotId({a:'1'}),snapshotId({a:'2'}));
});
