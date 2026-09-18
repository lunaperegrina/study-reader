import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
	CourseSummary,
	DeviceSummary,
	PairingCode,
} from "@study-reader/contracts"
import { apiFetch, apiUpload } from "@/lib/api/api-client"

export const courseKeys = {
	all: ["courses"] as const,
	list: () => [...courseKeys.all, "list"] as const,
}

export function useCoursesQuery() {
	return useQuery({
		queryKey: courseKeys.list(),
		queryFn: () => apiFetch<CourseSummary[]>("/api/v1/courses"),
	})
}

export function useUploadCourseMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (bytes: Uint8Array<ArrayBuffer>) =>
			apiUpload<CourseSummary>("/api/v1/courses/upload", bytes),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: courseKeys.all })
		},
	})
}

export function useDeleteCourseMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<void>(`/api/v1/courses/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: courseKeys.all })
		},
	})
}

export const deviceKeys = {
	all: ["devices"] as const,
	list: () => [...deviceKeys.all, "list"] as const,
}

export function useDevicesQuery() {
	return useQuery({
		queryKey: deviceKeys.list(),
		queryFn: () => apiFetch<DeviceSummary[]>("/api/v1/devices"),
	})
}

export function usePairingCodeMutation() {
	return useMutation({
		mutationFn: () =>
			apiFetch<PairingCode>("/api/v1/devices/pairing-code", { method: "POST" }),
	})
}
