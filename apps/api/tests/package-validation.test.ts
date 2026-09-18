import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { AppError } from "@/error"
import { validateStudyPackage } from "@/routes/courses/package-validation"

const tinyCoursePath = fileURLToPath(
	new URL("../../../examples/tiny-course.study", import.meta.url),
)

function loadTinyCourse() {
	return new Uint8Array(readFileSync(tinyCoursePath))
}

describe("validateStudyPackage", () => {
	it("accepts the tiny course example", () => {
		const result = validateStudyPackage(loadTinyCourse())
		expect(result.manifest.id).toBe("tiny-course")
		expect(result.moduleCount).toBe(1)
		expect(result.lessonCount).toBe(1)
	})

	it("rejects empty bytes", () => {
		expect(() => validateStudyPackage(new Uint8Array(0))).toThrowError(AppError)
	})

	it("rejects a zip without manifest.json", () => {
		const notAZip = new TextEncoder().encode("definitely not a zip")
		expect(() => validateStudyPackage(notAZip)).toThrowError(/inválido/)
	})
})
