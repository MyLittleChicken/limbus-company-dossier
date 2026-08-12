/**
 * 페이지가 내보낸 판정을 progress.json 에 반영한다.
 *
 * 페이지는 브라우저에 있고 저장소는 여기 있다 — 그 사이를 파일 하나가 잇는다.
 *
 * **판정 단위는 문형 묶음이다.** 456건을 하나씩 보면 하루가 가므로, 같은 문형
 * 묶음에 규칙 하나를 물어 한 번에 판정한다. 「맞다」인 묶음은 그 규칙으로
 * 절을 뽑고, 「틀리다」인 묶음은 서술을 읽어 규칙을 고친다.
 *
 * 실행: npm run gift:import -- ~/Downloads/gift-shape-verdicts.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROGRESS = 'src/v2/authored/gift-ability.progress.json';

const src = process.argv[2];
if (src === undefined) {
	console.error('파일을 달라: npm run gift:import -- ~/Downloads/gift-shape-verdicts.json');
	process.exit(1);
}

interface Verdict { state: 'ok' | 'bad'; round: number; why?: string }
interface Progress { round: number; groups: Record<string, Verdict> }

const incoming = JSON.parse(readFileSync(src, 'utf8')) as {
	round?: number; groups?: Record<string, { state: string; why?: string }>;
};
if (incoming.groups === undefined) {
	console.error('groups 가 없다 — 페이지가 내보낸 파일이 맞는지 확인해라');
	process.exit(1);
}

const progress: Progress = existsSync(PROGRESS)
	? { round: 1, groups: {}, ...JSON.parse(readFileSync(PROGRESS, 'utf8')) }
	: { round: 1, groups: {} };
if (progress.groups === undefined) progress.groups = {};

/**
 * **먼저 전부 검사하고 그다음에 쓴다.** 절반만 반영되면 어디까지 들어갔는지
 * 알 수 없어 회차가 꼬인다.
 */
const bad: Array<[string, string]> = [];
for (const [key, v] of Object.entries(incoming.groups)) {
	if (v.state !== 'ok' && v.state !== 'bad') {
		console.error(`${key} 의 판정이 어휘 밖이다: ${v.state}`);
		process.exit(1);
	}
	if (v.state === 'bad') bad.push([key, (v.why ?? '').trim()]);
}

let added = 0;
let changed = 0;
for (const [key, v] of Object.entries(incoming.groups)) {
	const before = progress.groups[key];
	if (before === undefined) added += 1;
	else if (before.state !== v.state) changed += 1;
	progress.groups[key] = {
		state: v.state as 'ok' | 'bad',
		round: incoming.round ?? progress.round,
		...(v.why !== undefined && v.why.trim() !== '' ? { why: v.why } : {}),
	};
}

writeFileSync(PROGRESS, `${JSON.stringify(progress, null, '\t')}\n`, 'utf8');

const all = Object.entries(progress.groups);
const ok = all.filter(([, v]) => v.state === 'ok').length;
console.log(`새로 ${added} · 바뀜 ${changed} · 누적 ${all.length}묶음`);
console.log(`  맞다   ${ok}묶음  → 이 규칙으로 절을 뽑는다`);
console.log(`  틀리다 ${all.length - ok}묶음`);

if (bad.length > 0) {
	console.log('\n규칙을 고쳐야 할 묶음');
	for (const [key, why] of bad) {
		console.log(`  ${key}`);
		console.log(`    ${why === '' ? '(서술 없음 — 무엇이 틀렸는지 물어야 한다)' : why}`);
	}
}
