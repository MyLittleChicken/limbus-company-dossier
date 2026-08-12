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
		/** roster | field | waiting — 무엇을 분모로 셌나. 없으면 임계값이 없는 것이다 */
		denominator: string | null;
	}>;
}

/**
 * 절 자리표를 사람이 읽는 말로 바꾼다.
 *
 * 판정이 절 단위로 옮겨가며 근거의 첫 칸이 `ordinal/group/idx` 가 됐다.
 * 「0/0/1」은 아무 뜻이 없지만 「1절 · 조건 2」는 설명문에서 찾을 수 있다.
 * 조건이 하나뿐인 절은 번호를 안 붙인다 — 붙이면 없는 갈래를 있는 것처럼 읽힌다.
 */
function clauseLabel(triggerId: string, ko: boolean): string {
	const m = /^(\d+)\/(\d+)\/(\d+)$/.exec(triggerId);
	if (m === null) return triggerId;
	const clause = Number(m[1]) + 1;
	const group = Number(m[2]) + 1;
	const idx = Number(m[3]) + 1;
	const cond = idx > 1 ? `${group}-${idx}` : String(group);
	return ko ? `${clause}절 · 조건 ${cond}` : `clause ${clause} · cond ${cond}`;
}

export function GiftEvidence({
	packName,
	gifts,
	label,
	ko,
}: {
	packName: string;
	gifts: ReadonlyArray<EvidenceGift>;
	label: string;
	ko: boolean;
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
					<button type="submit" className="chip">{ko ? '닫기' : 'Close'}</button>
				</form>
				<h3>{packName}</h3>
				<p className="card-meta">
					{ko ? `기프트 ${gifts.length} · 켜질 수 없음 ${dead}` : `${gifts.length} gifts · ${dead} cannot fire`}
				</p>
				<ul className="plain">
					{gifts.map((g) => (
						<li key={g.id} style={{ marginBottom: '0.75rem' }}>
							<strong>{`[${g.fireable ? g.grade : 'X'}] ${g.name ?? g.id}`}</strong>
							<span className="card-meta">
								{ko ? ` ${g.satisfied}/${g.decidable} (전체 ${g.total})` : ` ${g.satisfied}/${g.decidable} (total ${g.total})`}
								{g.keywordId !== null ? ` · ${g.keywordId}` : ''}
								{g.exclusive ? (ko ? ' · 전용' : ' · exclusive') : ''}
								{g.chainDepth !== null ? (ko ? ` · 연쇄 ${g.chainDepth}홉` : ` · chain ${g.chainDepth}`) : ''}
								{!g.fireable ? (ko ? ' · 켜질 수 없음' : ' · cannot fire') : ''}
							</span>
							<ul className="comp">
								{g.reasons.map((r, i) => (
									<li key={i}>
										{/**
										  * `triggerId` 는 절 모형에서 「몇 번째 절의 몇 번째 조건인가」다
										  * (`ordinal/group/idx`). 날것으로 보이면 `0/0/1` 이라 아무 뜻이
										  * 없어, 사람이 읽는 자리로 옮긴다
										  */}
										<span className="comp-k">{`${clauseLabel(r.triggerId, ko)} · ${r.refKind}:${r.refId}`}</span>
										<span className="comp-v">
											{`${r.verdict}/${r.certainty} ${r.have}${r.need !== null ? `/${r.need}` : ''}`}
											{r.denominator !== null ? ` ${r.denominator}` : ''}
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
