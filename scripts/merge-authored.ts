/**
 * 뽑은 조건을 저작 파일에 합친다. **손으로 쓴 것이 이긴다.**
 *
 * 자동 추출은 문장에서 읽어낼 수 있는 것만 낸다. 「(편성된 수 - 2)만큼 얻음」을
 * 「혈귀 3명 문턱」으로 옮기는 것 같은 판단은 사람만 한다 — 그런 자리는 씨앗이
 * 이미 손으로 적혀 있고, 합칠 때 자동이 그것을 덮으면 안 된다.
 *
 * `origin` 을 남긴다 — `hand` 는 사람이 쓴 것, `auto` 는 뽑은 것. 검수 페이지가
 * 이 표시로 「아직 사람이 안 본 자리」를 가려낸다.
 *
 * 실행: npm run gift:merge -- --conds /tmp/conds.jsonl
 */
import { readFileSync, writeFileSync } from 'node:fs';

const AUTHORED = 'src/v2/authored/gift-ability.jsonl';
const argv = process.argv.slice(2);
const condsPath = argv.indexOf('--conds') >= 0 ? argv[argv.indexOf('--conds') + 1] : '/tmp/conds.jsonl';

interface Cond {
	group: number; idx: number; refKind: string; refId: string; op: string;
	threshold: number | null; scope: string; supply: string;
	slot: number | null; runtime: boolean; resonanceMode: string | null;
}
interface Extracted {
	giftId: string; level: number; ordinal: number; klass: string;
	sourceText: string; refines: number | null; tier: number | null;
	conds: Cond[]; unconditional: boolean; gaps: string[];
}
interface Authored {
	giftId: string; level: number; ordinal: number;
	payload: { timing: string; unconditional: boolean; refines: number | null; sourceText: string; conds: Cond[] };
	note: string;
	origin?: string;
}

const readJsonl = <T>(p: string): T[] =>
	readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l !== '')
		.map((l) => JSON.parse(l) as T);

const extracted = readJsonl<Extracted>(condsPath);
/**
 * **`origin === 'hand'` 인 것만 지킨다.**
 *
 * 예전에는 저작 파일에 있는 모든 행을 「손」으로 쳤다. 그러면 한 번 적재한 뒤로
 * 자동 행이 영영 안 바뀐다 — 추출기를 고쳐도 병합이 전부 건너뛰기 때문이다.
 * 실제로 그렇게 굳어 있었다(재실행 시 「새로 더함 0 · 건너뜀 1274」).
 *
 * 자동 행은 추출기가 다시 만들면 되는 것이고, 사람이 쓴 20행만 지키면 된다.
 */
const previous = readJsonl<Authored>(AUTHORED);
const hand = previous.filter((h) => h.origin === 'hand');
const handKeys = new Set(hand.map((h) => `${h.giftId}\t${h.level}\t${h.ordinal}`));
/** 손으로 쓴 기프트는 **통째로** 지킨다 — 절 개수까지 사람이 정한 것이다 */
const handGifts = new Set(hand.map((h) => `${h.giftId}\t${h.level}`));

/** 발동 시점을 문장 머리에서 읽는다. 못 읽으면 'none' — 지어내지 않는다 */
const timingOf = (s: string): string => {
	const t = s.replace(/⏎/g, ' ');
	if (/스테이지 시작|스테이지 첫 턴|층 (진입|보스)/.test(t)) return 'floor_start';
	if (/전투 시작|웨이브 첫 턴/.test(t)) return 'combat_start';
	if (/턴 시작/.test(t)) return 'turn_start';
	if (/턴 종료/.test(t)) return 'turn_end';
	if (/처치|사망/.test(t)) return 'on_kill';
	if (/합 승리|합 패배|합을 진행|합 진행/.test(t)) return 'on_clash';
	if (/적중/.test(t)) return 'on_hit';
	if (/사용 시|사용할 경우|사용하여/.test(t)) return 'on_use';
	return 'none';
};

const merged: Authored[] = [...hand.map((h) => ({ ...h, origin: h.origin ?? 'hand' }))];
let added = 0;
let skipped = 0;

for (const e of extracted) {
	if (handGifts.has(`${e.giftId}\t${e.level}`)) { skipped += 1; continue; }
	if (handKeys.has(`${e.giftId}\t${e.level}\t${e.ordinal}`)) { skipped += 1; continue; }
	const note = e.gaps.length > 0
		? `자동 추출 (${e.klass}). 결손: ${e.gaps.join(' / ')}`
		: `자동 추출 (${e.klass})`;
	merged.push({
		giftId: e.giftId, level: e.level, ordinal: e.ordinal,
		payload: {
			timing: timingOf(e.sourceText),
			unconditional: e.unconditional,
			refines: e.refines,
			sourceText: e.sourceText,
			conds: e.conds.map((c, i) => ({ ...c, idx: i })),
		},
		note,
		origin: 'auto',
	});
	added += 1;
}

merged.sort((a, b) =>
	a.giftId.localeCompare(b.giftId) || a.level - b.level || a.ordinal - b.ordinal);

writeFileSync(AUTHORED, `${merged.map((m) => JSON.stringify(m)).join('\n')}\n`, 'utf8');

const auto = merged.filter((m) => m.origin === 'auto').length;
const withGap = merged.filter((m) => m.note.includes('결손')).length;
console.log(`저작 ${merged.length}행 — 손 ${merged.length - auto} · 자동 ${auto}`);
console.log(`  새로 더함 ${added} · 손이 이겨서 건너뜀 ${skipped}`);
console.log(`  결손 메모가 붙은 절 ${withGap}`);
console.log(`→ ${AUTHORED}`);
