import { type ReactNode, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { parseDirective, type StudyDirective } from "@study-reader/study-format"
import type { SyncState } from "@study-reader/contracts"
import type { LoadedCourse } from "@/lib/study-package"
import { QuizBlock } from "./quiz-block"
import { FlashcardBlock } from "./flashcard-block"
import type { ApplyState } from "./types"

function textOf(node: ReactNode): string {
	if (node === null || node === undefined || typeof node === "boolean") return ""
	if (typeof node === "string" || typeof node === "number") return String(node)
	if (Array.isArray(node)) return node.map(textOf).join("")
	if (typeof node === "object" && "props" in node) {
		return textOf((node as { props: { children?: ReactNode } }).props?.children)
	}
	return ""
}

type MarkdownBlocksProps = {
	markdown: string
	course: LoadedCourse
	state: SyncState
	apply: ApplyState
}

export function MarkdownBlocks({ markdown, course, state, apply }: MarkdownBlocksProps) {
	const blocks = useMemo(() => markdown.split(/\n\s*\n/), [markdown])

	return (
		<div className="reader-prose">
			{blocks.map((block, index) => {
				const directive = parseDirective(block.trim())
				if (directive) {
					return (
						<DirectiveBlock
							key={index}
							directive={directive}
							course={course}
							state={state}
							apply={apply}
						/>
					)
				}
				return (
					<ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
						{block}
					</ReactMarkdown>
				)
			})}
		</div>
	)
}

function DirectiveBlock({
	directive,
	course,
	state,
	apply,
}: {
	directive: StudyDirective
	course: LoadedCourse
	state: SyncState
	apply: ApplyState
}) {
	if (directive.kind === "quiz") {
		const question = course.package.questions?.[directive.ref]
		if (!question) return null
		return (
			<QuizBlock
				questionId={directive.ref}
				question={question}
				answer={state.answers[directive.ref]}
				apply={apply}
			/>
		)
	}

	if (directive.kind === "flashcard") {
		const card = course.package.flashcards?.find(
			(entry) => entry.id === directive.ref,
		)
		if (!card) return null
		return (
			<FlashcardBlock
				card={card}
				review={state.reviews[card.id]}
				apply={apply}
			/>
		)
	}

	const url = course.assetUrl(directive.path)
	if (!url) return null
	return (
		<img
			src={url}
			alt={directive.path}
			style={{ maxWidth: "100%", border: "var(--ink-border-width) solid var(--ink-fg)" }}
		/>
	)
}
