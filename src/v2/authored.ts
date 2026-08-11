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
import { validatePayload, type AbilityPayload } from './ability-payload.js';

export interface AxisGrantRow {
	id: string; sourceKind: string; sourceId: string; mode: string;
	targetKind: string; targetId: string; axisId: string; affects: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}

export interface GiftAbilityAuthoredRow {
	giftId: string;
	level: number;
	ordinal: number;
	payload: AbilityPayload;
}

export interface Authored {
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
	egoGranted: Array<{ egoId: string; axisId: string }>;
	axisGrant: AxisGrantRow[];
	giftAbility: GiftAbilityAuthoredRow[];
}

/**
 * 저작이 가리킬 수 있는 참조 어휘.
 *
 * 앞 셋은 canonical 에 실물이 있어 거기서 읽는다. 뒤 넷은 **코드가 정하는
 * 닫힌 집합**이다 — 게임이 정한 사실이 아니라 우리가 조건을 읽는 방법이라
 * 코드에 둔다(ADR-08). 채우는 곳은 `load-canonical.ts` 다.
 */
export interface KnownIds {
	axisIds: Set<string>;
	unitKeywordIds: Set<string>;
	associationIds: Set<string>;
	sinIds: Set<string>;
	attackTypes: Set<string>;
	skillKinds: Set<string>;
	resonanceIds: Set<string>;
}

export async function readAuthored(prisma: PrismaClient): Promise<Authored> {
	const [refException, egoGranted, axisGrant, giftAbility] = await Promise.all([
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
		prisma.giftAbilityAuthored.findMany({
			select: { giftId: true, level: true, ordinal: true, payload: true },
			orderBy: [{ giftId: 'asc' }, { level: 'asc' }, { ordinal: 'asc' }],
		}),
	]);
	return {
		refException,
		egoGranted,
		axisGrant,
		giftAbility: giftAbility as unknown as GiftAbilityAuthoredRow[],
	};
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
		sin: known.sinIds,
		attack_type: known.attackTypes,
		skill_kind: known.skillKinds,
		resonance: known.resonanceIds,
	};
	/**
	 * 어휘 하나가 통째로 빠지면 그 종류의 조건이 전부 「어휘에 없다」로 나온다 —
	 * 저작이 틀린 것처럼 보이지만 실은 부르는 쪽이 안 채운 것이다.
	 *
	 * `tsconfig` 가 `src` 를 검사에서 빼므로 타입이 이 실수를 못 잡는다.
	 * 조용히 틀린 진단을 내느니 여기서 크게 터뜨린다.
	 */
	const missing = Object.entries(pool).filter(([, set]) => set === undefined).map(([k]) => k);
	if (missing.length > 0) {
		throw new Error(
			`KnownIds 에 어휘가 빠졌다: ${missing.join(', ')} — 부르는 쪽(load-canonical.ts)이 채워야 한다`,
		);
	}

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

	const SOURCE_KINDS = new Set(['passive', 'ego_passive', 'gift', 'system']);
	const MODES = new Set(['add', 'restrict']);
	const TARGETS = new Set(['self', 'association', 'unit_keyword']);
	const AFFECTS = new Set(['tag', 'skill', 'both']);
	const GATES = new Set(['always', 'ego_equipped', 'gift_held', 'roster_count', 'status_held']);

	for (const g of a.axisGrant) {
		if (!known.axisIds.has(g.axisId)) {
			out.push(`axis_grant ${g.id} — axis '${g.axisId}' 가 canonical 에 없다`);
		}
		if (!SOURCE_KINDS.has(g.sourceKind)) {
			out.push(`axis_grant ${g.id} — 모르는 source_kind '${g.sourceKind}'`);
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

	/**
	 * 기프트 능력 — 형식과 참조를 함께 본다.
	 *
	 * 심을 때도 막지만(`seed-authored`) 사람이 DB 를 직접 고칠 수 있으므로
	 * **굽기 직전에 다시 본다**. `refKind='other'` 는 어휘에 못 담는 조건의
	 * 원문 조각이라 실재를 물을 수 없다 — 검사에서 뺀다.
	 */
	for (const g of a.giftAbility) {
		const at = `gift_ability ${g.giftId}/${g.level}/${g.ordinal}`;
		for (const problem of validatePayload(g.payload)) out.push(`${at} 형식: ${problem}`);
		for (const c of g.payload.conds) {
			if (c.refKind === 'other') continue;
			const set = pool[c.refKind];
			if (set === undefined) {
				out.push(`${at} 조건 ${c.group}/${c.idx} 의 refKind 가 어휘에 없다: ${c.refKind}`);
			} else if (!set.has(c.refId)) {
				out.push(`${at} 조건 ${c.group}/${c.idx} 의 ${c.refKind} 참조가 없다: ${c.refId}`);
			}
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
	/**
	 * 기프트 능력. **조건까지 정렬해서 잰다** — payload 의 키 순서나 조건 배열
	 * 순서가 DB 왕복에 따라 흔들려도 같은 사실이면 같은 지문이 나와야 한다.
	 *
	 * `note` 는 애초에 안 읽으므로 자동으로 빠진다 — 설명을 고치는 것은 결과를
	 * 안 바꾸므로 재빌드를 요구할 이유가 없다.
	 */
	const abilityKey = (g: GiftAbilityAuthoredRow): string =>
		`${g.giftId}\t${String(g.level).padStart(3, '0')}\t${String(g.ordinal).padStart(3, '0')}`;
	for (const g of [...a.giftAbility].sort((x, y) => abilityKey(x).localeCompare(abilityKey(y)))) {
		const p = g.payload;
		h.update(`gift_ability\t${abilityKey(g)}\t${p.timing}\t${p.unconditional}\t` +
			`${p.refines ?? ''}\t${p.sourceText}\n`);
		const conds = [...p.conds]
			.map((c) => `${c.group}\t${c.idx}\t${c.refKind}\t${c.refId}\t${c.op}\t` +
				`${c.threshold ?? ''}\t${c.scope}\t${c.supply}\t${c.slot ?? ''}\t` +
				`${c.runtime}\t${c.resonanceMode ?? ''}`)
			.sort();
		for (const c of conds) h.update(`  cond\t${c}\n`);
	}
	return h.digest('hex');
}
