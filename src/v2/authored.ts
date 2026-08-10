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

export interface AxisGrantRow {
	id: string; sourceKind: string; sourceId: string; mode: string;
	targetKind: string; targetId: string; axisId: string; affects: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}

export interface Authored {
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
	egoGranted: Array<{ egoId: string; axisId: string }>;
	axisGrant: AxisGrantRow[];
}

export interface KnownIds {
	axisIds: Set<string>;
	unitKeywordIds: Set<string>;
	associationIds: Set<string>;
}

export async function readAuthored(prisma: PrismaClient): Promise<Authored> {
	const [refException, egoGranted, axisGrant] = await Promise.all([
		prisma.refException.findMany({
			select: { kind: true, key: true, refKind: true, refId: true },
		}),
		prisma.egoGrantedAxis.findMany({ select: { egoId: true, axisId: true } }),
		prisma.axisGrant.findMany({
			select: {
				id: true, sourceKind: true, sourceId: true, mode: true,
				targetKind: true, targetId: true, axisId: true, affects: true,
				gateKind: true, gateRef: true, gateMin: true,
			},
			orderBy: { id: 'asc' },
		}),
	]);
	return { refException, egoGranted, axisGrant };
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

	const MODES = new Set(['add', 'restrict']);
	const TARGETS = new Set(['self', 'association', 'unit_keyword']);
	const AFFECTS = new Set(['tag', 'skill', 'both']);
	const GATES = new Set(['always', 'ego_equipped', 'gift_held', 'roster_count', 'status_held']);

	for (const g of a.axisGrant) {
		if (!known.axisIds.has(g.axisId)) {
			out.push(`axis_grant ${g.id} — axis '${g.axisId}' 가 canonical 에 없다`);
		}
		if (!MODES.has(g.mode)) out.push(`axis_grant ${g.id} — 모르는 mode '${g.mode}'`);
		if (!TARGETS.has(g.targetKind)) out.push(`axis_grant ${g.id} — 모르는 target_kind '${g.targetKind}'`);
		if (!AFFECTS.has(g.affects)) out.push(`axis_grant ${g.id} — 모르는 affects '${g.affects}'`);
		if (!GATES.has(g.gateKind)) out.push(`axis_grant ${g.id} — 모르는 gate_kind '${g.gateKind}'`);
		if (g.targetKind === 'association' && !known.associationIds.has(g.targetId)) {
			out.push(`axis_grant ${g.id} — association '${g.targetId}' 가 canonical 에 없다`);
		}
		if (g.targetKind === 'unit_keyword' && !known.unitKeywordIds.has(g.targetId)) {
			out.push(`axis_grant ${g.id} — unit_keyword '${g.targetId}' 가 canonical 에 없다`);
		}
		if (g.mode === 'restrict' && g.targetKind !== 'self') {
			out.push(`axis_grant ${g.id} — restrict 는 target_kind='self' 여야 한다`);
		}
		if ((g.gateKind === 'roster_count') !== (g.gateMin !== null)) {
			out.push(`axis_grant ${g.id} — gate_min 은 roster_count 일 때만 있어야 한다`);
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
	const h = createHash('sha256');
	h.update(`ref_exception\n${refs.join('\n')}\nego_granted_axis\n${egos.join('\n')}\n`);
	for (const g of [...a.axisGrant].sort((x, y) => x.id.localeCompare(y.id))) {
		h.update(`axis_grant\t${g.id}\t${g.sourceKind}\t${g.sourceId}\t${g.mode}\t` +
			`${g.targetKind}\t${g.targetId}\t${g.axisId}\t${g.affects}\t` +
			`${g.gateKind}\t${g.gateRef}\t${g.gateMin ?? ''}\n`);
	}
	return h.digest('hex');
}
