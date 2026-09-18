import type { SyncState } from "@study-reader/contracts"

function mergeMaps<T>(
	stored: Record<string, T>,
	incoming: Record<string, T>,
	newer: (a: T, b: T) => T,
): Record<string, T> {
	const merged: Record<string, T> = { ...stored }
	for (const [key, value] of Object.entries(incoming)) {
		const previous = merged[key]
		merged[key] = previous ? newer(previous, value) : value
	}
	return merged
}

export function mergeSyncState(stored: SyncState, incoming: SyncState): SyncState {
	return {
		progress: {
			currentLesson:
				incoming.progress.currentLesson ?? stored.progress.currentLesson ?? null,
			completedLessons: mergeMaps(
				stored.progress.completedLessons,
				incoming.progress.completedLessons,
				(a, b) => (a >= b ? a : b),
			),
		},
		answers: mergeMaps(
			stored.answers,
			incoming.answers,
			(a, b) => (a.answeredAt >= b.answeredAt ? a : b),
		),
		reviews: mergeMaps(
			stored.reviews,
			incoming.reviews,
			(a, b) => ((a.gradedAt ?? "") >= (b.gradedAt ?? "") ? a : b),
		),
	}
}
