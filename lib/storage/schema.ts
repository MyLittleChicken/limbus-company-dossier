import { ok, err, type Result } from './kv';

/**
 * 브라우저에 저장하는 것의 모양.
 *
 * 버전을 박아두는 이유는 나중에 모양이 바뀔 때 **버리지 않고 알리기** 위해서다.
 * 조용히 폐기하면 사용자가 짜둔 덱이 사라진 줄도 모르고 없어진다(07-recommendation-system 4.2).
 */
export const SCHEMA_VERSION = 1;

/** 게임의 E.G.O 등급. ALEPH 는 슬롯만 있고 출시분이 없다 — 결손이 아니라 부재다. */
export const EGO_RANKS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const;
export type EgoRank = (typeof EGO_RANKS)[number];

export const SINNER_COUNT = 12;
export const DEPLOY_MAX = 7;
export const DECK_MAX = 10;

export interface DeckSlot {
	sinnerId: number;
	identityId: number | null;
	/** 등급당 하나. 레코드로 두면 위반이 표현 불가능해진다. */
	egos: Partial<Record<EgoRank, number>>;
}

export interface StoredDeck {
	id: string;
	name: string;
	slots: DeckSlot[];
	/** 출전 수감자 id. 순서가 곧 편성 순서다. */
	deployed: number[];
	updatedAt: string;
}

export interface StoredRun {
	deckId: string;
	difficulty: 'normal' | 'hard';
	floors: Array<{ floor: number; pickedPackId: string | null; gainedGiftIds: number[] }>;
	startedAt: string;
}

export function emptyDeck(name: string, id = crypto.randomUUID()): StoredDeck {
	return {
		id,
		name,
		slots: Array.from({ length: SINNER_COUNT }, (_, i) => ({
			sinnerId: i + 1,
			identityId: null,
			egos: {},
		})),
		deployed: [],
		updatedAt: new Date().toISOString(),
	};
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function parseDeck(raw: unknown): Result<StoredDeck> {
	if (typeof raw !== 'object' || raw === null) return err('덱이 객체가 아니다');
	const d = raw as Record<string, unknown>;
	if (typeof d['id'] !== 'string' || typeof d['name'] !== 'string') return err('id·name 이 없다');
	if (!Array.isArray(d['slots']) || d['slots'].length !== SINNER_COUNT) {
		return err(`칸이 ${SINNER_COUNT}개가 아니다`);
	}
	for (const s of d['slots'] as unknown[]) {
		if (typeof s !== 'object' || s === null) return err('칸이 객체가 아니다');
		const slot = s as Record<string, unknown>;
		if (!isInt(slot['sinnerId'])) return err('수감자 id 가 정수가 아니다');
		if (slot['identityId'] !== null && !isInt(slot['identityId'])) return err('인격 id 가 정수가 아니다');
		if (typeof slot['egos'] !== 'object' || slot['egos'] === null) return err('E.G.O 가 객체가 아니다');
	}
	if (!Array.isArray(d['deployed']) || d['deployed'].length > DEPLOY_MAX) {
		return err(`출전이 ${DEPLOY_MAX}명을 넘는다`);
	}
	if (typeof d['updatedAt'] !== 'string') return err('updatedAt 이 없다');
	return ok(raw as StoredDeck);
}
