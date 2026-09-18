import { generateObject } from "ai"
import { z } from "zod"
import type { QuestionBank, StudyFlashcard } from "@study-reader/study-format"
import type { Outline } from "@study-reader/contracts"
import { AppError } from "@/error"
import { resolveCreatorModel } from "@/lib/ai"
import { LESSON_SYSTEM, OUTLINE_SYSTEM } from "./prompts"

const outlineDraftSchema = z.object({
	title: z.string(),
	description: z.string(),
	language: z.string(),
	modules: z
		.array(
			z.object({
				title: z.string(),
				lessons: z
					.array(
						z.object({
							title: z.string(),
							summary: z.string(),
							quizCount: z.number(),
							flashcardCount: z.number(),
						}),
					)
					.min(1),
			}),
		)
		.min(1),
})

type OutlineDraft = z.infer<typeof outlineDraftSchema>

export async function generateOutline(sourceText: string): Promise<Outline> {
	const { object } = await generateObject({
		model: resolveCreatorModel(),
		schema: outlineDraftSchema,
		prompt: `${OUTLINE_SYSTEM}\n\n# Material-fonte\n\n${sourceText}`,
	})

	return normalizeOutline(object)
}

function normalizeOutline(draft: OutlineDraft): Outline {
	const modules = draft.modules.slice(0, 8).map((module, moduleIndex) => {
		const moduleId = `modulo-${moduleIndex + 1}`
		return {
			id: moduleId,
			title: module.title.slice(0, 512),
			lessons: module.lessons.slice(0, 10).map((lesson, lessonIndex) => ({
				id: `M${moduleIndex + 1}-L${String(lessonIndex + 1).padStart(2, "0")}`,
				title: lesson.title.slice(0, 512),
				summary: lesson.summary.slice(0, 2048),
				quizCount: clamp(lesson.quizCount, 0, 5),
				flashcardCount: clamp(lesson.flashcardCount, 0, 8),
			})),
		}
	})

	return {
		title: draft.title.slice(0, 512),
		description: draft.description.slice(0, 2048),
		language: /^[a-zA-Z]+(-[a-zA-Z0-9]+)*$/.test(draft.language)
			? draft.language
			: "pt-BR",
		modules: modules.length > 0 ? modules : modulesFallback(),
	}
}

function modulesFallback() {
	return [
		{
			id: "modulo-1",
			title: "Módulo 1",
			lessons: [
				{
					id: "M1-L01",
					title: "Introdução",
					summary: "Visão geral do material.",
					quizCount: 0,
					flashcardCount: 0,
				},
			],
		},
	]
}

function clamp(value: number, min: number, max: number) {
	if (!Number.isFinite(value)) return min
	return Math.min(max, Math.max(min, Math.floor(value)))
}

const OPTION_IDS = ["a", "b", "c", "d", "e"]

const lessonDraftSchema = z.object({
	markdown: z.string().min(1),
	questions: z.array(
		z.object({
			question: z.string(),
			code: z.string().optional(),
			options: z.array(z.object({ text: z.string() })).min(2),
			correct: z.array(z.number().int()),
			explanation: z.string().optional(),
		}),
	),
	flashcards: z.array(
		z.object({ front: z.string(), back: z.string() }),
	),
})

type LessonDraft = z.infer<typeof lessonDraftSchema>

export type FinalizedLesson = {
	markdown: string
	questions: QuestionBank
	flashcards: StudyFlashcard[]
}

export async function generateLesson(
	sourceText: string,
	outline: Outline,
	lessonId: string,
): Promise<FinalizedLesson> {
	const basePrompt = buildLessonPrompt(sourceText, outline, lessonId)
	let repairNote: string | null = null

	for (let attempt = 0; attempt < 3; attempt++) {
		const { object } = await generateObject({
			model: resolveCreatorModel(),
			schema: lessonDraftSchema,
			prompt: repairNote
				? `${basePrompt}\n\n# Tentativa anterior rejeitada — corrija exatamente o apontado\n\n${repairNote}`
				: basePrompt,
		})

		try {
			return finalizeLesson(object, lessonId)
		} catch (error) {
			repairNote = error instanceof AppError ? error.message : String(error)
		}
	}

	throw new AppError(
		"GENERATION_FAILED",
		502,
		`A lição ${lessonId} não passou na validação após 3 tentativas.`,
	)
}

