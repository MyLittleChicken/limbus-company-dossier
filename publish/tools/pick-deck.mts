/**
 * 편성 화면 캡처용 표본 덱을 만든다.
 *
 * 수감자 12명마다 가장 높은 등급의 인격 하나와 E.G.O 를 등급별로 골라
 * `StoredDeck` 모양의 JSON 을 stdout 으로 낸다. 화면 검증 목적이며 저장소에 남기지 않는다.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, 'cache');
// 스크래치패드는 프로젝트 밖이라 패키지 이름으로 해석되지 않는다. 절대 경로로 집는다.
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg as { PrismaClient: new () => any };

const db = new PrismaClient();

const EGO_RANKS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const;

const sinners = await db.sinner.findMany({
	orderBy: { id: 'asc' },
	include: {
		identities: { orderBy: [{ rarity: 'desc' }, { id: 'asc' }], select: { id: true } },
		egos: { orderBy: [{ rank: 'asc' }, { id: 'asc' }], select: { id: true, rank: true } },
	},
});

const slots = sinners.map((s) => {
	const egos: Record<string, number> = {};
	for (const rank of EGO_RANKS) {
		const hit = s.egos.find((e) => e.rank === rank);
		if (hit) egos[rank] = hit.id;
	}
	return {
		sinnerId: s.id,
		identityId: s.identities[0]?.id ?? null,
		egos,
	};
});

const deck = {
	id: 'shot-deck',
	name: '캡처 표본',
	slots,
	// 12칸 전부 순서를 갖는다 — 실물 덱 코드가 1..12 순열로 나온다.
	order: sinners.map((s) => s.id),
	// 출전은 최대 7.
	deployed: sinners.slice(0, 7).map((s) => s.id),
	updatedAt: '2026-07-29T00:00:00.000Z',
};

process.stdout.write(JSON.stringify([deck]));
await db.$disconnect();
