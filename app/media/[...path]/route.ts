import { join } from 'node:path';
import { assetResponse } from '@/lib/asset-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
	return assetResponse(join(process.cwd(), 'data/assets'), (await context.params).path, request);
}

export const HEAD = GET;
