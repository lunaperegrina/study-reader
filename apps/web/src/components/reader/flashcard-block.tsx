import { useState } from "react"
import type { StudyFlashcard } from "@study-reader/study-format"
import { GRADES, grade, type GradeName } from "@study-reader/srs"
import type { ReviewRecord } from "@study-reader/contracts"
import { InkButton, InkCard } from "@/components/ink"
import { t } from "@/locales/pt-BR"
import type { ApplyState } from "./types"

type FlashcardBlockProps = {
	card: StudyFlashcard
	review?: ReviewRecord
	apply: ApplyState
}

const gradeLabels: Record<GradeName, string> = {
	again: t("reader.gradeAgain"),
	hard: t("reader.gradeHard"),
	good: t("reader.gradeGood"),
	easy: t("reader.gradeEasy"),
}

export function GradeButtons({
	onGrade,
	disabled,
}: {
	onGrade: (grade: GradeName) => void
	disabled?: boolean
}) {
	return (
		<div style={{ display: "flex", gap: "var(--ink-space-2)", flexWrap: "wrap" }}>
			{GRADES.map((name) => (
				<InkButton
					key={name}
					label={gradeLabels[name]}
					disabled={disabled}
					onClick={() => onGrade(name)}
				/>
			))}
		</div>
	)
}

export function gradeCard(
	apply: ApplyState,
	cardId: string,
	review: ReviewRecord | undefined,
	name: GradeName,
) {
	const base = review ?? {
		reps: 0,
		lapses: 0,
		ef: 2.5,
		interval: 0,
		due: Math.floor(Date.now() / 1000),
	}
	const graded = grade(base, name)
	apply((draft) => {
		draft.reviews[cardId] = graded
		return draft
	})
}

export function FlashcardBlock({ card, review, apply }: FlashcardBlockProps) {
	const [revealed, setRevealed] = useState(false)
	const [graded, setGraded] = useState(false)

	return (
		<InkCard style={{ margin: "var(--ink-space-4) 0" }}>
			<p className="ink-text" style={{ fontWeight: 700 }}>
				{card.front}
			</p>
			{revealed ? (
				<div style={{ marginTop: "var(--ink-space-3)" }}>
					<hr className="ink-divider" />
					<p className="ink-text">{card.back}</p>
					<div style={{ marginTop: "var(--ink-space-3)" }}>
						{graded ? (
							<span className="ink-badge">{t("reader.reviewRecorded")}</span>
						) : (
							<GradeButtons
								onGrade={(name) => {
									gradeCard(apply, card.id, review, name)
									setGraded(true)
								}}
							/>
						)}
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
	)
}
