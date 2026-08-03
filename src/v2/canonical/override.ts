/**
 * 수동 보정을 canonical 위에 덮는다.
 *
 * **적재의 마지막 단계다.** 순서가 중요하다(스펙 4.1).
 *
 *   1. raw 재적재
 *   2. canonical 재계산 (판정 적용)
 *   3. app.field_override 를 덮는다      ← 여기
 *   4. 덮인 것은 field_source.rule = 'manual' 로 기록
 *
 * app 스키마는 TRUNCATE 범위 밖이라 재적재에 살아남는다. 그것이 층을 가른 이유다.
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'app.field_override';

export interface OverrideRow {
	entity: string;
	entityId: string;
	field: string;
	/** 로케일 무관이면 빈 문자열 */
	locale: string;
	value: unknown;
	note: string;
}

export interface TextSpec {
	/** 어느 계열의 보정인가 */
	entity: string;
	/** 행에서 개체 id 를 담는 키 이름 */
	idKey: string;
	/** 행에서 값을 담는 키 이름 */
	field: string;
}

export interface ColumnSpec {
	entity: string;
	idKey: string;
	/**
	 * 덮을 컬럼 이름 목록. 주지 않으면 그 계열의 보정 전부를 덮는다.
	 *
	 * **한 계열이 본체 컬럼과 텍스트를 함께 보정할 때 필요하다.** 기프트는
	 * `hardOnly`(본체)와 `name`(로케일 텍스트)을 같은 `entity='gift'` 로 적는데,
	 * 거르지 않으면 `name` 보정이 gift 행에 없는 컬럼으로 들어가 적재가 깨진다.
	 */
	fields?: string[];
}

/** 이 보정이 이 계열·이 필드를 가리키나. */
function matches(o: OverrideRow, entity: string, field?: string): boolean {
	if (o.entity !== entity) return false;
	return field === undefined || o.field === field;
}

/**
 * 로케일별 텍스트 행을 덮는다. **없으면 만든다** — 결손을 채우는 것이 주 용도다.
 */
export function applyTextOverrides<T extends object>(
	rows: T[],
	overrides: OverrideRow[],
	spec: TextSpec,
	meta: Meta,
): T[] {
	const out = [...rows];
	const indexOf = new Map<string, number>();
	const at_ = (r: T, k: string): unknown => (r as Record<string, unknown>)[k];
	out.forEach((r, i) => indexOf.set(`${String(at_(r, spec.idKey))} ${String(at_(r, 'locale'))}`, i));

	for (const o of overrides) {
		if (!matches(o, spec.entity, spec.field)) continue;
		if (typeof o.value !== 'string') {
			meta.gap(
				spec.entity,
				o.entityId,
				'override',
				`보정 값이 문자열이 아니다 (${typeof o.value})`,
				EVIDENCE,
				o.locale,
			);
			continue;
		}
		const key = `${o.entityId} ${o.locale}`;
		const at = indexOf.get(key);
		if (at === undefined) {
			const row = {
				[spec.idKey]: o.entityId,
				locale: o.locale,
				[spec.field]: o.value,
			} as unknown as T;
			indexOf.set(key, out.length);
			out.push(row);
		} else {
			out[at] = { ...(out[at] as T), [spec.field]: o.value };
		}
		meta.source(spec.entity, o.entityId, `${spec.field}.${o.locale}`, 'manual', ['manual']);
		// 채웠으므로 더 이상 결손이 아니다
		meta.resolve(spec.entity, o.entityId, spec.field, o.locale);
	}
	return out;
}

/**
 * 본체 컬럼을 덮는다. **없는 행은 만들지 않는다** — 개체 자체를 사람이 만드는 것은
 * 이 계층의 일이 아니다.
 */
export function applyColumnOverrides<T extends object>(
	rows: T[],
	overrides: OverrideRow[],
	spec: ColumnSpec,
	meta: Meta,
): T[] {
	const out = [...rows];
	const indexOf = new Map<string, number>();
	out.forEach((r, i) => indexOf.set(String((r as Record<string, unknown>)[spec.idKey]), i));

	for (const o of overrides) {
		if (!matches(o, spec.entity)) continue;
		if (spec.fields !== undefined && !spec.fields.includes(o.field)) continue;
		const at = indexOf.get(o.entityId);
		if (at === undefined) {
			meta.gap(
				spec.entity,
				o.entityId,
				'override',
				`보정이 가리키는 개체가 없다 (${o.field})`,
				EVIDENCE,
			);
			continue;
		}
		out[at] = { ...(out[at] as T), [o.field]: o.value };
		meta.source(spec.entity, o.entityId, o.field, 'manual', ['manual']);
		meta.resolve(spec.entity, o.entityId, o.field, o.locale);
	}
	return out;
}
