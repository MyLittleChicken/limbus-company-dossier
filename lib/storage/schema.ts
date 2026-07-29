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

/**
 * 덱 id.
 *
 * `crypto.randomUUID` 는 브라우저에서 **보안 컨텍스트**(HTTPS · localhost)에서만 있다.
 * 배포 환경이 아직 미결이라(adr/05 3.5) 평문 HTTP 로 서비스될 가능성을 배제할 수 없고,
 * 그때 `emptyDeck` 이 던지면 편성 화면이 통째로 죽는다. 없으면 물러선다 — id 는 우리
 * 저장소 안에서만 유일하면 되고 암호학적 성질이 필요하지 않다.
 */
function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDeck(name: string, id = newId()): StoredDeck {
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

/** EGO_RANKS 는 as const 튜플이라 원소 타입이 좁다 — 임의 문자열 키를 그대로 물어보려면 배열로 눌러야 한다. */
const isEgoRank = (v: string): v is EgoRank => (EGO_RANKS as readonly string[]).includes(v);

/**
 * `raw` 를 그대로 `StoredDeck` 으로 캐스팅해 돌려주지 않는다 — 캐스팅은 검증하지 않은 필드에도
 * 타입이 보장하는 모양을 거짓으로 씌운다(잘못된 데이터를 멀쩡한 모양으로 뭉개는 것과 같다).
 * 검사를 통과한 값만 모아 새 객체를 조립해 돌려준다.
 */
export function parseDeck(raw: unknown): Result<StoredDeck> {
	if (typeof raw !== 'object' || raw === null) return err('덱이 객체가 아니다');
	const d = raw as Record<string, unknown>;
	if (typeof d['id'] !== 'string' || typeof d['name'] !== 'string') return err('id·name 이 없다');
	if (!Array.isArray(d['slots']) || d['slots'].length !== SINNER_COUNT) {
		return err(`칸이 ${SINNER_COUNT}개가 아니다`);
	}

	const seenSinnerIds = new Set<number>();
	const slots: DeckSlot[] = [];
	for (const s of d['slots'] as unknown[]) {
		if (typeof s !== 'object' || s === null) return err('칸이 객체가 아니다');
		const slot = s as Record<string, unknown>;

		const sinnerId = slot['sinnerId'];
		if (!isInt(sinnerId) || sinnerId < 1 || sinnerId > SINNER_COUNT) {
			return err('수감자 id 가 1..12 범위를 벗어난다');
		}
		if (seenSinnerIds.has(sinnerId)) return err('수감자 id 가 중복된다');
		seenSinnerIds.add(sinnerId);

		const identityId = slot['identityId'];
		if (identityId !== null && !isInt(identityId)) return err('인격 id 가 정수가 아니다');

		if (typeof slot['egos'] !== 'object' || slot['egos'] === null) return err('E.G.O 가 객체가 아니다');
		const egos: Partial<Record<EgoRank, number>> = {};
		for (const [rank, egoId] of Object.entries(slot['egos'] as Record<string, unknown>)) {
			if (!isEgoRank(rank)) return err(`E.G.O 등급이 아니다: ${rank}`);
			if (!isInt(egoId)) return err('E.G.O id 가 정수가 아니다');
			egos[rank] = egoId;
		}

		slots.push({ sinnerId, identityId, egos });
	}

	if (!Array.isArray(d['deployed']) || d['deployed'].length > DEPLOY_MAX) {
		return err(`출전이 ${DEPLOY_MAX}명을 넘는다`);
	}
	const seenDeployed = new Set<number>();
	const deployed: number[] = [];
	for (const v of d['deployed'] as unknown[]) {
		if (!isInt(v) || v < 1 || v > SINNER_COUNT) return err('출전 id 가 1..12 범위를 벗어난다');
		if (seenDeployed.has(v)) return err('출전 id 가 중복된다');
		seenDeployed.add(v);
		deployed.push(v);
	}

	if (typeof d['updatedAt'] !== 'string') return err('updatedAt 이 없다');

	return ok({ id: d['id'], name: d['name'], slots, deployed, updatedAt: d['updatedAt'] });
}
