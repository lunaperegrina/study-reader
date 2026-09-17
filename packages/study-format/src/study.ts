import { strFromU8, strToU8, zipSync, unzipSync } from "fflate";
import { manifestSchema, type StudyManifest } from "./manifest.ts";
import { questionsSchema, type QuestionBank } from "./questions.ts";
import { flashcardsSchema, type FlashcardDeck } from "./flashcards.ts";

export const MANIFEST_PATH = "manifest.json";
export const QUESTIONS_PATH = "questions/questions.json";
export const FLASHCARDS_PATH = "flashcards/flashcards.json";

export type StudyFile = { path: string; data: Uint8Array };

export type StudyPackage = {
	manifest: StudyManifest;
	questions?: QuestionBank;
	flashcards?: FlashcardDeck;
	lessonContent: Record<string, string>;
	files: StudyFile[];
};

export type ReadOptions = {
	/** Load every lesson into `lessonContent` instead of leaving them in `files`. */
	loadLessons?: boolean;
};

export function buildStudy(pkg: StudyPackage): Uint8Array {
	const entries: Record<string, Uint8Array> = {};
	for (const file of pkg.files) {
		entries[file.path] = file.data;
	}
	entries[MANIFEST_PATH] = strToU8(JSON.stringify(pkg.manifest, null, "\t"));
	if (pkg.questions) {
		entries[QUESTIONS_PATH] = strToU8(
			JSON.stringify(pkg.questions, null, "\t"),
		);
	}
	if (pkg.flashcards) {
		entries[FLASHCARDS_PATH] = strToU8(
			JSON.stringify(pkg.flashcards, null, "\t"),
		);
	}
	return zipSync(entries, { level: 6 });
}

export function readStudy(
	bytes: Uint8Array,
	options: ReadOptions = {},
): StudyPackage {
	const unzipped = unzipSync(bytes);
	const paths = Object.keys(unzipped);
	const manifestRaw = unzipped[MANIFEST_PATH];
	if (!manifestRaw) {
		throw new Error(`missing ${MANIFEST_PATH}`);
	}
	const manifest = manifestSchema.parse(JSON.parse(strFromU8(manifestRaw)));

	const files: StudyFile[] = paths.map((path) => ({
		path,
		data: unzipped[path],
	}));

	const questionsRaw = unzipped[QUESTIONS_PATH];
	const questions = questionsRaw
		? (questionsSchema.parse(JSON.parse(strFromU8(questionsRaw))) as QuestionBank)
		: undefined;

	const flashcardsRaw = unzipped[FLASHCARDS_PATH];
	const flashcards = flashcardsRaw
		? (flashcardsSchema.parse(
				JSON.parse(strFromU8(flashcardsRaw)),
			) as FlashcardDeck)
		: undefined;

	const lessonContent: Record<string, string> = {};
	for (const module of manifest.modules) {
		for (const lesson of module.lessons) {
			const raw = unzipped[lesson.content];
			if (!raw) {
				throw new Error(`lesson file missing from archive: ${lesson.content}`);
			}
			if (options.loadLessons) {
				lessonContent[lesson.content] = strFromU8(raw);
			}
		}
	}

	return { manifest, questions, flashcards, lessonContent, files };
}

export function validateCrossReferences(pkg: StudyPackage): string[] {
	const errors: string[] = [];
	const questionIds = new Set(Object.keys(pkg.questions ?? {}));
	const flashcardIds = new Set((pkg.flashcards ?? []).map((c) => c.id));

	for (const [path, content] of Object.entries(pkg.lessonContent)) {
		for (const paragraph of content.split(/\n\s*\n/)) {
			const trimmed = paragraph.trim();
			const match = /^\{\{(quiz|flashcard|image):([^}]+)\}\}$/.exec(trimmed);
			if (!match) continue;
			const [, kind, ref] = match;
			if (kind === "quiz" && !questionIds.has(ref)) {
				errors.push(`${path}: quiz directive references unknown id "${ref}"`);
			}
			if (kind === "flashcard" && !flashcardIds.has(ref)) {
				errors.push(
					`${path}: flashcard directive references unknown id "${ref}"`,
				);
			}
			if (kind === "image" && !pkg.files.some((f) => f.path === ref)) {
				errors.push(`${path}: image directive references missing file "${ref}"`);
			}
		}
	}
	return errors;
}
