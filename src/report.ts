/**
 * 커버리지 게이트.
 *
 * ADR-02 원칙 1 — 매핑되지 않은 입력은 버리지 않고 리포트한다.
 * 변환이 조용히 성공하는 것보다 시끄럽게 실패하는 편이 낫다.
 *
 * 조용한 누락이 위험한 이유는 결과가 그럴듯해 보이기 때문이다. 토큰 하나가 치환표에
 * 없으면 화면에 `[AttackUp]` 이 날 것으로 노출되는데, 행 수는 정상이라 검증을 통과한다.
 */

/** 리포트 한 줄. 무엇이 몇 번 걸렸는지와 대표 사례를 담는다. */
interface Bucket {
	count: number;
	samples: string[];
}

const MAX_SAMPLES = 8;

export class Report {
	/** 변환기가 다루지 못한 입력. 하나라도 있으면 실패로 본다. */
	private readonly failures = new Map<string, Map<string, Bucket>>();
	/** 정상일 수 있으나 눈으로 확인해야 하는 것. 실패로 보지 않는다. */
	private readonly notes = new Map<string, Map<string, Bucket>>();
	private readonly counts = new Map<string, number>();

	/**
	 * 변환기가 처리하지 못한 입력. 표를 갱신해야 하는 종류다.
	 * 이것이 남으면 빌드를 실패로 판정한다.
	 */
	unmapped(category: string, key: string, sample?: string): void {
		add(this.failures, category, key, sample);
	}

	/**
	 * 확인은 필요하나 정상일 수 있는 것. 소스에 없어서 채울 수 없는 결손이나,
	 * 원문 유지가 의도인 표기가 여기 들어간다.
	 */
	note(category: string, key: string, sample?: string): void {
		add(this.notes, category, key, sample);
	}

	/** 산출한 행 수를 기록한다. coverage.json 대조에 쓴다. */
	rows(table: string, n: number): void {
		this.counts.set(table, n);
	}

	get tableCounts(): ReadonlyMap<string, number> {
		return this.counts;
	}

	/** 처리하지 못한 입력이 하나라도 있으면 참. 빌드 실패 판정에 쓴다. */
	get hasUnmapped(): boolean {
		return this.failures.size > 0;
	}

	/** 사람이 읽는 리포트. 행 수 · 확인 항목 · 미분류 입력을 낸다. */
	format(): string {
		const lines: string[] = [];

		lines.push('산출한 테이블');
		const tables = [...this.counts.entries()].sort(([a], [b]) => a.localeCompare(b));
		let total = 0;
		for (const [table, n] of tables) {
			total += n;
			lines.push(`  ${table.padEnd(32)} ${String(n).padStart(7)}`);
		}
		lines.push(`  ${'합계'.padEnd(32)} ${String(total).padStart(7)}`);

		if (this.notes.size > 0) {
			lines.push('');
			lines.push('확인 항목 — 실패는 아니다');
			lines.push(...render(this.notes, 6));
		}

		lines.push('');
		if (!this.hasUnmapped) {
			lines.push('미분류 입력 없음');
		} else {
			lines.push('미분류 입력 — 표를 갱신해야 한다');
			lines.push(...render(this.failures, 20));
		}
		return lines.join('\n');
	}
}

function add(
	target: Map<string, Map<string, Bucket>>,
	category: string,
	key: string,
	sample?: string,
): void {
	let bucket = target.get(category);
	if (!bucket) {
		bucket = new Map();
		target.set(category, bucket);
	}
	let entry = bucket.get(key);
	if (!entry) {
		entry = { count: 0, samples: [] };
		bucket.set(key, entry);
	}
	entry.count += 1;
	if (sample !== undefined && entry.samples.length < MAX_SAMPLES) {
		entry.samples.push(sample);
	}
}

function render(source: Map<string, Map<string, Bucket>>, limit: number): string[] {
	const lines: string[] = [];
	for (const [category, bucket] of source) {
		const entries = [...bucket.entries()].sort((a, b) => b[1].count - a[1].count);
		const occurrences = entries.reduce((sum, [, e]) => sum + e.count, 0);
		lines.push(`  ${category}: ${entries.length}종 / ${occurrences}회`);
		for (const [key, entry] of entries.slice(0, limit)) {
			const sample = entry.samples[0];
			const tail = sample === undefined ? '' : `  예: ${truncate(sample, 60)}`;
			lines.push(`    ${key} (${entry.count})${tail}`);
		}
		if (entries.length > limit) lines.push(`    … 외 ${entries.length - limit}종`);
	}
	return lines;
}

function truncate(text: string, max: number): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
