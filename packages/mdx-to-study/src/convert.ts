import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
	buildStudy,
	validateCrossReferences,
	type StudyFile,
	type StudyManifest,
	type QuestionBank,
} from "@study-reader/study-format";
import { readCoursePlan, lessonMdxPath } from "./course.ts";
import { extractJsxBlocks } from "./extract-jsx.ts";
import { parseQuiz, toStudyQuestions } from "./jsx-blocks.ts";
import { mdxToMarkdown } from "./mdx-to-markdown.ts";
import { compressKeyframes, loadKeyframes } from "./keyframes.ts";

export type ConvertOptions = {
	sourceRoot: string;
	contentDir: string;
	id: string;
	title: string;
	description?: string;
	author?: string;
	language?: string;
	version?: number;
	keyframesPerLesson: number;
	coverPath?: string;
};

export type ConvertResult = {
	bytes: Uint8Array;
	manifest: StudyManifest;
	stats: {
		modules: number;
		lessons: number;
		questions: number;
		images: number;
		bytes: number;
		warnings: string[];
	};
};

function pad3(n: number): string {
	return String(n).padStart(3, "0");
}

async function findCover(sourceRoot: string): Promise<string | undefined> {
	const dir = join(sourceRoot, "capa-dos-livros");
	try {
		const entries = await readdir(dir);
		return entries.find((entry) => entry.toLowerCase().endsWith(".png"))
			? join(dir, entries.find((entry) => entry.toLowerCase().endsWith(".png"))!)
			: undefined;
	} catch {
		return undefined;
	}
}

export async function convertCourse(
	options: ConvertOptions,
): Promise<ConvertResult> {
	const plan = await readCoursePlan(options.sourceRoot, options.contentDir);
	const files: StudyFile[] = [];
	const lessonContent: Record<string, string> = {};
	const questions: QuestionBank = {};
	const warnings: string[] = [];
	let imageCount = 0;
	let lessonCount = 0;
	let sequence = 0;

	const manifestModules: StudyManifest["modules"] = [];
	for (const sourceModule of plan.modules) {
		const manifestLessons: StudyManifest["modules"][number]["lessons"] = [];
		for (const sourceLesson of sourceModule.lessons) {
			sequence += 1;
			lessonCount += 1;
			const mdxPath = lessonMdxPath(
				options.sourceRoot,
				options.contentDir,
				sourceLesson,
			);
			const mdx = await readFile(mdxPath, "utf8");

			const blocks = extractJsxBlocks(mdx).blocks;
			const quizBlocks = blocks.filter((block) => block.kind === "quiz");
			const sourceQuestions = quizBlocks.flatMap((block) => parseQuiz(block));
			const quizEntries = toStudyQuestions(sourceQuestions, sourceLesson.fid);
			for (const entry of quizEntries) {
				if (questions[entry.id]) {
					throw new Error(`duplicate question id ${entry.id}`);
				}
				questions[entry.id] = entry.question;
			}

			const keyframeEntries = await loadKeyframes(
				options.sourceRoot,
				sourceLesson.fid,
			).catch(() => []);
			const assets = await compressKeyframes(
				options.sourceRoot,
				sourceLesson.fid,
				keyframeEntries,
				options.keyframesPerLesson,
			);
			for (const asset of assets) {
				files.push({ path: asset.assetPath, data: asset.data });
				imageCount += 1;
			}

			const contentPath = `content/${pad3(sequence)}-${sourceLesson.fileStem}.md`;
			const { markdown, frontmatter } = mdxToMarkdown(mdx, {
				quizIds: quizEntries.map((entry) => entry.id),
				keyframeQueue: assets.map((asset) => asset.assetPath),
			});

			if (/<(Quiz|Mermaid|Callout)[\s/>]/.test(markdown)) {
				warnings.push(
					`${contentPath}: JSX residual no markdown final (bloco inline não extraído)`,
				);
			}

			files.push({ path: contentPath, data: new TextEncoder().encode(markdown) });
			lessonContent[contentPath] = markdown;
			manifestLessons.push({
				id: sourceLesson.fid,
				title: frontmatter.title ?? sourceLesson.title,
				content: contentPath,
			});
		}
		manifestModules.push({
			id: sourceModule.key,
			title: sourceModule.title,
			lessons: manifestLessons,
		});
	}

	let cover: string | undefined;
	const coverPath = options.coverPath ?? (await findCover(options.sourceRoot));
	if (coverPath) {
		const data = await sharp(coverPath)
			.resize({ width: 1000, withoutEnlargement: true })
			.jpeg({ quality: 80 })
			.toBuffer();
		files.push({ path: "assets/cover.jpg", data });
		cover = "assets/cover.jpg";
	}

	const manifest: StudyManifest = {
		formatVersion: 1,
		id: options.id,
		version: options.version ?? 1,
		title: options.title,
		...(options.description ? { description: options.description } : {}),
		...(options.author ? { author: options.author } : {}),
		...(options.language ? { language: options.language } : {}),
		...(cover ? { cover } : {}),
		modules: manifestModules,
	};

	const pkg = {
		manifest,
		questions,
		flashcards: [],
		lessonContent,
		files,
	};
	const crossErrors = validateCrossReferences(pkg);
	if (crossErrors.length > 0) {
		throw new Error(`cross-reference errors:\n${crossErrors.join("\n")}`);
	}

	const bytes = buildStudy(pkg);
	return {
		bytes,
		manifest,
		stats: {
			modules: manifestModules.length,
			lessons: lessonCount,
			questions: Object.keys(questions).length,
			images: imageCount,
			bytes: bytes.byteLength,
			warnings,
		},
	};
}
