import { and, desc, eq } from "drizzle-orm"
import type { CourseSource, CourseSummary } from "@study-reader/contracts"
import db from "@/db/client"
import { courses } from "@/db/schema-exported"
import { AppError } from "@/error"
import { validateStudyPackage } from "./package-validation"

type CourseRow = typeof courses.$inferSelect

/** biome-ignore lint/complexity/noStaticOnlyClass: service pattern */
export abstract class CoursesService {
	static async upload(ownerId: string, bytes: Uint8Array): Promise<CourseSummary> {
		const validated = validateStudyPackage(bytes)

		const [existing] = await db
			.select({ id: courses.id })
			.from(courses)
			.where(
				and(
					eq(courses.ownerId, ownerId),
					eq(courses.courseId, validated.manifest.id),
				),
			)
			.limit(1)
		if (existing) {
			throw new AppError(
				"COURSE_ALREADY_EXISTS",
				409,
				"Você já tem um curso com este id no pacote.",
			)
		}

		const [row] = await db
			.insert(courses)
			.values({
				ownerId,
				courseId: validated.manifest.id,
				title: validated.manifest.title,
				description: validated.manifest.description ?? null,
				language: validated.manifest.language ?? null,
				author: validated.manifest.author ?? null,
				version: validated.manifest.version,
				source: "upload",
				manifest: validated.manifest,
				moduleCount: validated.moduleCount,
				lessonCount: validated.lessonCount,
				data: Buffer.from(bytes),
			})
			.returning()
		return toSummary(row)
	}

	static async list(ownerId: string): Promise<CourseSummary[]> {
		const rows = await db
			.select()
			.from(courses)
			.where(eq(courses.ownerId, ownerId))
			.orderBy(desc(courses.updatedAt))
		return rows.map(toSummary)
	}

	static async getOwned(ownerId: string, id: string): Promise<CourseRow> {
		const [row] = await db
			.select()
			.from(courses)
			.where(and(eq(courses.id, id), eq(courses.ownerId, ownerId)))
			.limit(1)
		if (!row) {
			throw new AppError("COURSE_NOT_FOUND", 404, "Curso não encontrado.")
		}
		return row
	}

	static async get(ownerId: string, id: string): Promise<CourseSummary> {
		return toSummary(await this.getOwned(ownerId, id))
	}

	static async packageBytes(ownerId: string, id: string): Promise<Uint8Array> {
		const row = await this.getOwned(ownerId, id)
		return new Uint8Array(row.data)
	}

	static async remove(ownerId: string, id: string): Promise<void> {
		await this.getOwned(ownerId, id)
		await db.delete(courses).where(eq(courses.id, id))
	}
}

function toSummary(row: CourseRow): CourseSummary {
	return {
		id: row.id,
		courseId: row.courseId,
		title: row.title,
		description: row.description,
		language: row.language,
		author: row.author,
		version: row.version,
		source: row.source as CourseSource,
		moduleCount: row.moduleCount,
		lessonCount: row.lessonCount,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}
}
