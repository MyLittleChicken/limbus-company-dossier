import { z } from 'zod';
import { ok, err, type Result } from '@/lib/storage/kv';
import { DEPLOY_MAX, EGO_RANKS, SINNER_COUNT } from '@/lib/storage/schema';
import { deckFromCode } from '@/lib/deck-code/codec';
import { sinnerOf, indexOf } from '@/lib/deck-code/layout';
import type { Squad } from '@/lib/engine/v2/types';

/**
 * MCP 엔진 도구들이 공유하는 덱 입력과 그 해석.
 *
 * 덱은 둘 중 하나로 받는다(설계 §6.2).
 *   deckCode      게임 덱 코드. 편성 순서와 인격·E.G.O 가 다 들어 있다
 *   identityIds   편성 인격 id 목록(최대 12). 목록 차례가 편성 순서다
 *
 * **출격은 편성 순서의 앞 7 이다** — 2026-11-23 게임 편성창 캡처(편성 #24)와 대조했다.
 * `deployedIds` 를 주면 그 규칙보다 우선한다(덱 코드와 함께 줘도 된다).
 */

const MAX_ROSTER = SINNER_COUNT;
const MAX_EGOS = SINNER_COUNT * EGO_RANKS.length;

/**
 * 도구 inputSchema 에 **펼쳐 넣는** zod 원시 shape.
 *
 * ```ts
 * server.registerTool('analyze_deck', { inputSchema: { ...deckInputShape, locale: z.enum(LOCALES).optional() } }, …)
 * ```
 *
 * 「deckCode 와 identityIds 중 정확히 하나」는 shape 로 표현하지 않는다 — refine 을 단 객체는
 * 펼칠 수 없다. 그 검사는 `resolveDeck` 이 하고, 어기면 `err` 로 돌려준다.
 */
export const deckInputShape = {
	deckCode: z.string().min(1).optional()
		.describe('게임 덱 코드. identityIds 와 함께 주지 않는다'),
	identityIds: z.array(z.number().int()).min(1).max(MAX_ROSTER).optional()
		.describe('편성 인격 id(1SSII) 목록, 최대 12. 차례가 편성 순서다. 수감자당 하나'),
	egoIds: z.array(z.number().int()).max(MAX_EGOS).optional()
		.describe('장착 E.G.O id(2SSII). identityIds 와만 쓴다 — 덱 코드는 E.G.O 를 이미 담는다'),
	deployedIds: z.array(z.number().int()).min(1).max(DEPLOY_MAX).optional()
		.describe('출격 인격 id, 최대 7. 생략하면 편성 순서 앞 7 이 출격'),
};

/** 같은 shape 의 z.object. 도구 밖에서 통째로 parse 할 때 쓴다(펼칠 때는 `deckInputShape`). */
export const deckInputSchema = z.object(deckInputShape);

/** 스키마가 parse 한 모양. 모든 필드가 선택이다 — 조합 검사는 `resolveDeck` 몫. */
export type DeckInputArgs = z.infer<typeof deckInputSchema>;

/** 타입 수준의 덱 입력. 도구가 parse 한 `DeckInputArgs` 도 `resolveDeck` 이 그대로 받는다. */
export type DeckInput =
	| { deckCode: string; deployedIds?: number[]; identityIds?: undefined; egoIds?: undefined }
	| { identityIds: number[]; egoIds?: number[]; deployedIds?: number[]; deckCode?: undefined };

export interface ResolvedDeck {
	/** 엔진 입력. roster 는 편성 순서, field 는 출격(편성 순서대로) */
	squad: Squad;
	/** 인격 id, 편성 순서 */
	order: number[];
	/** 출격 인격 id, 편성 순서대로 */
	field: number[];
	/** 대기 인격 id, 편성 순서대로 */
	waiting: number[];
	/**
	 * 장착 E.G.O id 전부. 인격별로 편성 순서대로 묶인다. 묶음 안의 차례는 경로마다 다르다 —
	 * 덱 코드 경로는 등급 순(ZAYIN → ALEPH), identityIds 경로는 `egoIds` 입력 순.
	 */
	egoIds: number[];
}

/** `1SSII` — 수감자 01..12, 순번 01..99 */
const isIdentityId = (id: number): boolean =>
	Number.isInteger(id) && Math.floor(id / 10000) === 1
	&& sinnerOf(id) >= 1 && sinnerOf(id) <= SINNER_COUNT && indexOf(id) >= 1;

/** `2SSII` */
const isEgoId = (id: number): boolean =>
	Number.isInteger(id) && Math.floor(id / 10000) === 2
	&& sinnerOf(id) >= 1 && sinnerOf(id) <= SINNER_COUNT && indexOf(id) >= 1;

