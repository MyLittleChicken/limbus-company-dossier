'use client';

import { useEffect, useState } from 'react';
import { DeckCodeIo } from '@/components/deck-code-io';
import { readDecks, writeDecks } from '@/lib/storage/decks';
import { DECK_MAX, DEPLOY_MAX, EGO_RANKS, emptyDeck, type StoredDeck } from '@/lib/storage/schema';
import type { SquadSinner } from '@/lib/queries/squad';

/**
 * 편성 편집.
 *
 * 수감자 12칸은 고정 축이다. 배열 인덱스가 곧 수감자라 한 수감자에 인격 둘이 들어가는
 * 상태를 만들 수 없다 — 현행 슬라이스 덱(11009·11013이 둘 다 수감자 10)이 그 실수였다.
 *
 * E.G.O 는 등급당 하나이며 **지금은 추천 점수에 반영되지 않는다.** 화면에 그 사실을 적는다.
 * 적지 않으면 입력해 두고 왜 안 바뀌냐는 오해가 남는다(07-recommendation-system 5.1).
 */
export function DeckEditor({ squad, ko }: { squad: SquadSinner[]; ko: boolean }) {
	const [decks, setDecks] = useState<StoredDeck[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		const r = readDecks(window.localStorage);
		if (!r.ok) {
			// 원인 문자열은 lib/storage 산출물이라 한국어 고정이다 — 헤드라인만 로캘별로 두고
			// 원문은 보조 정보로 붙여 실패 사유를 숨기지 않는다.
			return setNotice(`${ko ? '덱을 불러오지 못했습니다' : 'Could not load decks'}: ${r.reason}`);
		}
		setDecks(r.value);
		setActiveId(r.value[0]?.id ?? null);
	}, [ko]);

	const active = decks.find((d) => d.id === activeId) ?? null;

	/**
	 * 저장이 성공했을 때만 화면 상태를 옮긴다 — 실패하면 이전에 실제로 저장된 덱을 그대로
	 * 보여주고 배너로만 알린다. 반환값은 addDeck·removeDeck 이 activeId 를 따라 옮길지
	 * 판단하는 데 쓴다(실패한 새 덱·삭제를 고른 상태처럼 보이게 두지 않기 위해).
	 */
	function persist(next: StoredDeck[]): boolean {
		const r = writeDecks(window.localStorage, next);
		if (!r.ok) {
			setNotice(`${ko ? '덱을 저장하지 못했습니다' : 'Could not save the deck'}: ${r.reason}`);
			return false;
		}
		setNotice(null);
		setDecks(next);
		return true;
	}

	function update(fn: (d: StoredDeck) => void) {
		if (!active) return;
		const next = decks.map((d) => {
			if (d.id !== active.id) return d;
			const copy: StoredDeck = structuredClone(d);
			fn(copy);
			copy.updatedAt = new Date().toISOString();
			return copy;
		});
		persist(next);
	}

	function addDeck() {
		if (decks.length >= DECK_MAX) return setNotice(ko ? `덱은 ${DECK_MAX}개까지입니다` : `Max ${DECK_MAX} decks`);
		const d = emptyDeck(ko ? `덱 ${decks.length + 1}` : `Deck ${decks.length + 1}`);
		// 저장이 실패하면 아직 없는 덱을 고른 것처럼 보이면 안 되므로 activeId 는 건드리지 않는다.
		if (persist([...decks, d])) setActiveId(d.id);
	}

	function removeDeck(id: string) {
		const next = decks.filter((d) => d.id !== id);
		if (persist(next) && activeId === id) setActiveId(next[0]?.id ?? null);
	}

	return (
		<section className="deck-editor">
			{notice && <p className="notice" role="status">{notice}</p>}

			<div className="filters">
				{decks.map((d) => (
					<button
						key={d.id}
						type="button"
						className="chip"
						aria-pressed={d.id === activeId}
						onClick={() => setActiveId(d.id)}
					>
						{d.name}
					</button>
				))}
				<button type="button" className="chip" onClick={addDeck}>
					{ko ? '새 덱' : 'New'}
				</button>
				{active && (
					<button type="button" className="chip" onClick={() => removeDeck(active.id)}>
						{ko ? '삭제' : 'Delete'}
					</button>
				)}
			</div>

			<DeckCodeIo
				deck={active}
				ko={ko}
				onImport={(imported) => {
					if (decks.length >= DECK_MAX) return setNotice(ko ? `덱은 ${DECK_MAX}개까지입니다` : `Max ${DECK_MAX} decks`);
					// 저장이 실패하면 이전에 실제로 선택돼 있던 덱을 그대로 보여줘야 한다 — addDeck 과 같은 규칙.
					if (persist([...decks, imported])) setActiveId(imported.id);
				}}
			/>

			{!active ? (
				<p className="lede">{ko ? '덱을 만들어 편성을 시작합니다.' : 'Create a deck to begin.'}</p>
			) : (
				<>
					<label className="deck-name">
						<span>{ko ? '덱 이름' : 'Deck name'}</span>
						<input
							value={active.name}
							onChange={(e) => update((d) => { d.name = e.target.value; })}
						/>
					</label>

					<p className="lede">
						{ko
							? `출전 ${active.deployed.length}/${DEPLOY_MAX} · E.G.O는 현재 추천 점수에 반영되지 않습니다.`
							: `Deployed ${active.deployed.length}/${DEPLOY_MAX} · E.G.O does not affect scoring yet.`}
					</p>

					<ul className="plain deck-slots">
						{active.slots.map((slot) => {
							const sinner = squad.find((s) => s.id === slot.sinnerId);
							const deployed = active.deployed.includes(slot.sinnerId);
							return (
								<li key={slot.sinnerId} className="deck-slot">
									<strong>{sinner?.text?.name ?? `#${slot.sinnerId}`}</strong>

									<select
										value={slot.identityId ?? ''}
										onChange={(e) =>
											update((d) => {
												const s = d.slots.find((x) => x.sinnerId === slot.sinnerId)!;
												s.identityId = e.target.value === '' ? null : Number(e.target.value);
											})
										}
									>
										<option value="">{ko ? '— 인격 —' : '— Identity —'}</option>
										{sinner?.identities.map((i) => (
											<option key={i.id} value={i.id}>{i.text?.name ?? i.id}</option>
										))}
									</select>

									<div className="ego-slots">
										{EGO_RANKS.map((rank) => {
											const options = sinner?.egos.filter((e) => e.rank === rank) ?? [];
											return (
												<select
													key={rank}
													aria-label={rank}
													disabled={options.length === 0}
													value={slot.egos[rank] ?? ''}
													onChange={(e) =>
														update((d) => {
															const s = d.slots.find((x) => x.sinnerId === slot.sinnerId)!;
															if (e.target.value === '') delete s.egos[rank];
															else s.egos[rank] = Number(e.target.value);
														})
													}
												>
													{/* 선택지가 없는 등급은 결손이 아니라 부재다. 칸은 남기고 비워 둔다. */}
													<option value="">{options.length === 0 ? `${rank} —` : rank}</option>
													{options.map((e) => (
														<option key={e.id} value={e.id}>{e.text?.name ?? e.id}</option>
													))}
												</select>
											);
										})}
									</div>

									<label className="deploy">
										<input
											type="checkbox"
											checked={deployed}
											onChange={() => {
												// 상한을 이미 채운 상태에서 새로 켜려는 시도는 조용히 버리지 않고 알린다
												// (DECK_MAX 초과 시 addDeck 이 배너를 띄우는 것과 같은 규칙).
												if (!deployed && active.deployed.length >= DEPLOY_MAX) {
													setNotice(
														ko ? `출전은 ${DEPLOY_MAX}명까지입니다` : `Max ${DEPLOY_MAX} deployed`,
													);
													return;
												}
												update((d) => {
													const at = d.deployed.indexOf(slot.sinnerId);
													if (at >= 0) d.deployed.splice(at, 1);
													else if (d.deployed.length < DEPLOY_MAX) d.deployed.push(slot.sinnerId);
												});
											}}
										/>
										{ko ? '출전' : 'Deploy'}
									</label>
								</li>
							);
						})}
					</ul>
				</>
			)}
		</section>
	);
}
