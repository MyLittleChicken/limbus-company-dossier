'use client';

import { useEffect, useMemo, useState } from 'react';
import { DeckCodeIo } from '@/components/deck-code-io';
import { FormationPicker, type PickMode } from '@/components/formation-picker';
import { FormationProfile, type ProfileInput } from '@/components/formation-profile';
import { readDecks, writeDecks } from '@/lib/storage/decks';
import { DECK_MAX, DEPLOY_MAX, EGO_RANKS, emptyDeck, type EgoRank, type StoredDeck } from '@/lib/storage/schema';
import type { SquadAxes, SquadSinner } from '@/lib/queries/squad';

/**
 * 편성 편집.
 *
 * 배치는 이전 프로토타입의 SQUAD 탭을 따른다 — **덱 레일 · 수감자 12칸 · 편성 프로필**의 3열이고,
 * 칸은 표시 전용이며 고르는 일은 모달로 나간다(`reference/v1-formation-ui.md` 2·3절).
 * 디자인 요소는 가져오지 않는다. 가져오는 것은 배치와 그 배치가 담는 정보다.
 *
 * 수감자 12칸은 고정 축이다. 배열 인덱스가 곧 수감자라 한 수감자에 인격 둘이 들어가는
 * 상태를 만들 수 없다.
 *
 * E.G.O 는 등급당 하나이며 **지금은 추천 점수에 반영되지 않는다.** 프로필이 그 사실을 적는다
 * (07-recommendation-system 5.1). 적지 않으면 입력해 두고 왜 안 바뀌냐는 오해가 남는다.
 */

/**
 * 이 칸이 가리키는데 우리 데이터에는 없는 id 들.
 *
 * 저장분이나 덱 코드가 아직 적재되지 않은(또는 패치로 사라진) 인격·E.G.O 를 가리킬 수 있다.
 * 칸이 그냥 비어 보이면 "고르지 않음"과 구별되지 않아 **결손을 지어내는 쪽이 된다**
 * (02-data-model 6절 · 07-recommendation-system 8절).
 */
function missingRefs(
	slot: StoredDeck['slots'][number],
	sinner: SquadSinner | undefined,
	ko: boolean,
): string[] {
	const out: string[] = [];
	if (slot.identityId !== null && !sinner?.identities.some((i) => i.id === slot.identityId)) {
		out.push(`${ko ? '인격' : 'Identity'} ${slot.identityId}`);
	}
	for (const rank of EGO_RANKS) {
		const id = slot.egos[rank];
		if (id !== undefined && !sinner?.egos.some((e) => e.id === id)) out.push(`${rank} ${id}`);
	}
	return out;
}

