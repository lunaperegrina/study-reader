import { createFileRoute, Link } from "@tanstack/react-router"
import { courseSummarySchema } from "@study-reader/contracts"
import { apiFetch, apiFetchBytes } from "@/lib/api/api-client"
import { downloadBytes } from "@/lib/api/download"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/courses/$courseId")({
	loader: ({ params: { courseId } }) =>
		apiFetch<unknown>(`/api/v1/courses/${courseId}`).then((raw) =>
			courseSummarySchema.parse(raw),
		),
	component: CoursePage,
})

function CoursePage() {
	const course = Route.useLoaderData()
	const { courseId } = Route.useParams()

	async function handleDownload() {
		const bytes = await apiFetchBytes(`/api/v1/courses/${courseId}/package`)
		downloadBytes(bytes, `${course.courseId}.study`)
	}

	return (
		<section>
			<Link to="/">{t("course.back")}</Link>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "var(--ink-space-3)",
				}}
			>
				<e-title level="1">{course.title}</e-title>
				<e-button onClick={handleDownload}>{t("course.download")}</e-button>
			</div>
			{course.description ? <e-text>{course.description}</e-text> : null}
			<e-list>
				<e-text>
					{t("course.author")}: {course.author ?? "—"}
				</e-text>
				<e-text>
					{t("course.language")}: {course.language ?? "—"}
				</e-text>
				<e-text>
					{t("course.version")}: {course.version}
				</e-text>
				<e-text>
					{t("library.modules", { count: course.moduleCount })} ·{" "}
					{t("library.lessons", { count: course.lessonCount })}
				</e-text>
			</e-list>
		</section>
	)
}
