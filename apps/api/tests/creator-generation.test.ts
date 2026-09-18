import { describe, expect, it } from "vitest"
import { AppError } from "@/error"
import { finalizeLesson } from "@/routes/creator/generation"

const draft = (overrides?: {
	markdown?: string
	questions?: unknown[]
	flashcards?: unknown[]
}) => ({
	markdown:
		overrides?.markdown ??
		"Intro do assunto.\n\n{{quiz:1}}\n\nMais conteúdo.\n\n{{flashcard:1}}\n\nFim.",
	questions:
		overrides?.questions ??
		[
			{
				question: "Quanto é 2+2?",
				options: [{ text: "3" }, { text: "4" }],
				correct: [1],
				explanation: "2+2=4.",
			},
		],
	flashcards:
		overrides?.flashcards ??
		[
			{
				front: "Soma",
				back: "Operação de adição.",
			},
		],
})

describe("finalizeLesson", () => {
	it("rewrites directives with deterministic ids and builds the bank", () => {
		const result = finalizeLesson(draft(), "M1-L01")

		expect(result.markdown).toContain("{{quiz:M1-L01-Q1}}")
		expect(result.markdown).toContain("{{flashcard:M1-L01-C1}}")
		expect(result.markdown).not.toContain("{{quiz:1}}")

		expect(result.questions["M1-L01-Q1"]).toMatchObject({
			type: "single-choice",
			question: "Quanto é 2+2?",
			options: [
				{ id: "a", text: "3" },
				{ id: "b", text: "4" },
			],
			correct: ["b"],
			explanation: "2+2=4.",
		})
		expect(result.flashcards[0]).toMatchObject({
			id: "M1-L01-C1",
			front: "Soma",
			back: "Operação de adição.",
		})
	})

	it("marks multiple correct answers as multiple-choice", () => {
		const result = finalizeLesson(
			draft({
				questions: [
					{
						question: "Pares?",
						options: [{ text: "a" }, { text: "b" }, { text: "c" }],
						correct: [0, 2],
					},
				],
			}),
			"L1",
		)
		expect(result.questions["L1-Q1"]).toMatchObject({
			type: "multiple-choice",
			correct: ["a", "c"],
		})
	})

	it("rejects when quiz markers and questions disagree", () => {
		expect(() => finalizeLesson(draft(), "L1")).not.toThrow()
		expect(() =>
			finalizeLesson(
				draft({
					markdown: "Sem marcadores aqui.",
					questions: [
						{
							question: "Q1",
							options: [{ text: "a" }, { text: "b" }],
							correct: [0],
						},
					],
				}),
				"L1",
			),
		).toThrowError(AppError)
	})

	it("rejects when flashcard markers and cards disagree", () => {
		expect(() =>
			finalizeLesson(
				draft({
					markdown: "Texto.\n\n{{quiz:1}}\n\nFim.",
					flashcards: [
						{ front: "F", back: "B" },
						{ front: "F2", back: "B2" },
					],
				}),
				"L1",
			),
		).toThrowError(/flashcards/)
	})

	it("rejects a question without a valid correct option", () => {
		expect(() =>
			finalizeLesson(
				draft({
					questions: [
						{
							question: "Quebrada",
							options: [{ text: "a" }, { text: "b" }],
							correct: [9],
						},
					],
				}),
				"L1",
			),
		).toThrowError(AppError)
	})
})
