import { runInNewContext } from "node:vm";
import type { JsxBlock } from "./extract-jsx.ts";
import { balanceBraces } from "./extract-jsx.ts";
import type { StudyQuestion } from "@study-reader/study-format";

export type SourceQuizQuestion = {
	prompt: string;
	code?: string;
	multiple?: boolean;
	options: string[];
	answer: number | number[];
	explanation: string;
};

export type ParsedCallout = {
	type: "info" | "warning";
	text: string;
};

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function optionsWithIds(options: string[]) {
	return options.map((text, index) => ({
		id: LETTERS[index] ?? `o${index}`,
		text,
	}));
}

export function parseQuiz(block: JsxBlock): SourceQuizQuestion[] {
	const start = block.raw.indexOf("questions={");
	if (start === -1) {
		throw new Error(`Quiz block without questions prop (line ${block.line})`);
	}
	const open = start + "questions=".length;
	const close = balanceBraces(block.raw, open);
	if (close === -1) {
		throw new Error(`Unbalanced questions prop (line ${block.line})`);
	}
	const expression = block.raw.slice(open + 1, close);
	const questions = runInNewContext(`(${expression})`, {}, {
		timeout: 5000,
	}) as SourceQuizQuestion[];
	return questions;
}

export function toStudyQuestions(
	source: SourceQuizQuestion[],
	idPrefix: string,
): Array<{ id: string; question: StudyQuestion }> {
	return source.map((q, index) => {
		const options = optionsWithIds(q.options);
		const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
		const correct = answers.map((n) => {
			const option = options[n];
			if (!option) {
				throw new Error(`answer index ${n} out of range in ${idPrefix}`);
			}
			return option.id;
		});
		const type =
			q.multiple === true || correct.length > 1
				? "multiple-choice"
				: "single-choice";
		return {
			id: `${idPrefix}-q${index + 1}`,
			question: {
				type,
				question: q.prompt,
				...(q.code ? { code: q.code } : {}),
				options,
				correct,
				...(q.explanation ? { explanation: q.explanation } : {}),
			},
		};
	});
}

export function parseCallout(block: JsxBlock): ParsedCallout {
	const typeMatch = /type="(info|warning)"/.exec(block.raw);
	const type = (typeMatch?.[1] ?? "info") as "info" | "warning";
	const open = block.raw.indexOf(">");
	const close = block.raw.lastIndexOf("</Callout>");
	const text = block.raw.slice(open + 1, close).trim().replace(/\s+/g, " ");
	return { type, text };
}
