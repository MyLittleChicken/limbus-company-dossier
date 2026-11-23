/**
 * 시험 도우미 (자식 프로세스로 돈다) — DB 에 못 닿는 상태에서 모든 도구를 부르고 결과를 JSON 한 줄로 낸다.
 *
 * Prisma 클라이언트는 import 때 DATABASE_URL 을 읽는 전역 하나라, 「DB 장애」는 같은 프로세스
 * 안에서 흉내 낼 수 없다. `server.test.ts` 가 닫힌 포트의 DATABASE_URL 로 이 파일을 띄운다.
 * 파일 이름이 `*.test.ts` 가 아니라 시험 글롭에 직접 잡히지 않는다.
 */
import { connectInMemory } from './test-client';

const CODE_24 = 'H4sIAAAAAAAAE3P1dkyv8Ex3DAx09nDNLHdyLPd0BAJnL8d0EO2f7gyiHEsyAiPDPR2djR0zgxwjHT3LIcKFENWuwY4ZYENcg11dndKdnAI98/29gBK2tgAHpASdYAAAAA==';
const IDS = [10101, 10201, 10301, 10401, 10501];

/** 입력 검증을 통과하는 최소 인자 — 핸들러 안까지 들어가야 DB 장애 경로를 본다. */
export const PROBE_ARGS: Record<string, Record<string, unknown>> = {
	get_build_info: {},
	search: { query: '화상' },
	list_identities: {},
	get_identity: { id: 10101 },
	list_egos: {},
	get_ego: { id: 20101 },
	list_vocab: {},
	list_gifts: {},
	get_gift: { id: 9001 },
	list_packs: {},
	get_pack: { id: '1129' },
	list_floor_packs: {},
	get_dungeon: {},
	list_statuses: {},
	decode_deck_code: { deckCode: CODE_24 },
	analyze_deck: { identityIds: IDS },
	check_gifts: { identityIds: IDS, giftIds: [9001] },
	score_packs: { identityIds: IDS, floor: 1 },
};

const originalError = console.error;
console.error = () => {}; // 서버 로그(원문)는 시험 출력에 섞지 않는다
const client = await connectInMemory();
const names = (await client.listTools()).tools.map((t) => t.name);
const results: Array<{ name: string; isError: boolean; text: string; probed: boolean }> = [];
for (const name of names) {
	const r = await client.callTool({ name, arguments: PROBE_ARGS[name] ?? {} });
	const text = (r.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join('\n');
	results.push({ name, isError: r.isError === true, text, probed: name in PROBE_ARGS });
}
console.error = originalError;
process.stdout.write(`${JSON.stringify(results)}\n`);
process.exit(0);
