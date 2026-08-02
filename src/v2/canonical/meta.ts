/**
 * 판정의 부산물을 모은다.
 *
 * field_gap    세 출처 어디에도 없는 것. 값은 NULL 이고 사유가 여기 남는다
 * field_source 이 값이 어디서 어떤 규칙으로 왔나
 *
 * 변환기가 값을 정하는 그 자리에서 함께 적는다. 나중에 몰아서 적으면 근거가 흐려진다.
 */
export interface GapRow {
	entity: string;
	entityId: string;
	field: string;
	locale: string;
	reason: string;
	evidence: string;
}

export interface SourceRow {
	entity: string;
	entityId: string;
	field: string;
	/** mj-only · assets-only · loc-only · union · agreed · disagreed · game-verified · manual */
	rule: string;
	sources: string[];
}

export interface MetaSummary {
	byRule: Record<string, number>;
	gapsByField: Record<string, number>;
}

export class Meta {
	private readonly gapMap = new Map<string, GapRow>();
	private readonly sourceMap = new Map<string, SourceRow>();

	gap(
		entity: string,
		entityId: string,
		field: string,
		reason: string,
		evidence: string,
		locale = '',
	): void {
		const key = `${entity} ${entityId} ${field} ${locale}`;
		this.gapMap.set(key, { entity, entityId, field, locale, reason, evidence });
	}

	source(entity: string, entityId: string, field: string, rule: string, sources: string[]): void {
		const key = `${entity} ${entityId} ${field}`;
		this.sourceMap.set(key, { entity, entityId, field, rule, sources });
	}

	/**
	 * 결손을 해소한다. 수동 보정이 값을 채우면 그 결손은 더 이상 결손이 아니다.
	 * 지우지 않으면 gap-report 가 이미 채운 것을 계속 채우라고 시킨다.
	 */
	resolve(entity: string, entityId: string, field: string, locale = ''): boolean {
		return this.gapMap.delete(`${entity} ${entityId} ${field} ${locale}`);
	}

	get gaps(): GapRow[] {
		return [...this.gapMap.values()];
	}

	get sources(): SourceRow[] {
		return [...this.sourceMap.values()];
	}

	summary(): MetaSummary {
		const byRule: Record<string, number> = {};
		for (const s of this.sourceMap.values()) byRule[s.rule] = (byRule[s.rule] ?? 0) + 1;
		const gapsByField: Record<string, number> = {};
		for (const g of this.gapMap.values()) gapsByField[g.field] = (gapsByField[g.field] ?? 0) + 1;
		return { byRule, gapsByField };
	}
}
