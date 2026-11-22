import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, renameSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workspace = mkdtempSync(join(tmpdir(), 'limbus-assets-live-'));
const previous = process.cwd();
process.chdir(workspace);
const assets: typeof import('./assets') = await import('./assets');
process.chdir(previous);
after(() => rmSync(workspace, { recursive: true, force: true }));

test('a running resolver discovers an image added after a cached missing lookup', () => {
	assert.equal(assets.identityImage(99991), null);
	const dir = join(workspace, 'data/assets/identities/limbus-assets');
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, '99991_gacksung_profile.webp'), 'new image');
	const url = assets.identityImage(99991);
	assert.ok(url);
	assert.equal(new URL(url, 'http://localhost').pathname, '/media/identities/limbus-assets/99991_gacksung_profile.webp');
});

test('new authoritative files replace an already cached fallback source', () => {
	const low = join(workspace, 'data/assets/egos/shared-library');
	mkdirSync(low, { recursive: true });
	writeFileSync(join(low, '29991_awaken_profile.webp'), 'fallback');
	assert.match(assets.egoImage(29991) ?? '', /shared-library/);
	const high = join(workspace, 'data/assets/egos/limbus-assets');
	mkdirSync(high, { recursive: true });
	writeFileSync(join(high, '29991_awaken_profile.webp'), 'authoritative');
	assert.match(assets.egoImage(29991) ?? '', /limbus-assets/);
});

test('atomic image replacement changes the URL revision without restarting the resolver', () => {
	const dir = join(workspace, 'data/assets/identities/limbus-assets');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, '99992_gacksung_profile.webp');
	writeFileSync(path, 'initial image');
	const before = assets.identityImage(99992);
	assert.ok(before);
	writeFileSync(`${path}.tmp`, 'replacement image with different contents');
	utimesSync(`${path}.tmp`, new Date('2030-01-01'), new Date('2030-01-01'));
	renameSync(`${path}.tmp`, path);
	const after = assets.identityImage(99992);
	assert.ok(after);
	assert.notEqual(after, before);
	assert.ok(new URL(after, 'http://localhost').searchParams.get('v'));
});


test('canonical keyword IDs resolve the same asset as their display names',()=>{
 const dir=join(workspace,'data/assets/icons/limbus-assets');mkdirSync(dir,{recursive:true});
 for(const [id,name] of Object.entries({Combustion:'Burn',Laceration:'Bleed',Vibration:'Tremor',Burst:'Rupture',Breath:'Poise',Penetrate:'Pierce',Hit:'Blunt'})){
  writeFileSync(join(dir,name+'.webp'),'icon');assert.equal(assets.keywordIcon(id),assets.keywordIcon(name));assert.ok(assets.keywordIcon(id));
 }
});

test('pack dimensions reserve the exact original aspect before image decode',async()=>{
 const {default:sharp}=await import('sharp');
 const dir=join(workspace,'data/assets/packs/limbus-assets');mkdirSync(dir,{recursive:true});
 await sharp({create:{width:317,height:628,channels:4,background:'#000'}}).webp().toFile(join(dir,'test-pack.webp'));
 const url=assets.packIcon('test-pack');assert.ok(url);
 assert.deepEqual(await assets.assetDimensions(url),{width:317,height:628});
 assert.equal(await assets.assetDimensions('/media/packs/limbus-assets/missing.webp'),null);
});
