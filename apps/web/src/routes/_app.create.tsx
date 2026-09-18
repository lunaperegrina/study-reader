import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import type { Outline } from "@study-reader/contracts"
import { InkButton, InkCard, InkInput } from "@/components/ink"
import {
	extractPdfText,
	useAssembleMutation,
	useLessonMutation,
	useOutlineMutation,
	type GeneratedLesson,
} from "@/queries/creator"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/create")({
	component: CreatePage,
})

type Step = "input" | "outline" | "generate"
type LessonStatus = "pending" | "working" | "done" | "error"

function CreatePage() {
	const navigate = useNavigate()
	const outlineMutation = useOutlineMutation()
	const lessonMutation = useLessonMutation()
	const assembleMutation = useAssembleMutation()

	const [step, setStep] = useState<Step>("input")
	const [sourceText, setSourceText] = useState("")
	const [sourceName, setSourceName] = useState<string | null>(null)
	const [outline, setOutline] = useState<Outline | null>(null)
	const [statuses, setStatuses] = useState<LessonStatus[]>([])
	const [error, setError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const allLessons = outline?.modules.flatMap((module) => module.lessons) ?? []

	async function handleFile(file: File) {
		setError(null)
		setSourceName(file.name)
		if (file.name.toLowerCase().endsWith(".pdf")) {
			try {
				const result = await extractPdfText(
					new Uint8Array((await file.arrayBuffer()) as ArrayBuffer),
				)
				setSourceText(result.text)
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : String(cause))
			}
			return
		}
		setSourceText(await file.text())
	}

	async function handleOutline() {
		setError(null)
		try {
			const result = await outlineMutation.mutateAsync(sourceText)
			setOutline(result)
			setStatuses(result.modules.flatMap((m) => m.lessons.map(() => "pending" as LessonStatus)))
			setStep("outline")
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		}
	}

	async function handleGenerate() {
		if (!outline) return
		setStep("generate")
		setError(null)

		const generated: GeneratedLesson[] = []
		try {
			for (let index = 0; index < allLessons.length; index++) {
				const lesson = allLessons[index]
				setStatuses((prev) =>
					prev.map((status, i) => (i === index ? "working" : status)),
				)
				const result = await lessonMutation.mutateAsync({
					sourceText,
					outline,
					lessonId: lesson.id,
				})
				generated.push(result)
				setStatuses((prev) =>
					prev.map((status, i) => (i === index ? "done" : status)),
				)
			}

			const course = await assembleMutation.mutateAsync({
				outline,
				lessons: generated,
			})
			navigate({ to: "/courses/$courseId", params: { courseId: course.id } })
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		}
	}

	function removeLesson(moduleIndex: number, lessonIndex: number) {
		setOutline((prev) => {
			if (!prev) return prev
			return {
				...prev,
				modules: prev.modules
					.map((module, mIndex) =>
						mIndex === moduleIndex
							? {
									...module,
									lessons: module.lessons.filter((_, lIndex) => lIndex !== lessonIndex),
								}
							: module,
					)
					.filter((module) => module.lessons.length > 0),
			}
		})
	}

	function updateLessonTitle(moduleIndex: number, lessonIndex: number, title: string) {
		setOutline((prev) => {
			if (!prev) return prev
			return {
				...prev,
				modules: prev.modules.map((module, mIndex) =>
					mIndex === moduleIndex
						? {
								...module,
								lessons: module.lessons.map((lesson, lIndex) =>
									lIndex === lessonIndex ? { ...lesson, title } : lesson,
								),
							}
						: module,
				),
			}
		})
	}

	function updateModuleTitle(moduleIndex: number, title: string) {
		setOutline((prev) => {
			if (!prev) return prev
			return {
				...prev,
				modules: prev.modules.map((module, mIndex) =>
					mIndex === moduleIndex ? { ...module, title } : module,
				),
			}
		})
	}

	const statusLabel: Record<LessonStatus, string> = {
		pending: "○",
		working: "…",
		done: "✓",
		error: "✗",
	}

	return (
		<section style={{ display: "grid", gap: "var(--ink-space-4)" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "var(--ink-space-3)",
					flexWrap: "wrap",
				}}
			>
				<h1 className="ink-title ink-title--1">{t("create.title")}</h1>
				<span className="ink-text ink-text--caption">
					{step === "input" ? t("create.step1") : step === "outline" ? t("create.step2") : t("create.step3")}
				</span>
			</div>

			{error ? <div className="ink-alert">{error}</div> : null}

			{step === "input" ? (
				<InkCard>
					<p className="ink-text">{t("create.step1Hint")}</p>
					<div style={{ display: "grid", gap: "var(--ink-space-3)", marginTop: "var(--ink-space-3)" }}>
						<textarea
							className="ink-control"
							rows={12}
							placeholder={t("create.pasteLabel")}
							value={sourceText}
							onChange={(event) => setSourceText(event.target.value)}
							style={{ fontFamily: "var(--ink-sans)" }}
						/>
						<div style={{ display: "flex", alignItems: "center", gap: "var(--ink-space-3)", flexWrap: "wrap" }}>
							<InkButton label={t("create.orFile")} onClick={() => fileInputRef.current?.click()} />
							{sourceName ? <span className="ink-text ink-text--caption">{sourceName}</span> : null}
							<input
								ref={fileInputRef}
								type="file"
								accept=".md,.mdx,.txt,.pdf"
								style={{ display: "none" }}
								onChange={(event) => {
									const file = event.target.files?.[0]
									if (file) void handleFile(file)
									event.target.value = ""
								}}
							/>
						</div>
						<div>
							<InkButton
								variant="primary"
								label={outlineMutation.isPending ? t("create.outlining") : t("create.next")}
								disabled={sourceText.trim().length < 200 || outlineMutation.isPending}
								onClick={() => void handleOutline()}
							/>
						</div>
					</div>
				</InkCard>
			) : null}

			{step === "outline" && outline ? (
				<InkCard>
					<p className="ink-text">{t("create.step2Hint")}</p>
					<div style={{ display: "grid", gap: "var(--ink-space-4)", marginTop: "var(--ink-space-3)" }}>
						{outline.modules.map((module, moduleIndex) => (
							<div key={module.id}>
								<InkInput
									label={t("create.moduleLabel", { index: moduleIndex + 1 })}
									value={module.title}
									onValueChange={(value) => updateModuleTitle(moduleIndex, value)}
								/>
								<div style={{ marginTop: "var(--ink-space-2)", display: "grid", gap: "var(--ink-space-2)" }}>
									{module.lessons.map((lesson, lessonIndex) => (
										<div key={lesson.id} style={{ display: "flex", gap: "var(--ink-space-2)", alignItems: "center" }}>
											<div style={{ flex: 1 }}>
												<InkInput
													value={lesson.title}
													onValueChange={(value) => updateLessonTitle(moduleIndex, lessonIndex, value)}
												/>
											</div>
											<span className="ink-text ink-text--caption">
												{lesson.quizCount}q · {lesson.flashcardCount}c
											</span>
											<InkButton
												label={t("create.removeLesson")}
												onClick={() => removeLesson(moduleIndex, lessonIndex)}
											/>
										</div>
									))}
								</div>
							</div>
						))}
						<div style={{ display: "flex", gap: "var(--ink-space-2)", flexWrap: "wrap" }}>
							<InkButton label={t("create.backToInput")} onClick={() => setStep("input")} />
							<InkButton
								variant="primary"
								label={t("create.generateAll", { count: allLessons.length })}
								disabled={allLessons.length === 0}
								onClick={() => void handleGenerate()}
							/>
						</div>
					</div>
				</InkCard>
			) : null}

			{step === "generate" && outline ? (
				<InkCard>
					{allLessons.map((lesson, index) => (
						<div
							key={lesson.id}
							style={{
								display: "flex",
								justifyContent: "space-between",
								gap: "var(--ink-space-3)",
								padding: "var(--ink-space-2) 0",
							}}
						>
							<span className="ink-text">
								{statuses[index] === "working" ? t("create.generatingLesson", { title: lesson.title }) : lesson.title}
							</span>
							<span>{statusLabel[statuses[index] ?? "pending"]}</span>
						</div>
					))}
					<hr className="ink-divider" />
					{assembleMutation.isPending ? (
						<p className="ink-text">{t("create.assembling")}</p>
					) : error ? (
						<div style={{ display: "flex", gap: "var(--ink-space-2)", flexWrap: "wrap" }}>
							<InkButton label={t("create.backToOutline")} onClick={() => setStep("outline")} />
							<Link to="/" style={{ textDecoration: "none" }}>
								<InkButton label={t("course.back")} />
							</Link>
						</div>
					) : null}
				</InkCard>
			) : null}
		</section>
	)
}
