import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
	GRADES,
	type GradeName,
	type SrsCard,
	grade,
	isDue,
	newCard,
} from "../src/index"

type Vector = {
	name: string
	card: SrsCard
	grade: GradeName
	now: number
	expected: {
		reps: number
		lapses: number
		ef: number
		interval: number
		due: number
		gradedAt: string
	}
}

const vectors: { cases: Vector[] } = JSON.parse(
	readFileSync(
		fileURLToPath(new URL("../fixtures/vectors.json", import.meta.url)),
		"utf8",
	),
)

describe("SM-2 conformance vectors (shared with srs.lua)", () => {
	for (const vector of vectors.cases) {
		it(vector.name, () => {
			expect(grade(vector.card, vector.grade, vector.now)).toEqual(
				vector.expected,
			)
		})
	}
})

describe("grade helpers", () => {
	it("new card is due immediately", () => {
		const now = 1758240000
		expect(isDue(newCard(now), now)).toBe(true)
	})

	it("graded card is not due before its due date", () => {
		const now = 1758240000
		const card = grade(newCard(now), "good", now)
		expect(isDue(card, now + 86400 - 1)).toBe(false)
		expect(isDue(card, now + 86400)).toBe(true)
	})

	it("exports the four grade names", () => {
		expect(GRADES).toEqual(["again", "hard", "good", "easy"])
	})
})
