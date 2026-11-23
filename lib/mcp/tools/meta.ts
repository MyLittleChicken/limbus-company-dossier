import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { getBuildInfo } from '@/lib/queries/canonical/reference';
import { READ_ONLY } from '../args';
import { defineTool } from '../define-tool';
import { envelopeShape, ok } from '../envelope';

export const DATA_SOURCE = '게임 클라이언트 데이터 — 저작권 Project Moon (Limbus Company). Game client data © Project Moon.';
export const FAN_NOTICE =
	'비공식 팬 제작 2차 창작 사이트다. Project Moon 과 관계없고 승인받지 않았다. ' +
	'Unofficial fan-made site, not affiliated with or endorsed by Project Moon.';

export function registerMetaTools(server: McpServer): void {
	defineTool(
		server,
		'get_build_info',
		{
			title: '데이터 기준 · 출처',
			description:
				'도감 데이터의 기준 스냅샷(snapshotId · snapshotVersion · gameAnchor = 어느 게임 시점까지 반영했나) · ' +
				'거울 던전 판(mdVersion) · 빌드 정보(codeCommit · builtAt · rowCount)와 출처(source) · 면책(notice)을 준다. ' +
				'사용자에게 「언제 데이터인지」나 출처를 밝힐 때, 또는 다른 도구 응답의 snapshotId 를 해석할 때 부른다. 인자 없음.',
			outputSchema: envelopeShape({
				snapshotVersion: z.number().nullable(),
				gameAnchor: z.string().nullable(),
				snapshotAt: z.string().nullable().describe('수집 시각 (ISO 8601)'),
				mdVersion: z.string().nullable(),
				codeCommit: z.string().nullable(),
				builtAt: z.string().nullable().describe('빌드 시각 (ISO 8601)'),
				rowCount: z.number().nullable(),
				source: z.string(),
				notice: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async (_args, ctx) => {
			const info = await getBuildInfo();
			const data = {
				snapshotVersion: info?.snapshotVersion ?? null,
				gameAnchor: info?.gameAnchor ?? null,
				snapshotAt: info?.snapshotAt?.toISOString() ?? null,
				mdVersion: info?.mdVersion ?? null,
				codeCommit: info?.codeCommit ?? null,
				builtAt: info?.builtAt?.toISOString() ?? null,
				rowCount: info?.rowCount ?? null,
				source: DATA_SOURCE,
				notice: FAN_NOTICE,
			};
			const summary = info
				? `데이터 기준 ${info.snapshotId} (v${info.snapshotVersion}${info.gameAnchor ? ` · ${info.gameAnchor}` : ''}). ${DATA_SOURCE}`
				: `적재된 스냅샷이 없다. ${DATA_SOURCE}`;
			return ok(data, summary, ctx);
		},
	);
}
