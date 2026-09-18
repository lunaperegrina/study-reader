import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { isDue, epochNow } from "@study-reader/srs"
import { InkButton, InkCard } from "@/components/ink"
import { apiFetchBytes } from "@/lib/api/api-client"
import { downloadBytes } from "@/lib/api/download"
import { useCoursePackageQuery, useCourseState } from "@/queries/study"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/courses/$courseId/")({
	component: CoursePage,
})

const courseRoute = getRouteApi("/_app/courses/$courseId")

function CoursePage() {
	const course = courseRoute.useLoaderData()
	const { courseId } = Route.useParams()
	const packageQuery = useCoursePackageQuery(courseId)
	const { state } = useCourseState(course.courseId)

	async function handleDownload() {
		const bytes = await apiFetchBytes(`/api/v1/courses/${courseId}/package`)
		downloadBytes(bytes, `${course.courseId}.study`)
	}

	if (packageQuery.isPending) {
		return <p className="ink-text">{t("reader.loading")}</p>
	}
	if (packageQuery.isError || !packageQuery.data) {
		return (
			<div className="ink-alert">
				{(packageQuery.error as Error)?.message ?? t("reader.loadFailed")}
			</div>
		)
	}

	const study = packageQuery.data.package
	const now = epochNow()
	const dueCount = (study.flashcards ?? []).filter((card) => {
		const review = state.reviews[card.id]
		return review ? isDue(review, now) : true
	}).length
	const completedCount = Object.keys(state.progress.completedLessons).length
	const progressPercent =
		course.lessonCount > 0
			? Math.round((completedCount / course.lessonCount) * 100)
			: 0

	return (
		<section>
			<Link to="/library">{t("course.back")}</Link>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "var(--ink-space-3)",
					flexWrap: "wrap",
				}}
			>
				<h1 className="ink-title ink-title--1">{study.manifest.title}</h1>
				<div style={{ display: "flex", gap: "var(--ink-space-2)" }}>
					{dueCount > 0 ? (
						<Link
							to="/courses/$courseId/reviews"
							params={{ courseId }}
							style={{ textDecoration: "none" }}
						>
							<InkButton
								variant="primary"
								label={t("reader.reviewsDue", { count: dueCount })}
							/>
						</Link>
					) : null}
					<InkButton label={t("course.download")} onClick={handleDownload} />
				</div>
			</div>
			{study.manifest.description ? (
				<p className="ink-text">{study.manifest.description}</p>
			) : null}

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "var(--ink-space-3)",
					margin: "var(--ink-space-4) 0",
				}}
			>
				<div
					className="ink-progress__track"
					style={{ flex: 1, height: 14, border: "var(--ink-border-width) solid var(--ink-fg)" }}
				>
					<div
						className="ink-progress__fill"
						style={{ width: `${progressPercent}%`, height: "100%", background: "var(--ink-fg)" }}
					/>
				</div>
				<span className="ink-text">
					{completedCount}/{course.lessonCount}
				</span>
			</div>

			{study.manifest.modules.map((module) => (
				<InkCard key={module.id} style={{ marginBottom: "var(--ink-space-4)" }}>
					<h3 className="ink-title ink-title--3">{module.title}</h3>
					<div>
						{module.lessons.map((lesson) => {
							const done =
								state.progress.completedLessons[lesson.id] !== undefined
							return (
								<Link
									key={lesson.id}
									to="/courses/$courseId/lesson/$lessonId"
									params={{ courseId, lessonId: lesson.id }}
									style={{
										display: "flex",
										justifyContent: "space-between",
										gap: "var(--ink-space-3)",
										padding: "var(--ink-space-2) 0",
										textDecoration: "none",
										color: "inherit",
									}}
								>
									<span>{lesson.title}</span>
									<span>{done ? "✓" : "○"}</span>
								</Link>
							)
						})}
					</div>
				</InkCard>
			))}
		</section>
	)
}
