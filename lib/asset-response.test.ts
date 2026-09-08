import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assetResponse } from './asset-response';

const root = await mkdtemp(join(tmpdir(), 'limbus-media-'));
after(() => rm(root, { recursive: true, force: true }));
const parts = ['identities', 'limbus-assets', 'new.webp'];
const request = (headers = {}, method = 'GET') => new Request('http://localhost/media/test', { headers, method });

test('serves files created after a miss and revalidates atomic replacements', async () => {
	assert.equal((await assetResponse(root, parts, request())).status, 404);
	await mkdir(join(root, 'identities/limbus-assets'), { recursive: true });
	const path = join(root, ...parts);
	await writeFile(path, 'first image');
	const first = await assetResponse(root, parts, request());
	assert.equal(first.status, 200);
	assert.equal(first.headers.get('content-type'), 'image/webp');
	assert.equal(await first.text(), 'first image');
	const etag = first.headers.get('etag');
	assert.ok(etag);
	assert.equal((await assetResponse(root, parts, request({ 'If-None-Match': etag }))).status, 304);
	await writeFile(`${path}.tmp`, 'updated image bytes');
	await rename(`${path}.tmp`, path);
	const updated = await assetResponse(root, parts, request({ 'If-None-Match': etag }));
	assert.equal(updated.status, 200);
	assert.notEqual(updated.headers.get('etag'), etag);
	assert.equal(await updated.text(), 'updated image bytes');
	const head = await assetResponse(root, parts, request({}, 'HEAD'));
	assert.equal(head.status, 200);
	assert.equal(await head.text(), '');
});

test('rejects traversal, unsupported extensions and symlinks outside the asset root', async () => {
	for (const path of [['..', 'x', 'a.webp'], ['a/b', 'x', 'a.webp'], ['a', 'b', 'secret.json'], ['a']]) {
		assert.equal((await assetResponse(root, path, request())).status, 404);
	}
	const outside = await mkdtemp(join(tmpdir(), 'limbus-private-'));
	try {
		await writeFile(join(outside, 'private.webp'), 'private');
		await mkdir(join(root, 'egos/source'), { recursive: true });
		await symlink(join(outside, 'private.webp'), join(root, 'egos/source/leak.webp'));
		assert.equal((await assetResponse(root, ['egos', 'source', 'leak.webp'], request())).status, 404);
	} finally { await rm(outside, { recursive: true, force: true }); }
});
