import { readStudy, type StudyPackage } from "@study-reader/study-format"
import { apiFetchBytes } from "@/lib/api/api-client"

export type LoadedCourse = {
	package: StudyPackage
	assetUrl: (path: string) => string | null
}

const assetUrlCache = new WeakMap<StudyPackage, Map<string, string>>()

function mimeFor(path: string) {
	if (path.endsWith(".png")) return "image/png"
	if (path.endsWith(".gif")) return "image/gif"
	if (path.endsWith(".svg")) return "image/svg+xml"
	if (path.endsWith(".webp")) return "image/webp"
	return "image/jpeg"
}

export async function loadCourse(courseRowId: string): Promise<LoadedCourse> {
	const bytes = await apiFetchBytes(`/api/v1/courses/${courseRowId}/package`)
	const study = readStudy(bytes, { loadLessons: true })

	let urls = assetUrlCache.get(study)
	if (!urls) {
		urls = new Map()
		assetUrlCache.set(study, urls)
	}

	return {
		package: study,
		assetUrl: (path: string) => {
			const cached = urls?.get(path)
			if (cached) return cached
			const file = study.files.find((entry) => entry.path === path)
			if (!file) return null
			const url = URL.createObjectURL(
				new Blob([new Uint8Array(file.data)], { type: mimeFor(path) }),
			)
			urls?.set(path, url)
			return url
		},
	}
}
