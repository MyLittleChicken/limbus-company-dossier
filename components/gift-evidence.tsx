'use client';

import { useRef } from 'react';

/**
 * 판정 근거 전량 조회 — **계측기다**(설계 7절).
 *
 * 팩당 상위 5만 보면 왜 이 순위인지 검증할 수 없다. 여기서는 그 팩의 기프트를
 * 전부 내고 조건마다 충족/미충족/확정을 그대로 보인다. **왜 0.0 인지가 보여야 한다.**
 *
 * **대충 만들고 나중에 제거한다.** 레이아웃·색·간격에 공들이지 않는다 —
 * 정보 제공 화면의 디자인 작업은 별도 세션의 몫이고 이 모달은 그 대상이 아니다.
 */
export interface EvidenceGift {
	id: number;
	name: string | null;
	grade: 'A' | 'B' | 'C';
	fireable: boolean;
	exclusive: boolean;
	keywordId: string | null;
	satisfied: number;
	decidable: number;
	total: number;
	chainDepth: number | null;
	reasons: ReadonlyArray<{
		triggerId: string;
		refKind: string;
		refId: string;
		verdict: string;
		certainty: string;
		have: number;
		need: number | null;
	}>;
}

export function GiftEvidence({
	packName,
	gifts,
	label,
}: {
	packName: string;
	gifts: ReadonlyArray<EvidenceGift>;
	label: string;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const dead = gifts.filter((g) => !g.fireable).length;

	return (
		<>
			<button type="button" className="chip" onClick={() => ref.current?.showModal()}>
				{label}
			</button>
			<dialog ref={ref} style={{ maxWidth: '52rem', width: '90vw' }}>
				<form method="dialog">
					<button type="submit" className="chip">닫기</button>
				</form>
				<h3>{packName}</h3>
				<p className="card-meta">
					{`기프트 ${gifts.length} · 켜질 수 없음 ${dead}`}
				</p>
				<ul className="plain">
					{gifts.map((g) => (
						<li key={g.id} style={{ marginBottom: '0.75rem' }}>
							<strong>{`[${g.fireable ? g.grade : 'X'}] ${g.name ?? g.id}`}</strong>
							<span className="card-meta">
								{` ${g.satisfied}/${g.decidable} (전체 ${g.total})`}
								{g.keywordId !== null ? ` · ${g.keywordId}` : ''}
								{g.exclusive ? ' · 전용' : ''}
								{g.chainDepth !== null ? ` · 연쇄 ${g.chainDepth}홉` : ''}
								{!g.fireable ? ' · 켜질 수 없음' : ''}
							</span>
							<ul className="comp">
								{g.reasons.map((r, i) => (
									<li key={i}>
										<span className="comp-k">{`${r.triggerId} · ${r.refKind}:${r.refId}`}</span>
										<span className="comp-v">
											{`${r.verdict}/${r.certainty} ${r.have}${r.need !== null ? `/${r.need}` : ''}`}
										</span>
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			</dialog>
		</>
	);
}
