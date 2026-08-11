/**
 * 페이지가 내보낸 판정을 progress.json 에 반영한다.
 *
 * 페이지는 브라우저에 있고 저장소는 여기 있다 — 그 사이를 파일 하나가 잇는다.
 * 사용자가 「내보내기」로 받은 파일을 이 도구가 받아 넣는다.
 *
 * 실행: npm run gift:import -- ~/Downloads/gift-verdicts.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROGRESS = 'src/v2/authored/gift-ability.progress.json';

const src = process.argv[2];
if (src === undefined) {
	console.error('파일을 달라: npm run gift:import -- ~/Downloads/gift-verdicts.json');
	process.exit(1);
}

interface Verdict { state: 'ok' | 'bad'; round: number; why?: string }
interface Progress { round: number; verdicts: Record<string, Verdict> }

const incoming = JSON.parse(readFileSync(src, 'utf8')) as {
	round?: number; verdicts: Record<string, { state: string; why?: string }>;
};
if (incoming.verdicts === undefined) {
	console.error('verdicts 가 없다 — 페이지가 내보낸 파일이 맞는지 확인해라');
	process.exit(1);
}

const progress: Progress = existsSync(PROGRESS)
	? JSON.parse(readFileSync(PROGRESS, 'utf8'))
	: { round: 1, verdicts: {} };

/**
 * **먼저 전부 검사하고 그다음에 쓴다.** 절반만 반영되면 어디까지 들어갔는지
 * 알 수 없어 회차가 꼬인다.
 */
const bad: string[] = [];
for (const [giftId, v] of Object.entries(incoming.verdicts)) {
	if (v.state !== 'ok' && v.state !== 'bad') {
		console.error(`${giftId} 의 판정이 어휘 밖이다: ${v.state}`);
		process.exit(1);
	}
	if (v.state === 'bad') bad.push(giftId);
}

let added = 0;
let changed = 0;
for (const [giftId, v] of Object.entries(incoming.verdicts)) {
	const before = progress.verdicts[giftId];
	if (before === undefined) added += 1;
	else if (before.state !== v.state) changed += 1;
	progress.verdicts[giftId] = {
		state: v.state as 'ok' | 'bad',
		round: incoming.round ?? progress.round,
		...(v.why !== undefined && v.why.trim() !== '' ? { why: v.why } : {}),
	};
}

writeFileSync(PROGRESS, `${JSON.stringify(progress, null, '\t')}\n`, 'utf8');

const total = Object.keys(progress.verdicts).length;
const ok = Object.values(progress.verdicts).filter((v) => v.state === 'ok').length;
console.log(`새로 ${added} · 바뀜 ${changed} · 누적 ${total}`);
console.log(`  맞다   ${ok}`);
console.log(`  틀리다 ${total - ok}`);
if (bad.length > 0) {
	console.log(`\n2차 대상 ${bad.length}건: ${bad.join(' · ')}`);
	console.log('저작을 고친 뒤 그 건을 progress.json 에서 지우면 미판정으로 돌아간다 —');
	console.log('고친 사람이 스스로 「맞다」라고 적으면 검수가 아니다.');
}
