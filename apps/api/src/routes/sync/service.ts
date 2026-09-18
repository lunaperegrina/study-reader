import { and, eq } from "drizzle-orm"
import type { SyncState } from "@study-reader/contracts"
import db from "@/db/client"
import { courseState, courses } from "@/db/schema-exported"
import { AppError } from "@/error"
import { mergeSyncState } from "./merge"

const emptyState: SyncState = {
	progress: { currentLesson: null, completedLessons: {} },
	answers: {},
	reviews: {},
}

export type SyncCourseEntry = {
	courseId: string
	title: string
	version: number
	lessonCount: number
	updatedAt: string
}

/** biome-ignore lint/complexity/noStaticOnlyClass: service pattern */
export abstract class SyncService {
	static async listCourses(userId: string): Promise<SyncCourseEntry[]> {
		const rows = await db
			.select({
				courseId: courses.courseId,
				title: courses.title,
				version: courses.version,
				lessonCount: courses.lessonCount,
				updatedAt: courses.updatedAt,
			})
			.from(courses)
			.where(eq(courses.ownerId, userId))
		return rows.map((row) => ({
			courseId: row.courseId,
			title: row.title,
			version: row.version,
			lessonCount: row.lessonCount,
			updatedAt: row.updatedAt.toISOString(),
		}))
	}

	static async packageBytes(userId: string, courseId: string): Promise<Uint8Array> {
		const [row] = await db
			.select({ data: courses.data })
			.from(courses)
			.where(and(eq(courses.ownerId, userId), eq(courses.courseId, courseId)))
			.limit(1)
		if (!row) {
			throw new AppError("COURSE_NOT_FOUND", 404, "Curso não encontrado.")
		}
		return new Uint8Array(row.data)
	}
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
