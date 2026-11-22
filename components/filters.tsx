'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
	createContext,
	useContext,
	useEffect,
    useRef,
	useState,
	useTransition,
	type ReactNode,
} from 'react';

import {useLiveSearch} from './use-live-search';
import {canSearch} from '@/lib/korean-search';
import { CatalogueToolbar } from './catalogue-toolbar';

/**
 * 필터 상태를 URL 에 담는다(05-ui-foundation 3절).
 *
 * **상태를 컴포넌트가 들고 있지 않는다.** 질의 문자열이 유일한 출처이고, 서버가 그것을 읽어
 * 질의한다(ADR-05 3.3). 그래야 주소 하나로 화면이 그대로 재현되고 공유된다.
 */

type UpdateContext = {
	params: URLSearchParams;
	pending: boolean;
	apply: (mutate: (sp: URLSearchParams) => void) => void;
};
const DraftContext = createContext<UpdateContext | null>(null);
export function QueryFilters({
	title,
	placeholder,
	children,
}: {
	title: string;
	placeholder: string;
	children: ReactNode;
}) {
	const pathname = usePathname(),
		router = useRouter(),
		params = useSearchParams(),
		serialized = params.toString(),
		ko = pathname.startsWith('/ko');
	const [draft, setDraft] = useState(() => new URLSearchParams(serialized)),
		[pending, startTransition] = useTransition();
	const liveQuery=useRef<string|null>(null);
	useEffect(() => {if(liveQuery.current===(params.get('q')??'')){liveQuery.current=null;return;}setDraft(new URLSearchParams(serialized));}, [serialized]);
	const mutate = (fn: (sp: URLSearchParams) => void) =>
		setDraft((prev) => {
			const next = new URLSearchParams(prev);
			fn(next);
			return next;
		});
	return (
		<DraftContext.Provider value={{ params: draft, pending, apply: mutate }}>
			<CatalogueToolbar
				title={title}
				placeholder={placeholder}
				query={draft.get('q') ?? ''}
				ko={ko}
				pending={pending}
				active={[...params.keys()].filter((k) => k !== 'q' && k !== 'page').length}
				onQuery={(q) =>
					mutate((sp) => {
						if (q) sp.set('q', q);
						else sp.delete('q');
					})
				}
				onAutoQuery={(q)=>{
                    if(q===(params.get('q')??''))return;
                    const next=new URLSearchParams(serialized);next.delete('page');
                    if(q)next.set('q',q);else next.delete('q');
                    liveQuery.current=q;
                    startTransition(()=>router.replace(pathname+(next.size?'?'+next:''),{scroll:false}));
                }}
                onReset={() => setDraft(new URLSearchParams())}
				onApply={() => {
					const next = new URLSearchParams(draft);
					next.delete('page');
					const q = next.get('q')?.trim();
					if (q && canSearch(q)) next.set('q', q);
					else next.delete('q');
					startTransition(() =>
						router.push(pathname + (next.size ? '?' + next : ''), { scroll: false }),
					);
				}}
			>
				{children}
			</CatalogueToolbar>
		</DraftContext.Provider>
	);
}

function useUpdate() {
	const draft = useContext(DraftContext);
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

	return draft ?? { apply, params, pending };
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

	const step = () =>
		current === undefined || current === null ? '1' : current === '1' ? '0' : null;

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
 * 완성 글자/초성 길이를 확인하고 400ms 지연 후 검색한다. 서버 참조 데이터는 공유 캐시를 쓴다.
 */
export function SearchBox({ placeholder }: { placeholder: string }) {
	const { apply, params, pending } = useUpdate();
	const initial = params.get('q') ?? '';
	const [value, setValue] = useState(initial);
    const liveQuery=useRef<string|null>(null);
    const commit=(q:string)=>{if(q===initial)return;liveQuery.current=q;apply(sp=>{if(q)sp.set('q',q);else sp.delete('q')})};
    const composition=useLiveSearch(value,commit,400);

	// 뒤로 가기 등으로 URL 이 바뀌면 입력도 따라간다.
	useEffect(() => {if(liveQuery.current===initial){liveQuery.current=null;return;}setValue(initial)}, [initial]);

	const pathname = usePathname();
	const ko = pathname.startsWith('/ko');
	return (
		<form
			className="standalone-search"
			onSubmit={(e) => {
				e.preventDefault();
				apply((sp) => {
					if (canSearch(value)) sp.set('q', value.trim());
					else sp.delete('q');
				});
			}}
		>
			<input
				className="srch"
                {...composition}
				type="search"
				value={value}
				placeholder={placeholder}
				aria-label={placeholder}
				onChange={(e) => setValue(e.target.value)}
				aria-busy={pending}
			/>
			<button type="submit" className="ui-button ui-primary" disabled={pending}>
				{ko ? '검색' : 'Search'}
			</button>
		</form>
	);
}

/** 걸려 있는 필터를 모두 푼다. */
export function ClearFilters({ label }: { label: string }) {
	const { apply, params } = useUpdate();
	if ([...params.keys()].length === 0) return null;
	return (
		<button
			type="button"
			className="chip chip-clear"
			onClick={() =>
				apply((sp) => {
					for (const key of [...sp.keys()]) sp.delete(key);
				})
			}
		>
			{label}
		</button>
	);
}
