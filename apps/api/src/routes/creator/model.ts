import { z } from "zod"
import { outlineSchema } from "@study-reader/contracts"

export const outlineBodySchema = z.object({
	sourceText: z.string().min(200).max(400_000),
})
export type OutlineBody = z.infer<typeof outlineBodySchema>

export const lessonBodySchema = z.object({
	sourceText: z.string().min(200).max(400_000),
	outline: outlineSchema,
	lessonId: z.string().min(1).max(128),
})
export type LessonBody = z.infer<typeof lessonBodySchema>

export const assembleLessonSchema = z.object({
	lessonId: z.string().min(1).max(128),
	markdown: z.string().min(1),
	questions: z.record(
		z.string().min(1),
		z.object({
			type: z.enum(["single-choice", "multiple-choice"]),
			question: z.string().min(1),
			code: z.string().optional(),
			options: z
				.array(
					z.object({
						id: z.string().min(1).max(32),
						text: z.string().min(1),
					}),
				)
				.min(2),
			correct: z.array(z.string().min(1)).min(1),
			explanation: z.string().optional(),
		}),
	),
	flashcards: z.array(
		z.object({
			id: z.string().min(1).max(128),
			front: z.string().min(1),
			back: z.string().min(1),
			tags: z.array(z.string().max(64)).optional(),
		}),
	),
})

export const assembleBodySchema = z.object({
	outline: outlineSchema,
	lessons: z.array(assembleLessonSchema).min(1),
})
export type AssembleBody = z.infer<typeof assembleBodySchema>