function buildLessonPrompt(sourceText: string, outline: Outline, lessonId: string) {
	const module = outline.modules.find((entry) =>
		entry.lessons.some((lesson) => lesson.id === lessonId),
	)
	const lesson = module?.lessons.find((entry) => entry.id === lessonId)
	if (!module || !lesson) {
		throw new AppError(
			"LESSON_NOT_IN_OUTLINE",
			400,
			`A lição ${lessonId} não existe no outline.`,
		)
	}

	return [
		LESSON_SYSTEM,
		"",
		`# Curso\n${outline.title} — ${outline.description}`,
		`# Módulo\n${module.title}`,
		`# Lição a escrever\n${lesson.title}: ${lesson.summary}`,
		`# Quantidades esperadas\n~${lesson.quizCount} perguntas, ~${lesson.flashcardCount} flashcards`,
		`# Idioma\n${outline.language}`,
		"",
		"# Material-fonte",
		"",
		sourceText,
	].join("\n")
}

export function finalizeLesson(draft: LessonDraft, lessonId: string): FinalizedLesson {
	const questions: QuestionBank = {}
	const flashcards: StudyFlashcard[] = []

	let quizSeen = 0
	let cardSeen = 0

	const blocks = draft.markdown.split(/\n\s*\n/)
	const rewritten = blocks.map((block) => {
		const match = /^\{\{(quiz|flashcard):([^}]+)\}\}$/.exec(block.trim())
		if (!match) return block

		if (match[1] === "quiz") {
			quizSeen += 1
			return `{{quiz:${lessonId}-Q${quizSeen}}}`
		}
		cardSeen += 1
		return `{{flashcard:${lessonId}-C${cardSeen}}}`
	})

	if (quizSeen !== draft.questions.length) {
		throw new AppError(
			"GENERATION_MISMATCH",
			422,
			`A lição tem ${draft.questions.length} perguntas mas ${quizSeen} marcadores {{quiz:N}}. Use exatamente um marcador por pergunta, em parágrafo isolado.`,
		)
	}
	if (cardSeen !== draft.flashcards.length) {
		throw new AppError(
			"GENERATION_MISMATCH",
			422,
			`A lição tem ${draft.flashcards.length} flashcards mas ${cardSeen} marcadores {{flashcard:N}}. Use exatamente um marcador por flashcard, em parágrafo isolado.`,
		)
	}

	draft.questions.forEach((question, index) => {
		const id = `${lessonId}-Q${index + 1}`
		questions[id] = {
			type:
				question.correct.length > 1 ? "multiple-choice" : "single-choice",
			question: question.question,
			...(question.code ? { code: question.code } : {}),
			options: question.options.slice(0, 5).map((option, optionIndex) => ({
				id: OPTION_IDS[optionIndex],
				text: option.text,
			})),
			correct: question.correct
				.filter(
					(optionIndex) => optionIndex >= 0 && optionIndex < question.options.length,
				)
				.map((optionIndex) => OPTION_IDS[optionIndex]),
			...(question.explanation ? { explanation: question.explanation } : {}),
		}
		if (questions[id].correct.length === 0) {
			throw new AppError(
				"GENERATION_MISMATCH",
				422,
				`A pergunta ${index + 1} não tem opção correta válida (índices 0-based em "correct").`,
			)
		}
	})

	draft.flashcards.forEach((card, index) => {
		flashcards.push({
			id: `${lessonId}-C${index + 1}`,
			front: card.front,
			back: card.back,
		})
	})

	return {
		markdown: rewritten.join("\n\n"),
		questions,
		flashcards,
	}
}
