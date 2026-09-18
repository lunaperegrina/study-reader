import { useState } from "react"
import type { StudyQuestion } from "@study-reader/study-format"
import type { AnswerRecord } from "@study-reader/contracts"
import { InkButton, InkCard } from "@/components/ink"
import { t } from "@/locales/pt-BR"
import type { ApplyState } from "./types"

type QuizBlockProps = {
	questionId: string
	question: StudyQuestion
	answer?: AnswerRecord
	apply: ApplyState
}

function recordAnswer(
	apply: ApplyState,
	questionId: string,
	selected: string[],
	correct: boolean,
) {
	apply((draft) => {
		draft.answers[questionId] = {
			selected,
			correct,
			answeredAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
		}
		return draft
	})
}

export function QuizBlock({ questionId, question, answer, apply }: QuizBlockProps) {
	const [multiSelection, setMultiSelection] = useState<string[]>([])
	const answered = answer !== undefined

	function sameSet(a: string[], b: string[]) {
		return a.length === b.length && a.every((value) => b.includes(value))
	}

	function submitMulti() {
		if (multiSelection.length === 0) return
		const correct = sameSet(multiSelection, question.correct)
		recordAnswer(apply, questionId, [...multiSelection].sort(), correct)
	}

	function handleSingle(optionId: string) {
		if (answered) return
		const correct = sameSet([optionId], question.correct)
		recordAnswer(apply, questionId, [optionId], correct)
	}

	function toggleMulti(optionId: string) {
		if (answered) return
		setMultiSelection((previous) =>
			previous.includes(optionId)
				? previous.filter((value) => value !== optionId)
				: [...previous, optionId],
		)
	}

	return (
		<InkCard style={{ margin: "var(--ink-space-4) 0" }}>
			<p className="ink-text">{question.question}</p>
			{question.code ? (
				<pre
					style={{
						border: "1px solid var(--ink-fg)",
						padding: "var(--ink-space-3)",
						overflowX: "auto",
						fontFamily: "var(--ink-mono)",
					}}
				>
					<code>{question.code}</code>
				</pre>
			) : null}
			<div
				style={{
					display: "grid",
					gap: "var(--ink-space-2)",
					marginTop: "var(--ink-space-3)",
				}}
			>
				{question.options.map((option) => {
					const isSelected = answered
						? answer.selected.includes(option.id)
						: question.type === "multiple-choice"
							? multiSelection.includes(option.id)
							: false
					const isCorrectOption = question.correct.includes(option.id)
					return (
						<InkButton
							key={option.id}
							variant={isSelected ? "primary" : "default"}
							label={
								answered && isCorrectOption ? `${option.text}  ✓` : option.text
							}
							disabled={answered && question.type === "single-choice"}
							style={{ textAlign: "left", justifyContent: "flex-start" }}
							onClick={() =>
								question.type === "multiple-choice"
									? toggleMulti(option.id)
									: handleSingle(option.id)
							}
						/>
					)
				})}
			</div>
			{question.type === "multiple-choice" && !answered ? (
				<InkButton
					variant="primary"
					style={{ marginTop: "var(--ink-space-3)" }}
					label={t("reader.answer")}
					disabled={multiSelection.length === 0}
					onClick={submitMulti}
				/>
			) : null}
			{answered ? (
				<div style={{ marginTop: "var(--ink-space-3)" }}>
					<span className="ink-badge">
						{answer.correct ? t("reader.correct") : t("reader.incorrect")}
					</span>
					{question.explanation ? (
						<p className="ink-text" style={{ marginTop: "var(--ink-space-2)" }}>
							{question.explanation}
						</p>
					) : null}
				</div>
			) : null}
		</InkCard>
	)
}
