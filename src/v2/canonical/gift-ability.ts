/**
 * 저작 능력을 canonical 행으로 편다.
 *
 * 저작 `app.gift_ability_authored` 가 정본이다. 여기서 하는 일은 **펴기와
 * 결손 기록**뿐이다 — 무엇이 조건인지는 저작이 정한다(ADR-08).
 *
 * **설명문을 읽지 않는다.** LLM 추출은 오프라인에서 한 번 돌고 결과가 저장소에
 * 커밋된다. 빌드가 다시 파싱하면 같은 입력에 다른 결과가 나올 수 있어
 * `v2:verify:rebuild` 가 성립하지 않는다.
 *
 * **「모른다」를 「아니다」로 쓰지 않는다.** 문턱값을 못 찾은 자리는 `null` 로
 * 두고 결손에 남긴다. 옛 적재기가 `need = 1` 로 가정해 `Allies have%` 118짝
 * 중 76짝을 틀리게 만들었다.
 */
import type { Meta } from './meta.js';
import type { GiftAbilityAuthoredRow } from '../authored.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-gift-ability-model-design.md';

export interface GiftAbilityInput {
	authored: GiftAbilityAuthoredRow[];
	/** 실재하는 기프트 id. 저작이 실물을 앞지를 수 있어 굽기 전에 거른다 */
	giftIds: Set<string>;
}

export interface AbilityRow {
	giftId: string;
	level: number;
	ordinal: number;
	timing: string;
	unconditional: boolean;
	refines: number | null;
	sourceText: string;
}

export interface CondRow {
	giftId: string;
	level: number;
	ordinal: number;
	group: number;
	idx: number;
	refKind: string;
	refId: string;
	op: string;
	threshold: number | null;
	scope: string;
	supply: string;
	slot: number | null;
	runtime: boolean;
	resonanceMode: string | null;
}

export function buildGiftAbility(
	input: GiftAbilityInput,
	meta: Meta,
): { abilities: AbilityRow[]; conds: CondRow[] } {
	const abilities: AbilityRow[] = [];
	const conds: CondRow[] = [];

	/** (gift,level) 마다 실재하는 ordinal — refines 를 검사하는 데 쓴다 */
	const ordinalsOf = new Map<string, Set<number>>();
	/** refines 가 null 인 ordinal — 사슬 금지를 검사하는 데 쓴다 */
	const independentOf = new Map<string, Set<number>>();
	for (const a of input.authored) {
		const key = `${a.giftId}\t${a.level}`;
		if (!ordinalsOf.has(key)) ordinalsOf.set(key, new Set());
		if (!independentOf.has(key)) independentOf.set(key, new Set());
		ordinalsOf.get(key)?.add(a.ordinal);
		if (a.payload.refines === null) independentOf.get(key)?.add(a.ordinal);
	}

	for (const a of input.authored) {
		const p = a.payload;
		const at = `${a.giftId} 단계 ${a.level} 능력 ${a.ordinal}`;

		if (!input.giftIds.has(a.giftId)) {
			// 저작이 실물을 앞지른 것이 곧 오류는 아니다 — 새 기프트가 나오기
			// 전에 사실을 적어 둘 수 있어야 한다. 다만 FK 가 있어 굽지는 못한다.
			meta.gap('gift', a.giftId, 'gift_ability',
				`${at} 이 실재하지 않는 기프트를 가리킨다 — 굽지 않고 남긴다`, EVIDENCE);
			continue;
		}

		const key = `${a.giftId}\t${a.level}`;
		let refines = p.refines;
		if (refines !== null) {
			const exists = ordinalsOf.get(key)?.has(refines) === true;
			const independent = independentOf.get(key)?.has(refines) === true;
			if (!exists) {
				meta.gap('gift', a.giftId, 'refines',
					`${at} 의 refines 가 없는 ordinal ${refines} 을 가리킨다 — 독립으로 굽는다`, EVIDENCE);
				refines = null;
			} else if (!independent) {
				// 사슬을 허용하면 「강화판의 강화판」이 생기고 켜짐 판정이
				// 몇 겹인지 알 수 없어진다. 한 겹으로 못박는다.
				meta.gap('gift', a.giftId, 'refines',
					`${at} 의 refines 가 또 다른 강화판 ${refines} 을 가리킨다(사슬 금지) — 독립으로 굽는다`,
					EVIDENCE);
				refines = null;
			}
		}

		if (p.timing === 'other') {
			meta.gap('gift', a.giftId, 'timing',
				`${at} 의 발동 시점이 어휘에 없다 — 'other' 로 둔다`, EVIDENCE);
		}
		if (!p.unconditional && p.conds.length === 0) {
			// 조건이 있는 줄은 아는데 못 뽑은 자리다. 능력은 살린다 — 조건이
			// 없으면 못 막으니 결과적으로 켜지는 쪽이고, 그것이 「모른다」를
			// 「아니다」로 쓰지 않는 것이다.
			meta.gap('gift', a.giftId, 'conds',
				`${at} 은 조건이 있다고 적혔는데 뽑힌 조건이 없다`, EVIDENCE);
		}

		abilities.push({
			giftId: a.giftId, level: a.level, ordinal: a.ordinal,
			timing: p.timing, unconditional: p.unconditional, refines, sourceText: p.sourceText,
		});

		for (const c of p.conds) {
			if (c.op !== 'has' && c.threshold === null) {
				// 「N인 이상」인데 N 을 못 찾았다. has 는 수가 아니라 존재를
				// 묻는 것이라 문턱값이 없는 것이 옳다 — 그건 결손이 아니다.
				meta.gap('gift', a.giftId, 'threshold',
					`${at} 조건 ${c.group}/${c.idx}(${c.refKind}/${c.refId}) 의 문턱값을 못 찾았다`, EVIDENCE);
			}
			conds.push({
				giftId: a.giftId, level: a.level, ordinal: a.ordinal,
				group: c.group, idx: c.idx,
				refKind: c.refKind, refId: c.refId, op: c.op, threshold: c.threshold,
				scope: c.scope, supply: c.supply, slot: c.slot,
				runtime: c.runtime, resonanceMode: c.resonanceMode,
			});
		}
	}

	/**
	 * 기프트마다 독립 능력이 하나는 있어야 한다.
	 *
	 * 전부 강화판이면 켜짐 판정에 참여하는 능력이 없어 영영 죽는다. 위에서
	 * 사슬을 끊었으므로 대개는 이미 남아 있지만, 전부가 서로를 가리키는
	 * 경우가 있을 수 있다 — 그때는 가장 앞 ordinal 을 독립으로 만든다.
	 */
	const byGift = new Map<string, AbilityRow[]>();
	for (const r of abilities) {
		const key = `${r.giftId}\t${r.level}`;
		byGift.set(key, [...(byGift.get(key) ?? []), r]);
	}
	for (const [key, rows] of byGift) {
		if (rows.some((r) => r.refines === null)) continue;
		const first = [...rows].sort((a, b) => a.ordinal - b.ordinal)[0];
		meta.gap('gift', first.giftId, 'refines',
			`${key.replace('\t', ' 단계 ')} 의 능력이 전부 강화판이라 켜질 수 없다 — ordinal ${first.ordinal} 을 독립으로 만든다`,
			EVIDENCE);
		first.refines = null;
	}

	return { abilities, conds };
}
