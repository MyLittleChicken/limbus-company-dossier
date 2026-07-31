/**
 * 원본 JSON 파일 하나를 개체 목록으로 푼다.
 *
 * 판정하지 않는다. 값을 고치지 않는다. 모양만 보고 개체 경계와 id 를 정한다.
 * 실측한 모양은 넷뿐이며 예외가 없다(스펙 2.2).
 *
 *   {dataList: [...]}   796파일   loc 계열 전부
 *   dict[id → obj]       34       assets 계열
 *   list[obj]             7       mj 거대 파일
 *   단일 객체            827       *-details/ · encounters/ · 설정형
 */
import { readFileSync } from 'node:fs';
import { listEntityFiles, parseEntityPath } from './paths.js';

export type Shape = 'dataList' | 'map' | 'list' | 'single';

export interface ScannedObject {
	/** 기본키의 일부. 숫자 id 도 문자열로 정규화한다 */
	id: string;
	/** 손대지 않은 원본 값 */
	payload: unknown;
}

export interface ScannedFile {
	shape: Shape;
	objects: ScannedObject[];
}

/** 평범한 객체인가. 배열과 null 을 제외한다. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 배열 원소에서 id 를 뽑는다. 없으면 순번으로 대체한다.
 *
 * 실측 190건이 순번으로 간다 — identity_tag_list 174 · start_gifts 10 ·
 * a1c5p2 계열 빈 객체 6. 셋 다 마스터북이 기록한 것이다.
 */
function idOfElement(el: unknown, index: number): string {
	if (isPlainObject(el) && el['id'] !== undefined && el['id'] !== null) {
		return String(el['id']);
	}
	return `#${index}`;
}

export function extractObjects(parsed: unknown, stem: string): ScannedFile {
	if (Array.isArray(parsed)) {
		return {
			shape: 'list',
			objects: parsed.map((el, i) => ({ id: idOfElement(el, i), payload: el })),
		};
	}

	if (isPlainObject(parsed)) {
		const dataList = parsed['dataList'];
		if (Array.isArray(dataList)) {
			return {
				shape: 'dataList',
				objects: dataList.map((el, i) => ({ id: idOfElement(el, i), payload: el })),
			};
		}
		const values = Object.values(parsed);
		if (values.length > 0 && values.every(isPlainObject)) {
			return {
				shape: 'map',
				objects: Object.entries(parsed).map(([k, v]) => ({ id: k, payload: v })),
			};
		}
	}

	// 나머지는 전부 단일 객체다. 파일 하나가 개체 하나이고 파일명이 id 다.
	return { shape: 'single', objects: [{ id: stem, payload: parsed }] };
}

/**
 * JSON 을 읽는다. **BOM 을 벗긴다.**
 *
 * 마스터북 거울 던전 편이 BOM 붙은 파일 4종을 찾았다. `JSON.parse` 는 BOM 을
 * 만나면 던진다.
 */
export function readJsonFile(absPath: string): unknown {
	const text = readFileSync(absPath, 'utf8').replace(/^﻿/, '');
	return JSON.parse(text);
}

/** 적재 한 행. `snapshotId` 는 적재기가 붙인다. */
export interface RawRow {
	source: string;
	srcPath: string;
	id: string;
	entity: string;
	payload: unknown;
}

export interface ScanResult {
	rows: RawRow[];
	shapeCounts: Record<Shape, number>;
	fileCount: number;
}

/**
 * `data/entities` 전량을 훑어 개체 행으로 푼다.
 *
 * 파일 하나라도 파싱에 실패하면 던진다. 원본 결함은 값의 문제이지 문법의 문제가
 * 아니므로(마스터북 §6 원본 결함 31건은 전부 파싱을 통과한다) 파싱 실패는
 * 수집이 깨졌다는 뜻이다.
 */
export function scanAll(): ScanResult {
	const files = listEntityFiles();
	const rows: RawRow[] = [];
	const shapeCounts: Record<Shape, number> = { dataList: 0, map: 0, list: 0, single: 0 };

	for (const abs of files) {
		const { entity, source, srcPath, stem } = parseEntityPath(abs);
		let parsed: unknown;
		try {
			parsed = readJsonFile(abs);
		} catch (cause) {
			throw new Error(`JSON 파싱 실패: ${srcPath}`, { cause });
		}
		const scanned = extractObjects(parsed, stem);
		shapeCounts[scanned.shape] += 1;
		for (const obj of scanned.objects) {
			rows.push({ source, srcPath, id: obj.id, entity, payload: obj.payload });
		}
	}

	return { rows, shapeCounts, fileCount: files.length };
}
