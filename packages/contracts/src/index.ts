import { z } from "zod"

export const courseSourceSchema = z.enum(["upload", "ai"])
export type CourseSource = z.infer<typeof courseSourceSchema>

export const courseSummarySchema = z.object({
	id: z.string().uuid(),
	courseId: z.string().min(1).max(128),
	title: z.string().min(1),
	description: z.string().nullable(),
	language: z.string().nullable(),
	author: z.string().nullable(),
	version: z.number().int().min(1),
	source: courseSourceSchema,
	moduleCount: z.number().int().min(0),
	lessonCount: z.number().int().min(0),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type CourseSummary = z.infer<typeof courseSummarySchema>

export const progressStateSchema = z.object({
	currentLesson: z.string().nullable(),
	completedLessons: z.record(z.string(), z.string()),
})
export type ProgressState = z.infer<typeof progressStateSchema>

export const answerRecordSchema = z.object({
	selected: z.array(z.string()),
	correct: z.boolean(),
	answeredAt: z.string(),
})
export type AnswerRecord = z.infer<typeof answerRecordSchema>

export const answersStateSchema = z.record(z.string(), answerRecordSchema)
export type AnswersState = z.infer<typeof answersStateSchema>

export const reviewRecordSchema = z.object({
	reps: z.number().int().min(0),
	lapses: z.number().int().min(0),
	ef: z.number(),
	interval: z.number().int().min(0),
	due: z.number().int().min(0),
	gradedAt: z.string().optional(),
})
export type ReviewRecord = z.infer<typeof reviewRecordSchema>

export const reviewsStateSchema = z.record(z.string(), reviewRecordSchema)
export type ReviewsState = z.infer<typeof reviewsStateSchema>

export const syncStateSchema = z.object({
	progress: progressStateSchema,
	answers: answersStateSchema,
	reviews: reviewsStateSchema,
})
export type SyncState = z.infer<typeof syncStateSchema>

export const deviceSummarySchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	createdAt: z.string(),
	lastSeenAt: z.string().nullable(),
})
export type DeviceSummary = z.infer<typeof deviceSummarySchema>

export const pairingCodeSchema = z.object({
	code: z.string().regex(/^[A-Z0-9]{6}$/),
	expiresAt: z.string(),
})
export type PairingCode = z.infer<typeof pairingCodeSchema>

export const outlineLessonSchema = z.object({
	id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).max(128),
	title: z.string().min(1).max(512),
	summary: z.string().max(2048),
	quizCount: z.number().int().min(0).max(20),
	flashcardCount: z.number().int().min(0).max(30),
})
export type OutlineLesson = z.infer<typeof outlineLessonSchema>

export const outlineModuleSchema = z.object({
	id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(128),
	title: z.string().min(1).max(512),
	lessons: z.array(outlineLessonSchema).min(1),
})
export type OutlineModule = z.infer<typeof outlineModuleSchema>

export const outlineSchema = z.object({
	title: z.string().min(1).max(512),
	description: z.string().max(2048),
	language: z.string().regex(/^[a-zA-Z]+(-[a-zA-Z0-9]+)*$/),
	modules: z.array(outlineModuleSchema).min(1),
})
export type Outline = z.infer<typeof outlineSchema>

export const generationStatusSchema = z.enum([
	"idle",
	"outlining",
	"awaiting_review",
	"generating",
	"saving",
	"done",
	"failed",
])
export type GenerationStatus = z.infer<typeof generationStatusSchema>
