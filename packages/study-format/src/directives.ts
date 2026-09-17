const DIRECTIVE = /^\{\{(quiz|flashcard|image):([^}]+)\}\}$/;

export type StudyDirective =
	| { kind: "quiz"; ref: string }
	| { kind: "flashcard"; ref: string }
	| { kind: "image"; path: string };

export function parseDirective(paragraph: string): StudyDirective | undefined {
	const match = DIRECTIVE.exec(paragraph.trim());
	if (!match) return undefined;
	const kind = match[1] as "quiz" | "flashcard" | "image";
	const ref = match[2];
	if (kind === "image") return { kind, path: ref };
	return { kind, ref };
}

export function quizDirective(id: string): string {
	return `{{quiz:${id}}}`;
}

export function flashcardDirective(id: string): string {
	return `{{flashcard:${id}}}`;
}

export function imageDirective(path: string): string {
	return `{{image:${path}}}`;
}

export function extractDirectives(markdown: string): StudyDirective[] {
	return markdown
		.split(/\n\s*\n/)
		.map((p) => parseDirective(p))
		.filter((d): d is StudyDirective => d !== undefined);
}
