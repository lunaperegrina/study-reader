import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import type { CourseSummary } from "@study-reader/contracts"
import { InkButton, InkCard, InkFileButton } from "@/components/ink"
import {
	useCoursesQuery,
	useDeleteCourseMutation,
	useUploadCourseMutation,
} from "@/queries/courses"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/library")({
	component: LibraryPage,
})

function LibraryPage() {
	const coursesQuery = useCoursesQuery()
	const uploadMutation = useUploadCourseMutation()
	const deleteMutation = useDeleteCourseMutation()
	const [uploadError, setUploadError] = useState<string | null>(null)

	async function handleFile(file: File | undefined) {
		if (!file) return
		setUploadError(null)
		try {
			await uploadMutation.mutateAsync(
				new Uint8Array((await file.arrayBuffer()) as ArrayBuffer),
			)
		} catch (error) {
			setUploadError(
				t("library.uploadFailed", {
					reason: error instanceof Error ? error.message : String(error),
				}),
			)
		}
	}

	function handleDelete(course: CourseSummary) {
		if (!window.confirm(t("library.deleteConfirm"))) return
		deleteMutation.mutate(course.id)
	}

	return (
		<section>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "var(--ink-space-3)",
					marginBottom: "var(--ink-space-5)",
					flexWrap: "wrap",
				}}
			>
				<h1 className="ink-title ink-title--1">{t("library.title")}</h1>
				<div style={{ display: "flex", alignItems: "center", gap: "var(--ink-space-3)" }}>
					<InkFileButton
						variant="primary"
						label={
							uploadMutation.isPending
								? t("library.uploading")
								: t("library.upload")
						}
						accept=".study,application/zip"
						onFileChange={(file) => void handleFile(file)}
					/>
					<Link to="/create" style={{ textDecoration: "none" }}>
						<InkButton label={t("library.createWithAi")} />
					</Link>
				</div>
			</div>

			{uploadError ? <div className="ink-alert">{uploadError}</div> : null}

			{coursesQuery.isPending ? (
				<p className="ink-text">{t("reader.loading")}</p>
			) : coursesQuery.isError ? (
				<div className="ink-alert">{(coursesQuery.error as Error).message}</div>
			) : coursesQuery.data.length === 0 ? (
				<div className="ink-empty">
					<div className="ink-empty__title">{t("library.empty")}</div>
					<p className="ink-empty__desc">{t("library.emptyHint")}</p>
				</div>
			) : (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
						gap: "var(--ink-space-4)",
					}}
				>
					{coursesQuery.data.map((course) => (
						<InkCard key={course.id}>
							<h4 className="ink-title ink-title--4">{course.title}</h4>
							<p className="ink-text">{course.description ?? ""}</p>
							<div
								style={{
									display: "flex",
									gap: "var(--ink-space-2)",
									marginBottom: "var(--ink-space-3)",
									flexWrap: "wrap",
								}}
							>
								<span className="ink-tag">
									{course.source === "ai"
										? t("library.sourceAi")
										: t("library.sourceUpload")}
								</span>
								<span className="ink-tag">
									{t("library.modules", { count: course.moduleCount })}
								</span>
								<span className="ink-tag">
									{t("library.lessons", { count: course.lessonCount })}
								</span>
							</div>
							<div style={{ display: "flex", gap: "var(--ink-space-2)" }}>
								<Link
									to="/courses/$courseId"
									params={{ courseId: course.id }}
									style={{ textDecoration: "none" }}
								>
									<InkButton variant="primary" label={t("library.open")} />
								</Link>
								<InkButton
									label={t("library.delete")}
									onClick={() => handleDelete(course)}
								/>
							</div>
						</InkCard>
					))}
				</div>
			)}
		</section>
	)
}
