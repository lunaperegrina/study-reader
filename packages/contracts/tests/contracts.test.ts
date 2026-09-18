import { describe, expect, it } from "vitest"
import {
	answerRecordSchema,
	outlineSchema,
	pairingCodeSchema,
	reviewRecordSchema,
	syncStateSchema,
} from "../src/index"

describe("syncStateSchema", () => {
	it("accepts a full state", () => {
		const state = {
			progress: {
				currentLesson: "m1-l01",
				completedLessons: { "m1-l01": "2026-09-18T10:00:00Z" },
			},
			answers: {
				"q-01": {
					selected: ["a"],
					correct: true,
					answeredAt: "2026-09-18T10:00:00Z",
				},
			},
			reviews: {
				"card-001": {
					reps: 1,
					lapses: 0,
					ef: 2.5,
					interval: 1,
					due: 1790000000,
					gradedAt: "2026-09-18T10:00:00Z",
				},
			},
		}
		expect(syncStateSchema.parse(state)).toEqual(state)
	})

	it("accepts legacy review records without gradedAt", () => {
		const parsed = reviewRecordSchema.parse({
			reps: 0,
			lapses: 0,
			ef: 2.5,
			interval: 0,
			due: 1790000000,
		})
		expect(parsed.gradedAt).toBeUndefined()
	})

	it("rejects answer records without answeredAt", () => {
		expect(() =>
			answerRecordSchema.parse({
				selected: ["a"],
				correct: false,
			}),
		).toThrow()
	})
})

describe("outlineSchema", () => {
	it("accepts a valid outline", () => {
		const outline = {
			title: "Curso de teste",
			description: "Descrição",
			language: "pt-BR",
			modules: [
				{
					id: "modulo-1",
					title: "Módulo 1",
					lessons: [
						{
							id: "M1-L01",
							title: "Lição 1",
							summary: "Sumário",
							quizCount: 2,
							flashcardCount: 3,
						},
					],
				},
			],
		}
		expect(outlineSchema.parse(outline)).toEqual(outline)
	})

	it("rejects module ids with uppercase", () => {
		expect(() =>
			outlineSchema.parse({
				title: "t",
				description: "d",
				language: "pt-BR",
				modules: [
					{ id: "Modulo", title: "M", lessons: [] },
				],
			}),
		).toThrow()
	})
})

describe("pairingCodeSchema", () => {
	it("accepts 6 uppercase alphanumeric chars", () => {
		expect(pairingCodeSchema.parse({ code: "AB12CD", expiresAt: "2026-09-18T10:00:00Z" }).code).toBe("AB12CD")
	})

	it("rejects lowercase or wrong length", () => {
		expect(() => pairingCodeSchema.parse({ code: "ab12cd", expiresAt: "x" })).toThrow()
		expect(() => pairingCodeSchema.parse({ code: "AB12C", expiresAt: "x" })).toThrow()
	})
})