const dup = (ids: number[]): number | undefined => ids.find((v, i) => ids.indexOf(v) !== i);

export async function resolveDeck(input: DeckInput | DeckInputArgs): Promise<Result<ResolvedDeck>> {
	const hasCode = input.deckCode !== undefined;
	const hasIds = input.identityIds !== undefined;
	if (hasCode === hasIds) return err('deckCode 와 identityIds 중 정확히 하나를 준다');

	// 편성 순서의 인격과, 인격별 장착 E.G.O.
	let order: number[];
	const egosOf = new Map<number, number[]>();

	if (hasCode) {
		if (input.egoIds !== undefined) return err('egoIds 는 identityIds 와만 쓴다 — 덱 코드가 E.G.O 를 담는다');
		const deck = await deckFromCode(input.deckCode!, 'mcp');
		if (!deck.ok) return deck;
		order = [];
		// 편성 순서(order)에 든 수감자만 편성이다. 순서 0 인 칸은 게임이 미편성으로 읽는다.
		for (const sinnerId of deck.value.order) {
			const slot = deck.value.slots.find((s) => s.sinnerId === sinnerId);
			if (!slot || slot.identityId === null) continue;
			order.push(slot.identityId);
			egosOf.set(slot.identityId, EGO_RANKS.flatMap((r) => (slot.egos[r] === undefined ? [] : [slot.egos[r]!])));
		}
		if (order.length === 0) return err('덱 코드에 편성된 인격이 없다');
	} else {
		order = [...input.identityIds!];
		if (order.length === 0) return err('identityIds 가 비었다');
		if (order.length > MAX_ROSTER) return err(`편성은 ${MAX_ROSTER}명까지다: ${order.length}`);
		const bad = order.find((id) => !isIdentityId(id));
		if (bad !== undefined) return err(`인격 id 형식(1SSII)이 아니다: ${bad}`);
		const seen = new Map<number, number>();
		for (const id of order) {
			const s = sinnerOf(id);
			const prev = seen.get(s);
			if (prev !== undefined) return err(`한 수감자에 인격 둘: ${prev} · ${id} (편성은 수감자당 하나)`);
			seen.set(s, id);
			egosOf.set(id, []);
		}

		const egoIds = input.egoIds ?? [];
		const badEgo = egoIds.find((id) => !isEgoId(id));
		if (badEgo !== undefined) return err(`E.G.O id 형식(2SSII)이 아니다: ${badEgo}`);
		const dupEgo = dup(egoIds);
		if (dupEgo !== undefined) return err(`E.G.O id 가 중복된다: ${dupEgo}`);
		for (const e of egoIds) {
			const owner = seen.get(sinnerOf(e));
			if (owner === undefined) return err(`E.G.O ${e} 의 수감자가 편성에 없다`);
			const list = egosOf.get(owner)!;
			// 등급당 하나라 수감자당 최대 5. 등급은 id 로 알 수 없어(DB 필요) 개수만 본다.
			if (list.length >= EGO_RANKS.length) {
				return err(`수감자 ${sinnerOf(e)} 의 E.G.O 가 ${EGO_RANKS.length}개를 넘는다`);
			}
			list.push(e);
		}
	}

	let field: number[];
	if (input.deployedIds !== undefined) {
		const deployed = input.deployedIds;
		if (deployed.length === 0) return err('deployedIds 가 비었다');
		if (deployed.length > DEPLOY_MAX) return err(`출격은 ${DEPLOY_MAX}명까지다: ${deployed.length}`);
		const dupDep = dup(deployed);
		if (dupDep !== undefined) return err(`deployedIds 가 중복된다: ${dupDep}`);
		const outside = deployed.find((id) => !order.includes(id));
		if (outside !== undefined) return err(`출격 인격 ${outside} 이 편성에 없다`);
		// Squad.field 는 편성 순서대로다 — 준 차례가 아니라 편성 차례로 맞춘다.
		const set = new Set(deployed);
		field = order.filter((id) => set.has(id));
	} else {
		field = order.slice(0, DEPLOY_MAX);
	}
	const fieldSet = new Set(field);
	const waiting = order.filter((id) => !fieldSet.has(id));

	return ok({
		squad: {
			roster: order.map((id) => ({ identityId: String(id), egoIds: (egosOf.get(id) ?? []).map(String) })),
			field: field.map(String),
		},
		order,
		field,
		waiting,
		egoIds: order.flatMap((id) => egosOf.get(id) ?? []),
	});
}
