import { and, eq } from "drizzle-orm"
import type { SyncState } from "@study-reader/contracts"
import db from "@/db/client"
import { courseState } from "@/db/schema-exported"
import { mergeSyncState } from "./merge"

const emptyState: SyncState = {
	progress: { currentLesson: null, completedLessons: {} },
	answers: {},
	reviews: {},
}

/** biome-ignore lint/complexity/noStaticOnlyClass: service pattern */
export abstract class SyncService {
	static async getState(userId: string, courseId: string): Promise<SyncState> {
		const [row] = await db
			.select()
			.from(courseState)
			.where(and(eq(courseState.userId, userId), eq(courseState.courseId, courseId)))
			.limit(1)
		if (!row) return emptyState
		return {
			progress: row.progress,
			answers: row.answers,
			reviews: row.reviews,
		}
	}

	static async putState(
		userId: string,
		courseId: string,
		incoming: SyncState,
	): Promise<SyncState> {
		const stored = await this.getState(userId, courseId)
		const merged = mergeSyncState(stored, incoming)

		await db
			.insert(courseState)
			.values({
				userId,
				courseId,
				progress: merged.progress,
				answers: merged.answers,
				reviews: merged.reviews,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [courseState.userId, courseState.courseId],
				set: {
					progress: merged.progress,
					answers: merged.answers,
					reviews: merged.reviews,
					updatedAt: new Date(),
				},
			})

		return merged
	}
}
