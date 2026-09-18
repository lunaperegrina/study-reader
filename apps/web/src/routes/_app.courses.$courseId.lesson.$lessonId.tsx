import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { useEffect } from "react"
import { InkButton } from "@/components/ink"
import { useCoursePackageQuery, useCourseState } from "@/queries/study"
import { MarkdownBlocks } from "@/components/reader/markdown-blocks"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute(
	"/_app/courses/$courseId/lesson/$lessonId",
)({
	component: LessonPage,
})

const courseRoute = getRouteApi("/_app/courses/$courseId")

function LessonPage() {
	const { courseId, lessonId } = Route.useParams()
	const course = courseRoute.useLoaderData()
	const packageQuery = useCoursePackageQuery(courseId)
	const { state, apply } = useCourseState(course.courseId)

	useEffect(() => {
		apply((draft) => {
			draft.progress.currentLesson = lessonId
			return draft
		})
	}, [apply, lessonId])

	if (packageQuery.isPending) {
		return <p className="ink-text">{t("reader.loading")}</p>
	}
	if (packageQuery.isError || !packageQuery.data) {
		return <div className="ink-alert">{t("reader.loadFailed")}</div>
	}

	const loaded = packageQuery.data
	const study = loaded.package
	const allLessons = study.manifest.modules.flatMap((module) => module.lessons)
	const index = allLessons.findIndex((lesson) => lesson.id === lessonId)
	const lesson = allLessons[index]
	if (!lesson) {
		return <div className="ink-alert">{t("reader.lessonNotFound")}</div>
	}

	const content = study.lessonContent[lesson.content] ?? ""
	const previous = allLessons[index - 1]
	const next = allLessons[index + 1]
	const done = state.progress.completedLessons[lesson.id] !== undefined

	function completeLesson() {
		apply((draft) => {
			draft.progress.completedLessons[lessonId] = new Date()
				.toISOString()
				.replace(/\.\d{3}Z$/, "Z")
			return draft
		})
	}

	return (
		<article>
			<Link to="/courses/$courseId" params={{ courseId }}>
				← {study.manifest.title}
			</Link>
			<h2
				className="ink-title ink-title--2"
				style={{ marginTop: "var(--ink-space-3)" }}
			>
				{lesson.title}
			</h2>
			<MarkdownBlocks
				markdown={content}
				course={loaded}
				state={state}
				apply={apply}
			/>

			<hr className="ink-divider" />
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					gap: "var(--ink-space-3)",
					flexWrap: "wrap",
					marginTop: "var(--ink-space-4)",
				}}
			>
				<div style={{ display: "flex", gap: "var(--ink-space-2)" }}>
					{previous ? (
						<Link
							to="/courses/$courseId/lesson/$lessonId"
							params={{ courseId, lessonId: previous.id }}
							style={{ textDecoration: "none" }}
						>
							<InkButton label={`← ${previous.title}`} />
						</Link>
					) : null}
					{next ? (
						<Link
							to="/courses/$courseId/lesson/$lessonId"
							params={{ courseId, lessonId: next.id }}
							style={{ textDecoration: "none" }}
						>
							<InkButton label={`${next.title} →`} />
						</Link>
					) : null}
				</div>
				{!done ? (
					<InkButton
						variant="primary"
						label={t("reader.completeLesson")}
						onClick={completeLesson}
					/>
				) : (
					<span className="ink-badge">{t("reader.lessonDone")}</span>
				)}
			</div>
		</article>
	)
}
