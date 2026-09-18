import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"
import { syncStateSchema, type SyncState } from "@study-reader/contracts"
import { apiFetch } from "@/lib/api/api-client"
import { loadCourse } from "@/lib/study-package"

export const coursePackageKeys = {
	all: ["course-package"] as const,
	package: (id: string) => [...coursePackageKeys.all, id] as const,
}

export function useCoursePackageQuery(courseRowId: string) {
	return useQuery({
		queryKey: coursePackageKeys.package(courseRowId),
		queryFn: () => loadCourse(courseRowId),
		staleTime: Infinity,
	})
}

export const syncKeys = {
	all: ["sync-state"] as const,
	state: (courseSlug: string) => [...syncKeys.all, courseSlug] as const,
}

export const emptySyncState: SyncState = {
	progress: { currentLesson: null, completedLessons: {} },
	answers: {},
	reviews: {},
}

export function useCourseState(courseSlug: string) {
	const queryClient = useQueryClient()
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const query = useQuery({
		queryKey: syncKeys.state(courseSlug),
		queryFn: () =>
			apiFetch<unknown>(`/api/v1/sync/courses/${courseSlug}/state`).then(
				(raw) => syncStateSchema.parse(raw),
			),
	})

	useEffect(() => {
		return () => {
			if (flushTimer.current) clearTimeout(flushTimer.current)
		}
	}, [])

	const apply = useCallback(
		(mutate: (draft: SyncState) => SyncState) => {
			const key = syncKeys.state(courseSlug)
			const current = queryClient.getQueryData<SyncState>(key) ?? emptySyncState
			const next = mutate(structuredClone(current))
			queryClient.setQueryData(key, next)

			if (flushTimer.current) clearTimeout(flushTimer.current)
			flushTimer.current = setTimeout(() => {
				const latest = queryClient.getQueryData<SyncState>(key) ?? emptySyncState
				void apiFetch(`/api/v1/sync/courses/${courseSlug}/state`, {
					method: "PUT",
					body: JSON.stringify(latest),
				}).catch((error) => {
					console.error("sync put failed", error)
				})
			}, 800)
		},
		[courseSlug, queryClient],
	)

	return { state: query.data ?? emptySyncState, apply }
}
