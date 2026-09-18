import { describe, expect, it } from "vitest"
import type { SyncState } from "@study-reader/contracts"
import { mergeSyncState } from "@/routes/sync/merge"

function emptyState(): SyncState {
	return {
		progress: { currentLesson: null, completedLessons: {} },
		answers: {},
		reviews: {},
	}
}

describe("mergeSyncState", () => {
	it("keeps the newest answer per question", () => {
		const stored = {
			...emptyState(),
			answers: {
				q1: { selected: ["a"], correct: false, answeredAt: "2026-01-01T10:00:00Z" },
			},
		}
		const incoming = {
			...emptyState(),
			answers: {
				q1: { selected: ["b"], correct: true, answeredAt: "2026-02-01T10:00:00Z" },
				q2: { selected: ["c"], correct: true, answeredAt: "2026-02-01T11:00:00Z" },
			},
		}
		const merged = mergeSyncState(stored, incoming)
		expect(merged.answers.q1.selected).toEqual(["b"])
		expect(merged.answers.q2).toBeDefined()
	})

	it("keeps stored answer when incoming is older", () => {
		const stored = {
			...emptyState(),
			answers: {
				q1: { selected: ["a"], correct: true, answeredAt: "2026-03-01T10:00:00Z" },
			},
		}
		const incoming = {
			...emptyState(),
			answers: {
				q1: { selected: ["b"], correct: false, answeredAt: "2026-01-01T10:00:00Z" },
			},
		}
		expect(mergeSyncState(stored, incoming).answers.q1.selected).toEqual(["a"])
	})

	it("keeps the newest review by gradedAt, treating missing as oldest", () => {
		const stored = {
			...emptyState(),
			reviews: {
				legacy: { reps: 5, lapses: 0, ef: 2.5, interval: 30, due: 1780000000 },
				card2: { reps: 1, lapses: 0, ef: 2.5, interval: 1, due: 1780000100 },
			},
		}
		const incoming = {
			...emptyState(),
			reviews: {
				legacy: {
					reps: 0,
					lapses: 1,
					ef: 2.5,
					interval: 0,
					due: 1770000000,
					gradedAt: "2026-02-01T10:00:00Z",
				},
			},
		}
		const merged = mergeSyncState(stored, incoming)
		expect(merged.reviews.legacy.gradedAt).toBe("2026-02-01T10:00:00Z")
		expect(merged.reviews.card2.reps).toBe(1)
	})

	it("keeps the latest completedLessons timestamp per lesson", () => {
		const stored = {
			...emptyState(),
			progress: {
				currentLesson: "l1",
				completedLessons: { l1: "2026-01-01T10:00:00Z" },
			},
		}
		const incoming = {
			...emptyState(),
			progress: {
				currentLesson: null,
				completedLessons: {
					l1: "2026-05-01T10:00:00Z",
					l2: "2026-05-02T10:00:00Z",
				},
			},
		}
		const merged = mergeSyncState(stored, incoming)
		expect(merged.progress.completedLessons.l1).toBe("2026-05-01T10:00:00Z")
		expect(merged.progress.completedLessons.l2).toBe("2026-05-02T10:00:00Z")
	})

	it("incoming non-null currentLesson wins, null keeps stored", () => {
		const stored = {
			...emptyState(),
			progress: { currentLesson: "l1", completedLessons: {} },
		}
		const incomingNull = emptyState()
		expect(mergeSyncState(stored, incomingNull).progress.currentLesson).toBe("l1")

		const incomingNew = {
			...emptyState(),
			progress: { currentLesson: "l5", completedLessons: {} },
		}
		expect(mergeSyncState(stored, incomingNew).progress.currentLesson).toBe("l5")
	})
})
