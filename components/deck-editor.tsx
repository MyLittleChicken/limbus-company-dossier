'use client';

import { useEffect, useState } from 'react';
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
		if (!r.ok) return setNotice(r.reason);
		setDecks(r.value);
		setActiveId(r.value[0]?.id ?? null);
	}, []);

	const active = decks.find((d) => d.id === activeId) ?? null;

	function persist(next: StoredDeck[]) {
		setDecks(next);
		const r = writeDecks(window.localStorage, next);
		setNotice(r.ok ? null : r.reason);
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
		persist([...decks, d]);
		setActiveId(d.id);
	}

	function removeDeck(id: string) {
		const next = decks.filter((d) => d.id !== id);
		persist(next);
		if (activeId === id) setActiveId(next[0]?.id ?? null);
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
											onChange={() =>
												update((d) => {
													const at = d.deployed.indexOf(slot.sinnerId);
													if (at >= 0) d.deployed.splice(at, 1);
													else if (d.deployed.length < DEPLOY_MAX) d.deployed.push(slot.sinnerId);
												})
											}
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
