import { open, realpath } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';

const types: Record<string, string> = {
	'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

/** Resolve at request time: Next's production public-file inventory is fixed at startup. */
export async function assetResponse(root: string, parts: string[], request: Request): Promise<Response> {
	const missing = () => new Response(null, { status: 404 });
	if (parts.length !== 3 || parts.some((part) => !part || part === '.' || part === '..' || /[/\\\0]/.test(part))) return missing();
	const type = types[extname(parts[2]!).toLowerCase()];
	if (!type) return missing();
	try {
		const base = await realpath(root);
		const path = await realpath(join(base, ...parts));
		if (!path.startsWith(`${base}${sep}`)) return missing();
		const file = await open(path, 'r');
		try {
			const stat = await file.stat();
			if (!stat.isFile()) return missing();
			const etag = `W/"${stat.ino}-${stat.size}-${stat.mtimeMs}-${stat.ctimeMs}"`;
			const headers = new Headers({
				'Content-Type': type, 'ETag': etag,
				'Cache-Control': 'public, max-age=0, must-revalidate',
				'X-Content-Type-Options': 'nosniff',
			});
			const matches = request.headers.get('if-none-match')?.split(',').map((value) => value.trim().replace(/^W\//, ''));
			if (matches?.includes('*') || matches?.includes(etag.replace(/^W\//, ''))) return new Response(null, { status: 304, headers });
			headers.set('Content-Length', String(stat.size));
			return new Response(request.method === 'HEAD' ? null : new Uint8Array(await file.readFile()), { headers });
		} finally { await file.close(); }
	} catch (error) {
		if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes((error as NodeJS.ErrnoException).code ?? '')) return missing();
		throw error;
	}
}
