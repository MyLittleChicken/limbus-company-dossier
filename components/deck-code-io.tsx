'use client';

import { useState } from 'react';
import { deckFromCode, deckToCode, unverifiedIndexes } from '@/lib/deck-code/codec';
import type { StoredDeck } from '@/lib/storage/schema';

/**
 * 인게임 덱 코드 입출력.
 *
 * 내보내기에 경고가 붙는 경우가 있다 — 순번 16 이상 인격이 든 덱이다. 가이드가 그 구간의
 * 인코딩을 추정만 해뒀고 인게임에서 확인된 적이 없다(07-recommendation-system 7.3).
 * 되는 척하지 않고 미검증임을 밝힌다.
 */
export function DeckCodeIo({
	deck,
	onImport,
	ko,
}: {
	deck: StoredDeck | null;
	onImport: (deck: StoredDeck) => void;
	ko: boolean;
}) {
	const [input, setInput] = useState('');
	const [output, setOutput] = useState('');
	const [message, setMessage] = useState<string | null>(null);

	const unverified = deck ? unverifiedIndexes(deck) : [];

	async function importCode() {
		const r = await deckFromCode(input.trim(), ko ? '가져온 덱' : 'Imported deck');
		if (!r.ok) {
			// lib/deck-code 의 사유 문자열은 한국어 고정이라 헤드라인만 로캘별로 두고
			// 원문은 보조 정보로 붙인다(deck-editor.tsx persist 와 같은 규칙).
			return setMessage(`${ko ? '덱 코드를 가져오지 못했습니다' : 'Could not import the deck code'}: ${r.reason}`);
		}
		setMessage(null);
		onImport(r.value);
	}

	async function exportCode() {
		if (!deck) return;
		try {
			// deckToCode 는 async 이지만 내부 writeBlock 이 필드 폭을 넘는 값에서 동기적으로
			// throw 한다(lib/deck-code/bits.ts writeField) — UI 로는 도달하지 못하는 것으로
			// 보이지만, 안 걸러 두면 onClick 의 void 호출에서 처리되지 않은 거부로 샌다.
			const r = await deckToCode(deck);
			if (!r.ok) {
				return setMessage(`${ko ? '덱 코드를 만들지 못했습니다' : 'Could not create a deck code'}: ${r.reason}`);
			}
			setMessage(null);
			setOutput(r.value);
		} catch (cause) {
			setMessage(`${ko ? '덱 코드를 만들지 못했습니다' : 'Could not create a deck code'}: ${(cause as Error).message}`);
		}
	}

	return (
		<div className="deck-code">
			<label>
				<span>{ko ? '덱 코드 가져오기' : 'Import deck code'}</span>
				<textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} />
			</label>
			<button type="button" className="chip" onClick={() => void importCode()} disabled={input.trim() === ''}>
				{ko ? '가져오기' : 'Import'}
			</button>

			<button type="button" className="chip" onClick={() => void exportCode()} disabled={deck === null}>
				{ko ? '덱 코드 만들기' : 'Export'}
			</button>
			{output !== '' && <textarea rows={2} readOnly value={output} />}

			{unverified.length > 0 && (
				<p className="notice" role="status">
					{ko
						? `인격 ${unverified.join(', ')} 는 캐릭터 내 16번째 이후라 내보낸 코드가 인게임에서 동작하는지 확인되지 않았습니다.`
						: `Identities ${unverified.join(', ')} are past the 16th for their sinner; the exported code is unverified in-game.`}
				</p>
			)}
			{message && <p className="notice" role="alert">{message}</p>}
		</div>
	);
}