export function DeckEditor({
	squad,
	axes,
	ko,
}: {
	squad: SquadSinner[];
	axes: SquadAxes;
	ko: boolean;
}) {
	const [decks, setDecks] = useState<StoredDeck[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [picking, setPicking] = useState<{ sinnerId: number; mode: PickMode } | null>(null);
	/**
	 * 읽기가 실패했는가.
	 *
	 * **이 상태에서는 쓰지 않는다.** 읽기에 실패하면 `decks` 는 빈 배열인데, 그 상태로
	 * 「새 덱」을 누르면 `writeDecks` 가 `limbus:decks` 를 통째로 덮어 **읽지 못한 저장분이
	 * 그 순간 사라진다.** 저장소 계층이 "읽기가 실패해도 지우지 않는다"를 지켜도 화면이
	 * 덮으면 소용이 없다(07-recommendation-system 4.2).
	 */
	const [locked, setLocked] = useState(false);

	useEffect(() => {
		const r = readDecks(window.localStorage);
		if (!r.ok) {
			setLocked(true);
			// 원인 문자열은 lib/storage 산출물이라 한국어 고정이다 — 헤드라인만 로캘별로 두고
			// 원문은 보조 정보로 붙여 실패 사유를 숨기지 않는다.
			return setNotice(`${ko ? '덱을 불러오지 못했습니다' : 'Could not load decks'}: ${r.reason}`);
		}
		setDecks(r.value);
		setActiveId(r.value[0]?.id ?? null);
	}, [ko]);

	const active = decks.find((d) => d.id === activeId) ?? null;
	const byId = useMemo(() => new Map(squad.map((s) => [s.id, s])), [squad]);

	/**
	 * 편성 프로필의 입력.
	 *
	 * 화면에서 센다. 엔진을 부르지 않는 이유는 둘이다 — 편집할 때마다 서버를 왕복하지 않고,
	 * 여기서 세는 단위가 엔진과 다르다(`formation-profile.tsx` 머리말).
	 */
	const profile = useMemo((): ProfileInput => {
		const acc: ProfileInput = {
			filled: 0,
			keywords: {},
			mechanics: {},
			atkTypes: {},
			sinSupply: {},
			sinDemand: {},
		};
		if (!active) return acc;

		for (const slot of active.slots) {
			const sinner = byId.get(slot.sinnerId);
			const identity = sinner?.identities.find((i) => i.id === slot.identityId);
			if (identity) {
				acc.filled += 1;
				for (const k of identity.keywords) acc.keywords[k] = (acc.keywords[k] ?? 0) + 1;
				for (const k of identity.mechanics) acc.mechanics[k] = (acc.mechanics[k] ?? 0) + 1;
				for (const t of identity.atkTypes) acc.atkTypes[t] = (acc.atkTypes[t] ?? 0) + 1;
				// 중복을 접지 않는다 — 죄악 자원의 단위는 인격이 아니라 스킬이다.
				for (const s of identity.skillSins) acc.sinSupply[s] = (acc.sinSupply[s] ?? 0) + 1;
			}
			for (const rank of EGO_RANKS) {
				const egoId = slot.egos[rank];
				if (egoId === undefined) continue;
				const ego = sinner?.egos.find((e) => e.id === egoId);
				// 데이터에 없는 id 는 세지 않는다. 칸에 결손으로 표기하고 넘어간다.
				if (!ego) continue;
				for (const c of ego.costs) acc.sinDemand[c.sin] = (acc.sinDemand[c.sin] ?? 0) + c.amount;
			}
		}
		return acc;
	}, [active, byId]);

	/**
	 * 저장이 성공했을 때만 화면 상태를 옮긴다 — 실패하면 이전에 실제로 저장된 덱을 그대로
	 * 보여주고 배너로만 알린다. 반환값은 addDeck·removeDeck 이 activeId 를 따라 옮길지
	 * 판단하는 데 쓴다(실패한 새 덱·삭제를 고른 상태처럼 보이게 두지 않기 위해).
	 */
	function persist(next: StoredDeck[]): boolean {
		if (locked) {
			setNotice(
				ko
					? '저장분을 읽지 못해 편집을 잠갔습니다. 덮어쓰면 읽지 못한 덱이 사라집니다.'
					: 'Editing is locked because the saved data could not be read; writing would destroy it.',
			);
			return false;
		}
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

	function setIdentity(sinnerId: number, id: number | null) {
		update((d) => {
			const s = d.slots.find((x) => x.sinnerId === sinnerId);
			if (s) s.identityId = id;
		});
	}

	function setEgo(sinnerId: number, rank: EgoRank, id: number | null) {
		update((d) => {
			const s = d.slots.find((x) => x.sinnerId === sinnerId);
			if (!s) return;
			if (id === null) delete s.egos[rank];
			else s.egos[rank] = id;
		});
	}

	function toggleDeploy(sinnerId: number) {
		if (!active) return;
		const on = active.deployed.includes(sinnerId);
		// 상한을 이미 채운 상태에서 새로 켜려는 시도는 조용히 버리지 않고 알린다.
		if (!on && active.deployed.length >= DEPLOY_MAX) {
			return setNotice(ko ? `출전은 ${DEPLOY_MAX}명까지입니다` : `Max ${DEPLOY_MAX} deployed`);
		}
		update((d) => {
			const at = d.deployed.indexOf(sinnerId);
			if (at >= 0) d.deployed.splice(at, 1);
			else if (d.deployed.length < DEPLOY_MAX) d.deployed.push(sinnerId);
		});
	}

	const pickingSinner = picking ? byId.get(picking.sinnerId) : undefined;
	const pickingSlot = picking ? active?.slots.find((s) => s.sinnerId === picking.sinnerId) : undefined;

	return (
		<section className="formation">
			{notice && (
				<p className="notice" role="status">
					{notice}
				</p>
			)}

			<div className="formation-cols">
				{/* ── 좌: 덱 레일 ── */}
				<aside className="deckrail">
					<h3 className="rail-h">{ko ? '편성' : 'Decks'}</h3>
					<ul className="rail-list">
						{decks.map((d, i) => (
							<li key={d.id}>
								<button
									type="button"
									className="rail-slot"
									aria-pressed={d.id === activeId}
									onClick={() => setActiveId(d.id)}
								>
									<span className="rail-n">{i + 1}</span>
									<span className="rail-name">{d.name}</span>
								</button>
							</li>
						))}
					</ul>
					<div className="rail-actions">
						<button type="button" className="chip" onClick={addDeck} disabled={locked}>
							{ko ? '새 덱' : 'New'}
						</button>
						{active && (
							<button type="button" className="chip" onClick={() => removeDeck(active.id)} disabled={locked}>
								{ko ? '삭제' : 'Delete'}
							</button>
						)}
					</div>
					<p className="rail-note">
						{ko
							? `덱은 ${DECK_MAX}개까지. 칸을 눌러 인격과 E.G.O 를 고칩니다.`
							: `Up to ${DECK_MAX} decks. Click a slot to edit its identity and E.G.O.`}
					</p>
				</aside>

				{/* ── 중: 수감자 12칸 ── */}
				<div className="formation-main">
					{!active ? (
						<p className="lede">{ko ? '덱을 만들어 편성을 시작합니다.' : 'Create a deck to begin.'}</p>
					) : (
						<>
							<div className="formation-head">
								<label className="deck-name">
									<span className="sr-only">{ko ? '덱 이름' : 'Deck name'}</span>
									<input
										value={active.name}
										aria-label={ko ? '덱 이름' : 'Deck name'}
										onChange={(e) =>
											update((d) => {
												d.name = e.target.value;
											})
										}
									/>
								</label>
								<span className="hint">
									{ko
										? `출전 ${active.deployed.length}/${DEPLOY_MAX}`
										: `Deployed ${active.deployed.length}/${DEPLOY_MAX}`}
								</span>
							</div>

							{/*
								덱 코드는 편성만 담고 출전을 담지 않는다(07 7.1). 가져온 직후 출전이 비어 있는
								것이 정상인데, 그 사실을 적지 않으면 "가져오기가 출전을 빠뜨렸다"로 읽힌다.
							*/}
							{active.order.length > 0 && active.deployed.length === 0 && (
								<p className="lede">
									{ko
										? '덱 코드는 출전을 담지 않습니다. 편성과 인격만 불러왔으니 출전은 직접 고르세요.'
										: 'Deck codes carry no on-field selection. The squad was imported; choose who deploys.'}
								</p>
							)}

							<ul className="sgrid">
								{active.slots.map((slot) => {
									const sinner = byId.get(slot.sinnerId);
									const identity = sinner?.identities.find((i) => i.id === slot.identityId);
									const deployed = active.deployed.includes(slot.sinnerId);
									const missing = missingRefs(slot, sinner, ko);
									return (
										<li key={slot.sinnerId} className={deployed ? 'sslot sslot-on' : 'sslot'}>
											<button
												type="button"
												className="sslot-main"
												onClick={() => setPicking({ sinnerId: slot.sinnerId, mode: 'identity' })}
											>
												<span className="sslot-port">
													{identity?.image ? (
														/* eslint-disable-next-line @next/next/no-img-element */
														<img src={identity.image} alt="" loading="lazy" />
													) : (
														<span className="sslot-port-none" aria-hidden="true" />
													)}
													{identity && (
														<>
															<span className="sslot-rarity">
																{axes.rarityIcons[String(identity.rarity)] ? (
																	/* eslint-disable-next-line @next/next/no-img-element */
																	<img
																		src={axes.rarityIcons[String(identity.rarity)] as string}
																		alt={'0'.repeat(identity.rarity)}
																		width={18}
																		height={12}
																	/>
																) : (
																	<span className="tag">{'0'.repeat(identity.rarity)}</span>
																)}
															</span>
															<span className="sslot-kw">
																{identity.keywords.map((k) =>
																	axes.icons[k] ? (
																		/* eslint-disable-next-line @next/next/no-img-element */
																		<img
																			key={k}
																			src={axes.icons[k] as string}
																			alt={axes.labels[k] ?? k}
																			title={axes.labels[k] ?? k}
																			width={16}
																			height={16}
																		/>
																	) : (
																		<span key={k} className="tag">
																			{axes.labels[k] ?? k}
																		</span>
																	),
																)}
															</span>
															{identity.mechanics.length > 0 && (
																<span className="sslot-mech">
																	{identity.mechanics.map((k) => (
																		<span key={k} className="tag">
																			{axes.labels[k] ?? k}
																		</span>
																	))}
																</span>
															)}
														</>
													)}
												</span>
												<span className="sslot-name">
													<span className="sslot-sinner">{sinner?.text?.name ?? `#${slot.sinnerId}`}</span>
													<span className={identity ? 'sslot-id' : 'sslot-id sslot-id-none'}>
														{identity?.text?.name ?? (ko ? '편성하지 않음' : 'Empty')}
													</span>
												</span>
											</button>

											{/* 빈 등급은 공백이 아니라 자리로 보인다 — 결손이 아니라 부재다. */}
											<button
												type="button"
												className="sslot-ego"
												onClick={() => setPicking({ sinnerId: slot.sinnerId, mode: 'ego' })}
												title={ko ? 'E.G.O — 등급마다 하나' : 'E.G.O — one per rank'}
											>
												<span className="sslot-ego-label">E.G.O</span>
												<span className="sslot-ego-cells">
													{EGO_RANKS.map((rank) => {
														const egoId = slot.egos[rank];
														const ego = sinner?.egos.find((e) => e.id === egoId);
														const rankSrc = axes.rankIcons[rank] ?? null;
														return (
															<span
																key={rank}
																className={egoId === undefined ? 'ecell' : 'ecell ecell-on'}
																title={ego?.text?.name ?? `${rank} ${ko ? '비어 있음' : 'empty'}`}
															>
																{ego?.image ? (
																	/* eslint-disable-next-line @next/next/no-img-element */
																	<img src={ego.image} alt="" loading="lazy" />
																) : rankSrc ? (
																	/* eslint-disable-next-line @next/next/no-img-element */
																	<img className="ecell-rank" src={rankSrc} alt={rank} />
																) : (
																	<span className="ecell-rank-text">{rank.slice(0, 1)}</span>
																)}
															</span>
														);
													})}
												</span>
											</button>

											{/* 칸에만 표기하고 편집은 막지 않는다 — 지우고 다시 고를 수 있어야 한다. */}
											{missing.length > 0 && (
												<em className="missing sslot-missing">
													{ko ? `데이터에 없음: ${missing.join(', ')}` : `Not in data: ${missing.join(', ')}`}
												</em>
											)}

											<label className="sslot-deploy">
												<input type="checkbox" checked={deployed} onChange={() => toggleDeploy(slot.sinnerId)} />
												{ko ? '출전' : 'Deploy'}
											</label>
										</li>
									);
								})}
							</ul>

							<DeckCodeIo
								deck={active}
								ko={ko}
								onImport={(imported) => {
									if (decks.length >= DECK_MAX) {
										return setNotice(ko ? `덱은 ${DECK_MAX}개까지입니다` : `Max ${DECK_MAX} decks`);
									}
									// 저장이 실패하면 이전에 선택돼 있던 덱을 그대로 보여줘야 한다 — addDeck 과 같은 규칙.
									if (persist([...decks, imported])) setActiveId(imported.id);
								}}
							/>
						</>
					)}
				</div>

				{/* ── 우: 편성 프로필 ── */}
				<aside className="formation-side">
					<FormationProfile profile={profile} axes={axes} ko={ko} />
				</aside>
			</div>

			{picking && pickingSinner && (
				<FormationPicker
					sinner={pickingSinner}
					mode={picking.mode}
					axes={axes}
					identityId={pickingSlot?.identityId ?? null}
					egos={pickingSlot?.egos ?? {}}
					supply={profile.sinSupply}
					ko={ko}
					onMode={(mode) => setPicking({ sinnerId: picking.sinnerId, mode })}
					onIdentity={(id) => setIdentity(picking.sinnerId, id)}
					onEgo={(rank, id) => setEgo(picking.sinnerId, rank, id)}
					onClose={() => setPicking(null)}
				/>
			)}
		</section>
	);
}
