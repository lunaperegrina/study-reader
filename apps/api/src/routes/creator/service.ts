import { and, eq, gte, sql } from "drizzle-orm"
import {
	buildStudy,
	type QuestionBank,
	type StudyFlashcard,
	type StudyFile,
	type StudyManifest,
} from "@study-reader/study-format"
import type { CourseSummary, Outline } from "@study-reader/contracts"
import db from "@/db/client"
import { courses } from "@/db/schema-exported"
import { AppError } from "@/error"
import { creatorMonthlyLimit } from "@/lib/ai"
import { CoursesService } from "@/routes/courses/service"
import { generateLesson, generateOutline, type FinalizedLesson } from "./generation"
import type { AssembleBody } from "./model"

function monthStart() {
	const now = new Date()
	return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** biome-ignore lint/complexity/noStaticOnlyClass: service pattern */
export abstract class CreatorService {
		static async assertQuota(ownerId: string) {
			const [row] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(courses)
				.where(
					and(
						eq(courses.ownerId, ownerId),
						eq(courses.source, "ai"),
						gte(courses.createdAt, monthStart()),
					),
				)
			const count = row?.count ?? 0
			const limit = creatorMonthlyLimit()
			if (count >= limit) {
				throw new AppError(
					"QUOTA_EXCEEDED",
					409,
					`Você já criou ${count} cursos com IA este mês (limite: ${limit}).`,
				)
			}
		}

	static outline(ownerId: string, sourceText: string): Promise<Outline> {
		return this.assertQuota(ownerId).then(() => generateOutline(sourceText))
	}

	static lesson(
		sourceText: string,
		outline: Outline,
		lessonId: string,
	): Promise<FinalizedLesson> {
		return generateLesson(sourceText, outline, lessonId)
	}

	static async assemble(
		ownerId: string,
		body: AssembleBody,
	): Promise<CourseSummary> {
		await this.assertQuota(ownerId)

		const { outline, lessons } = body
		const outlineLessonIds = new Set(
			outline.modules.flatMap((module) => module.lessons.map((l) => l.id)),
		)
		for (const lesson of lessons) {
			if (!outlineLessonIds.has(lesson.lessonId)) {
				throw new AppError(
					"LESSON_NOT_IN_OUTLINE",
					400,
					`A lição ${lesson.lessonId} não existe no outline.`,
				)
			}
		}
		if (lessons.length !== outlineLessonIds.size) {
			throw new AppError(
				"MISSING_LESSONS",
				400,
				"Envie o conteúdo de todas as lições do outline.",
			)
		}

		const courseId = await this.uniqueCourseId(ownerId, outline.title)
		const files: StudyFile[] = []
		const questions: QuestionBank = {}
		const flashcards: StudyFlashcard[] = []

		for (const lesson of lessons) {
			files.push({
				path: `content/${lesson.lessonId}.md`,
				data: new TextEncoder().encode(lesson.markdown),
			})
			for (const [id, question] of Object.entries(lesson.questions)) {
				questions[id] = question
			}
			flashcards.push(...lesson.flashcards)
		}

		const manifest: StudyManifest = {
			formatVersion: 1,
			id: courseId,
			version: 1,
			title: outline.title,
			description: outline.description,
			language: outline.language,
			modules: outline.modules.map((module) => ({
				id: module.id,
				title: module.title,
				lessons: module.lessons.map((lesson) => ({
					id: lesson.id,
					title: lesson.title,
					content: `content/${lesson.id}.md`,
				})),
			})),
		}

		const bytes = buildStudy({ manifest, questions, flashcards, lessonContent: {}, files })
		return CoursesService.createFromBytes(ownerId, bytes, "ai")
	}

	static async uniqueCourseId(ownerId: string, title: string) {
		const slug = title
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60)

		for (let attempt = 0; attempt < 5; attempt++) {
			const suffix = Math.random().toString(36).slice(2, 6)
			const candidate = `${slug || "curso"}-${suffix}`
			const [existing] = await db
				.select({ id: courses.id })
				.from(courses)
				.where(and(eq(courses.ownerId, ownerId), eq(courses.courseId, candidate)))
				.limit(1)
			if (!existing) return candidate
		}
		throw new AppError(
			"COURSE_ID_COLLISION",
			500,
			"Não foi possível gerar um id único para o curso.",
		)
	}
}
