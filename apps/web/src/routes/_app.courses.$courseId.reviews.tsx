import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { useState } from "react"
import { epochNow, isDue, type GradeName } from "@study-reader/srs"
import { InkButton, InkCard } from "@/components/ink"
import { useCoursePackageQuery, useCourseState } from "@/queries/study"
import { GradeButtons, gradeCard } from "@/components/reader/flashcard-block"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/courses/$courseId/reviews")({
	component: ReviewsPage,
})

const courseRoute = getRouteApi("/_app/courses/$courseId")

function ReviewsPage() {
	const { courseId } = Route.useParams()
	const course = courseRoute.useLoaderData()
	const packageQuery = useCoursePackageQuery(courseId)
	const { state, apply } = useCourseState(course.courseId)
	const [queueIndex, setQueueIndex] = useState(0)
	const [revealed, setRevealed] = useState(false)

	if (packageQuery.isPending) {
		return <p className="ink-text">{t("reader.loading")}</p>
	}
	if (packageQuery.isError || !packageQuery.data) {
		return <div className="ink-alert">{t("reader.loadFailed")}</div>
	}

	const deck = packageQuery.data.package.flashcards ?? []
	const now = epochNow()
	const due = deck.filter((card) => {
		const review = state.reviews[card.id]
		return review ? isDue(review, now) : true
	})

	const card = due[queueIndex]

	function handleGrade(name: GradeName) {
		if (!card) return
		gradeCard(apply, card.id, state.reviews[card.id], name)
		setRevealed(false)
		setQueueIndex((index) => index + 1)
	}

	return (
		<section>
			<Link to="/courses/$courseId" params={{ courseId }}>
				← {course.title}
			</Link>
			<h2
				className="ink-title ink-title--2"
				style={{ marginTop: "var(--ink-space-3)" }}
			>
				{t("reader.reviewsTitle")}
			</h2>

			{!card ? (
				<div className="ink-empty" style={{ marginTop: "var(--ink-space-4)" }}>
					<div className="ink-empty__title">{t("reader.noReviews")}</div>
					<p className="ink-empty__desc">{t("reader.noReviewsHint")}</p>
				</div>
			) : (
				<InkCard style={{ marginTop: "var(--ink-space-4)" }}>
					<span className="ink-text ink-text--label">
						{t("reader.reviewProgress", {
							current: queueIndex + 1,
							total: due.length,
						})}
					</span>
					<hr className="ink-divider" />
					<p className="ink-text ink-text--prose">{card.front}</p>
					{revealed ? (
						<div style={{ marginTop: "var(--ink-space-3)" }}>
							<hr className="ink-divider" />
							<p className="ink-text">{card.back}</p>
							<div style={{ marginTop: "var(--ink-space-3)" }}>
								<GradeButtons onGrade={handleGrade} />
							</div>
						</div>
					) : (
						<InkButton
							variant="primary"
							style={{ marginTop: "var(--ink-space-3)" }}
							label={t("reader.showAnswer")}
							onClick={() => setRevealed(true)}
						/>
					)}
				</InkCard>
			)}
		</section>
	)
}
