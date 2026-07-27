import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Named } from '@/lib/queries/shared';

/** 섹션 라벨. 제목 · 부제 · 구분선 · 우측 힌트. */
export function SecLabel({
	title,
	sub,
	hint,
}: {
	title: string;
	sub?: string | undefined;
	hint?: ReactNode;
}) {
	return (
		<div className="seclabel">
			<h2>{title}</h2>
			{sub ? <span className="kr">{sub}</span> : null}
			<span className="rule" />
			{hint ? <span className="hint">{hint}</span> : null}
		</div>
	);
}

export function Panel({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="panel">
			<div className="panel-h">
				<h3>{title}</h3>
				{hint !== undefined ? <span className="hint">{hint}</span> : null}
			</div>
			<div className="panel-b">{children}</div>
		</section>
	);
}

/**
 * 표시명.
 *
 * 이름이 어느 로케일에도 없으면 **지어내지 않는다**(02-data-model 6절). 없음을 없음으로 적는다.
 * 한국어가 없어 영문이 나온 경우에는 그 사실을 표기한다(ADR-03 5절) — 결손의 결과이지
 * 설계 의도가 아니기 때문이다.
 */
export function Name({ value, notice }: { value: Named | null; notice: string }) {
	if (!value) return <span className="missing">이름 없음</span>;
	return (
		<>
			{value.name}
			{value.fellBack ? (
				<abbr className="fellback" title={notice}>
					EN
				</abbr>
			) : null}
		</>
	);
}

/**
 * 값이 없음을 적는 표기.
 *
 * 05-ui-foundation 6.1 — 결손과 부재를 같은 기호로 표시하지 않는다.
 * `kind="absent"` 는 없는 것이 정상인 것, `kind="missing"` 은 데이터에 있어야 하는데 없는 것.
 */
export function Nothing({ kind, children }: { kind: 'absent' | 'missing'; children: ReactNode }) {
	return <span className={kind === 'missing' ? 'missing' : 'absent'}>{children}</span>;
}

/** 애셋이 있으면 이미지, 없으면 대체 표시. 스킬 12종·상태 254종이 여기 걸린다. */
export function Icon({
	src,
	alt,
	size = 40,
	shape = 'square',
}: {
	src: string | null;
	alt: string;
	size?: number;
	shape?: 'square' | 'wide';
}) {
	if (!src) {
		return (
			<span
				className="icon icon-none"
				style={{ width: size, height: shape === 'wide' ? size * 0.6 : size }}
				aria-hidden="true"
			/>
		);
	}
	return (
		/* eslint-disable-next-line @next/next/no-img-element -- 로컬 정적 파일이고 크기가 고정이다 */
		<img
			className="icon"
			src={src}
			alt={alt}
			width={size}
			height={shape === 'wide' ? Math.round(size * 0.6) : size}
			loading="lazy"
		/>
	);
}

/**
 * 아이콘을 곁들인 태그.
 *
 * 죄악·등급·공격 타입처럼 게임이 고유 표기를 갖는 축은 그 표기를 따른다(05-ui-foundation 8절).
 * 애셋이 없으면 글자만 남으므로 뜻이 사라지지 않는다.
 */
export function IconTag({
	src,
	children,
	label,
}: {
	src: string | null;
	children?: ReactNode;
	label?: string | undefined;
}) {
	return (
		<span className="tag tag-icon">
			{src ? (
				/* eslint-disable-next-line @next/next/no-img-element */
				<img src={src} alt={children === undefined ? (label ?? '') : ''} width={16} height={16} />
			) : null}
			{children}
		</span>
	);
}

/** 아이콘만 쓰는 자리. 글자가 필요 없을 때 쓰되 대체 텍스트를 반드시 남긴다. */
export function IconOnly({ src, label }: { src: string | null; label: string }) {
	if (!src) return <span className="tag">{label}</span>;
	return (
		/* eslint-disable-next-line @next/next/no-img-element */
		<img className="icon-inline" src={src} alt={label} title={label} width={20} height={20} />
	);
}

export function Empty({ message }: { message: string }) {
	return <p className="emptied">{message}</p>;
}

/** 목록 페이지 이동. 현재 질의 문자열을 유지한 채 page 만 바꾼다. */
export function Pager({
	base,
	params,
	page,
	pageCount,
}: {
	base: string;
	params: Record<string, string | string[] | undefined>;
	page: number;
	pageCount: number;
}) {
	if (pageCount <= 1) return null;

	const href = (target: number) => {
		const sp = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			if (key === 'page' || value === undefined) continue;
			for (const v of Array.isArray(value) ? value : [value]) sp.append(key, v);
		}
		if (target > 1) sp.set('page', String(target));
		const q = sp.toString();
		return q ? `${base}?${q}` : base;
	};

	return (
		<nav className="pager">
			{page > 1 ? <Link href={href(page - 1)}>← 이전</Link> : <span />}
			<span className="pager-at">
				{page} / {pageCount}
			</span>
			{page < pageCount ? <Link href={href(page + 1)}>다음 →</Link> : <span />}
		</nav>
	);
}

/** 정의 목록. 상세 화면의 스칼라 필드에 쓴다. */
export function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
	return (
		<dl className="facts">
			{rows.map(([key, value]) => (
				<div key={key}>
					<dt>{key}</dt>
					<dd>{value}</dd>
				</div>
			))}
		</dl>
	);
}
