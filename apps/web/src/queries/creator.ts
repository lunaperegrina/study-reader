import { useMutation } from "@tanstack/react-query"
import type { CourseSummary, Outline } from "@study-reader/contracts"
import { apiFetch, apiUpload } from "@/lib/api/api-client"

export type GeneratedLesson = {
	lessonId: string
	markdown: string
	questions: Record<
		string,
		{
			type: "single-choice" | "multiple-choice"
			question: string
			code?: string
			options: { id: string; text: string }[]
			correct: string[]
			explanation?: string
		}
	>
	flashcards: { id: string; front: string; back: string }[]
}

export function useOutlineMutation() {
	return useMutation({
		mutationFn: (sourceText: string) =>
			apiFetch<Outline>("/api/v1/creator/outline", {
				method: "POST",
				body: JSON.stringify({ sourceText }),
			}),
	})
}

export function useLessonMutation() {
	return useMutation({
		mutationFn: (input: { sourceText: string; outline: Outline; lessonId: string }) =>
			apiFetch<GeneratedLesson>("/api/v1/creator/lesson", {
				method: "POST",
				body: JSON.stringify(input),
			}),
	})
}

export function useAssembleMutation() {
	return useMutation({
		mutationFn: (input: { outline: Outline; lessons: GeneratedLesson[] }) =>
			apiFetch<CourseSummary>("/api/v1/creator/assemble", {
				method: "POST",
				body: JSON.stringify(input),
			}),
	})
}

export async function extractPdfText(bytes: Uint8Array<ArrayBuffer>) {
	return apiUpload<{ text: string }>("/api/v1/creator/extract-pdf", bytes)
}
