'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

/**
 * 필터 상태를 URL 에 담는다(05-ui-foundation 3절).
 *
 * **상태를 컴포넌트가 들고 있지 않는다.** 질의 문자열이 유일한 출처이고, 서버가 그것을 읽어
 * 질의한다(ADR-05 3.3). 그래야 주소 하나로 화면이 그대로 재현되고 공유된다.
 */

function useUpdate() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [pending, startTransition] = useTransition();

	const apply = (mutate: (sp: URLSearchParams) => void) => {
		const sp = new URLSearchParams(params.toString());
		mutate(sp);
		// 필터가 바뀌면 첫 쪽으로 돌아간다. 3쪽을 보던 중 조건을 좁히면 빈 화면이 된다.
		sp.delete('page');
		const q = sp.toString();
		startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
	};

	return { apply, params, pending };
}

export interface ChipOption {
	value: string;
	label: string;
	/** 칩 앞에 붙는 아이콘 */
	icon?: string | null;
}

/** 여러 값을 켜고 끄는 축. 같은 축 안에서는 OR 로 묶인다. */
export function ChipFilter({
	param,
	options,
	label,
}: {
	param: string;
	options: ChipOption[];
	label: string;
}) {
	const { apply, params } = useUpdate();
	const active = new Set(params.getAll(param).flatMap((v) => v.split(',')));

	return (
		<div className="filter-axis" role="group" aria-label={label}>
			<span className="filter-axis-label">{label}</span>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					className="chip"
					aria-pressed={active.has(o.value)}
					onClick={() =>
						apply((sp) => {
							const next = new Set(active);
							if (next.has(o.value)) next.delete(o.value);
							else next.add(o.value);
							sp.delete(param);
							for (const v of next) sp.append(param, v);
						})
					}
				>
					{o.icon ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img src={o.icon} alt="" width={16} height={16} />
					) : null}
					{o.label}
				</button>
			))}
		</div>
	);
}

/** 참/거짓/무관 3상태 축. */
export function TriFilter({ param, label }: { param: string; label: string }) {
	const { apply, params } = useUpdate();
	const current = params.get(param);

	const step = () => (current === undefined || current === null ? '1' : current === '1' ? '0' : null);

	return (
		<button
			type="button"
			className="chip"
			aria-pressed={current !== null}
			onClick={() =>
				apply((sp) => {
					const next = step();
					if (next === null) sp.delete(param);
					else sp.set(param, next);
				})
			}
		>
			{label}
			{current === '1' ? ' : 예' : current === '0' ? ' : 아니오' : ''}
		</button>
	);
}

/** 값 하나만 고르는 축. 같은 값을 다시 누르면 해제된다. */
export function PickFilter({
	param,
	options,
	label,
}: {
	param: string;
	options: ChipOption[];
	label: string;
}) {
	const { apply, params } = useUpdate();
	const current = params.get(param);

	return (
		<div className="filter-axis" role="group" aria-label={label}>
			<span className="filter-axis-label">{label}</span>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					className="chip"
					aria-pressed={current === o.value}
					onClick={() =>
						apply((sp) => {
							if (current === o.value) sp.delete(param);
							else sp.set(param, o.value);
						})
					}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

/**
 * 이름·설명 검색.
 *
 * 입력마다 질의하지 않는다. 설명문 전문 검색이라 타건마다 보내면 데이터베이스가 상한다.
 */
export function SearchBox({ placeholder }: { placeholder: string }) {
	const { apply, params, pending } = useUpdate();
	const initial = params.get('q') ?? '';
	const [value, setValue] = useState(initial);

	// 뒤로 가기 등으로 URL 이 바뀌면 입력도 따라간다.
	useEffect(() => setValue(initial), [initial]);

	useEffect(() => {
		if (value === initial) return;
		const timer = setTimeout(() => {
			apply((sp) => {
				if (value.trim()) sp.set('q', value.trim());
				else sp.delete('q');
			});
		}, 300);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value]);

	return (
		<input
			className="srch"
			type="search"
			value={value}
			placeholder={placeholder}
			onChange={(e) => setValue(e.target.value)}
			aria-busy={pending}
		/>
	);
}

/** 걸려 있는 필터를 모두 푼다. */
export function ClearFilters({ label }: { label: string }) {
	const { apply, params } = useUpdate();
	if ([...params.keys()].length === 0) return null;
	return (
		<button type="button" className="chip chip-clear" onClick={() => apply((sp) => {
			for (const key of [...sp.keys()]) sp.delete(key);
		})}>
			{label}
		</button>
	);
}
