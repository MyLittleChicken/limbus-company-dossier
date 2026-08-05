/**
 * `app` 의 저작 사실을 읽고, 재는 곳.
 *
 * **읽는 것과 재는 것을 가른다** — `unknownRefs` 와 `authoredDigest` 는 순수라
 * DB 없이 테스트한다(`schema-ops.ts` 와 같은 방식).
 *
 * 지문에 `note` 는 안 넣는다. 설명을 고치는 것은 결과를 안 바꾸므로 재빌드를
 * 요구할 이유가 없다.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from './generated/client.js';

export interface Authored {
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
	egoGranted: Array<{ egoId: string; axisId: string }>;
}

export interface KnownIds {
	axisIds: Set<string>;
	unitKeywordIds: Set<string>;
	associationIds: Set<string>;
}

export async function readAuthored(prisma: PrismaClient): Promise<Authored> {
	const [refException, egoGranted] = await Promise.all([
		prisma.refException.findMany({
			select: { kind: true, key: true, refKind: true, refId: true },
		}),
		prisma.egoGrantedAxis.findMany({ select: { egoId: true, axisId: true } }),
	]);
	return { refException, egoGranted };
}

/**
 * 저작이 가리키는 대상이 실재하는가. **굽기 전에 본다.**
 *
 * `ego_id` 가 없는 것은 여기서 안 잡는다 — 그건 `identity-axis` 가 결손으로
 * 기록하는 경로이고, 저작 표가 실물을 앞지른 것이 곧 오류는 아니다. 새 E.G.O 가
 * 나오기 전에 그 사실을 먼저 적어 둘 수 있어야 한다.
 */
export function unknownRefs(a: Authored, known: KnownIds): string[] {
	const out: string[] = [];
	const pool: Record<string, Set<string>> = {
		axis: known.axisIds,
		unit_keyword: known.unitKeywordIds,
		association: known.associationIds,
	};

	for (const e of a.refException) {
		const set = pool[e.refKind];
		if (set === undefined) {
			out.push(`ref_exception ${e.kind}/${e.key} — 모르는 ref_kind '${e.refKind}'`);
			continue;
		}
		if (!set.has(e.refId)) {
			out.push(`ref_exception ${e.kind}/${e.key} — ${e.refKind} '${e.refId}' 가 canonical 에 없다`);
		}
	}

	for (const g of a.egoGranted) {
		if (!known.axisIds.has(g.axisId)) {
			out.push(`ego_granted_axis ${g.egoId} — axis '${g.axisId}' 가 canonical 에 없다`);
		}
	}

	return out;
}

/**
 * 저작 내용의 지문. **정렬해서 잰다** — DB 가 주는 순서에 흔들리면 같은 입력이
 * 다른 지문을 낸다.
 *
 * `build_info.authored_digest` 가 이 값을 들고, `v2:verify:rebuild` 가 다시 재어
 * 「저작이 바뀌었는가」를 판정한다.
 */
export function authoredDigest(a: Authored): string {
	const refs = a.refException
		.map((e) => `${e.kind} ${e.key} ${e.refKind} ${e.refId}`)
		.sort();
	const egos = a.egoGranted.map((g) => `${g.egoId} ${g.axisId}`).sort();
	const text = `ref_exception\n${refs.join('\n')}\nego_granted_axis\n${egos.join('\n')}\n`;
	return createHash('sha256').update(text).digest('hex');
}
