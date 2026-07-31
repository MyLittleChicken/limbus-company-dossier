/**
 * 수감자 12명과 소속 64종.
 *
 * 수감자 이름은 별도 파일이 없다 — `star = 1` 인 LCB 기본 인격의 이름이 곧
 * 수감자 이름이다(10101 이상 · 10201 파우스트 · 10301 돈키호테 …).
 *
 * 소속은 mj `associations.json` 이 유일 출처이며 ko·en 만 갖는다. 일본어는
 * `loc-ja` 의 `UnitKeyword_<코드>` 에서 온다(마스터북 인격 편 회차 13).
 */
import { num, str, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const EVIDENCE = 'docs/data/identity/00-overview.md';

export interface SinnerInput {
	mjIdentities: RawIndex;
	associations: RawIndex;
	/** loc-ja 의 UnitKeyword 계열. 소속 일본어명이 여기 있다 */
	unitKeywordJa: RawIndex;
}

export interface SinnerRow {
	id: number;
}

export interface SinnerTextRow {
	sinnerId: number;
	locale: 'ko' | 'en' | 'ja';
	name: string;
}

export interface AssociationRow {
	id: string;
}

export interface AssociationTextRow {
	associationId: string;
	locale: 'ko' | 'en' | 'ja';
	name: string;
}

export interface SinnerTables {
	sinner: SinnerRow[];
	sinnerText: SinnerTextRow[];
	association: AssociationRow[];
	associationText: AssociationTextRow[];
}

export function buildSinners(input: SinnerInput, meta: Meta): SinnerTables {
	const sinner: SinnerRow[] = [];
	const sinnerText: SinnerTextRow[] = [];

	// 수감자별 기본 인격을 찾는다. star = 1 이 LCB 기본 인격이다.
	const baseOf = new Map<number, Record<string, unknown>>();
	const seen = new Set<number>();
	for (const identity of input.mjIdentities.values()) {
		const sid = num(identity, 'sinnerId');
		if (sid === null) continue;
		seen.add(sid);
		if (num(identity, 'star') === 1) baseOf.set(sid, identity);
	}

	for (const sid of [...seen].sort((a, b) => a - b)) {
		const base = baseOf.get(sid);
		if (base === undefined) {
			meta.gap(
				'sinner',
				String(sid),
				'name',
				'star=1 인 LCB 기본 인격이 없어 이름을 얻지 못한다',
				EVIDENCE,
			);
			continue;
		}
		sinner.push({ id: sid });
		const ko = str(base, 'nameKo');
		const en = str(base, 'name');
		if (ko !== null) sinnerText.push({ sinnerId: sid, locale: 'ko', name: ko });
		if (en !== null) sinnerText.push({ sinnerId: sid, locale: 'en', name: en });
		meta.source('sinner', String(sid), 'name', 'mj-only', [MJ]);
	}

	// ── 소속 ─────────────────────────────────────────────────────
	const association: AssociationRow[] = [];
	const associationText: AssociationTextRow[] = [];

	for (const [id, o] of input.associations) {
		association.push({ id });
		const ko = str(o, 'nameKo');
		const en = str(o, 'name');
		if (ko !== null) associationText.push({ associationId: id, locale: 'ko', name: ko });
		if (en !== null) associationText.push({ associationId: id, locale: 'en', name: en });

		// 일본어는 mj 에 없다. UnitKeyword 계열에서 찾는다.
		const ja = str(input.unitKeywordJa.get(`UnitKeyword_${id}`) ?? {}, 'content');
		if (ja === null) {
			meta.gap('association', id, 'name', '일본어 표시명이 어느 출처에도 없다', EVIDENCE, 'ja');
		} else {
			associationText.push({ associationId: id, locale: 'ja', name: ja });
		}
		meta.source('association', id, 'name', 'mj-only', [MJ]);
	}

	return { sinner, sinnerText, association, associationText };
}
