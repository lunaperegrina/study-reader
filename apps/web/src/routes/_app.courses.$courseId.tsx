import { createFileRoute, Outlet } from "@tanstack/react-router"
import { courseSummarySchema } from "@study-reader/contracts"
import { apiFetch } from "@/lib/api/api-client"

export const Route = createFileRoute("/_app/courses/$courseId")({
	loader: ({ params: { courseId } }) =>
		apiFetch<unknown>(`/api/v1/courses/${courseId}`).then((raw) =>
			courseSummarySchema.parse(raw),
		),
	component: CourseLayout,
})

function CourseLayout() {
	return <Outlet />
}
