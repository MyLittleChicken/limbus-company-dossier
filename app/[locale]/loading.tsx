export default function Loading() {
	return (
		<div className="route-loading" role="status" aria-label="Loading">
			<div className="skeleton-placeholder loading-title" />
			<div className="catalogue-grid loading-grid">
				{Array.from({ length: 10 }, (_, i) => (
					<div className="skeleton-placeholder loading-card" key={i} />
				))}
			</div>
		</div>
	);
}
