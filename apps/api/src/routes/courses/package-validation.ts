import { readStudy, validateCrossReferences } from "@study-reader/study-format"
import type { StudyManifest } from "@study-reader/study-format"
import { AppError } from "@/error"

export const MAX_PACKAGE_BYTES = 50 * 1024 * 1024

export type ValidatedStudyPackage = {
	manifest: StudyManifest
	moduleCount: number
	lessonCount: number
}

export function validateStudyPackage(bytes: Uint8Array): ValidatedStudyPackage {
	if (bytes.byteLength === 0) {
		throw new AppError("INVALID_STUDY_PACKAGE", 400, "Arquivo vazio.")
	}
	if (bytes.byteLength > MAX_PACKAGE_BYTES) {
		throw new AppError(
			"PACKAGE_TOO_LARGE",
			413,
			"Pacote maior que 50 MB.",
		)
	}

	let parsed
	try {
		parsed = readStudy(bytes)
	} catch (error) {
		throw new AppError(
			"INVALID_STUDY_PACKAGE",
			400,
			"Pacote .study inválido.",
			{ reason: String(error) },
		)
	}

	const issues = validateCrossReferences(parsed)
	if (issues.length > 0) {
		throw new AppError(
			"INVALID_STUDY_PACKAGE",
			400,
			"O pacote contém referências cruzadas inválidas.",
			{ issues: issues.slice(0, 20) },
		)
	}

	const lessonCount = parsed.manifest.modules.reduce(
		(total, module) => total + module.lessons.length,
		0,
	)

	return {
		manifest: parsed.manifest,
		moduleCount: parsed.manifest.modules.length,
		lessonCount,
	}
}
