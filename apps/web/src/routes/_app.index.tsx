import { createFileRoute, Link } from "@tanstack/react-router"
import { type ChangeEvent, useRef, useState } from "react"
import type { CourseSummary } from "@study-reader/contracts"
import {
	useCoursesQuery,
	useDeleteCourseMutation,
	useUploadCourseMutation,
} from "@/queries/courses"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/")({
	component: LibraryPage,
})

function LibraryPage() {
	const coursesQuery = useCoursesQuery()
	const uploadMutation = useUploadCourseMutation()
	const deleteMutation = useDeleteCourseMutation()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [uploadError, setUploadError] = useState<string | null>(null)

	async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const input = event.target
		const file = input.files?.[0]
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
		input.value = ""
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
				}}
			>
				<e-title level="1">{t("library.title")}</e-title>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--ink-space-3)",
					}}
				>
					<e-button variant="primary" onClick={() => fileInputRef.current?.click()}>
						{uploadMutation.isPending
							? t("library.uploading")
							: t("library.upload")}
					</e-button>
					<e-button disabled title={t("library.comingSoon")}>
						{t("library.createWithAi")}
					</e-button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".study,application/zip"
						style={{ display: "none" }}
						onChange={handleFileChange}
					/>
				</div>
			</div>

			{uploadError ? <e-alert>{uploadError}</e-alert> : null}

			{coursesQuery.isPending ? (
				<e-text>{t("library.uploading")}</e-text>
			) : coursesQuery.isError ? (
				<e-alert>{(coursesQuery.error as Error).message}</e-alert>
			) : coursesQuery.data.length === 0 ? (
				<e-empty
					heading={t("library.empty")}
					description={t("library.emptyHint")}
				/>
			) : (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
						gap: "var(--ink-space-4)",
					}}
				>
					{coursesQuery.data.map((course) => (
						<e-card key={course.id}>
							<e-title level="4">{course.title}</e-title>
							<e-text>{course.description ?? ""}</e-text>
							<div
								style={{
									display: "flex",
									gap: "var(--ink-space-2)",
									marginBottom: "var(--ink-space-3)",
								}}
							>
								<e-tag>
									{course.source === "ai"
										? t("library.sourceAi")
										: t("library.sourceUpload")}
								</e-tag>
								<e-tag>{t("library.modules", { count: course.moduleCount })}</e-tag>
								<e-tag>{t("library.lessons", { count: course.lessonCount })}</e-tag>
							</div>
							<div style={{ display: "flex", gap: "var(--ink-space-2)" }}>
								<Link
									to="/courses/$courseId"
									params={{ courseId: course.id }}
									style={{ textDecoration: "none" }}
								>
									<e-button variant="primary">{t("library.open")}</e-button>
								</Link>
								<e-button onClick={() => handleDelete(course)}>
									{t("library.delete")}
								</e-button>
							</div>
						</e-card>
					))}
				</div>
			)}
		</section>
	)
}
