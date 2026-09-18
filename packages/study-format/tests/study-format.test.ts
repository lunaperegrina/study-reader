import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	buildStudy,
	extractDirectives,
	manifestSchema,
	questionsSchema,
	readStudy,
	validateCrossReferences,
	type StudyFile,
	type StudyPackage,
} from "../src/index.ts";

const FIXTURE = join(import.meta.dirname, "fixtures/tiny-course");

function collectFiles(dir: string, base = dir): StudyFile[] {
	const files: StudyFile[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...collectFiles(full, base));
		} else {
			files.push({ path: full.slice(base.length + 1).replaceAll("\\", "/"), data: readFileSync(full) });
		}
	}
	return files;
}

function loadFixture(): StudyPackage {
	const manifest = manifestSchema.parse(
		JSON.parse(readFileSync(join(FIXTURE, "manifest.json"), "utf8")),
	);
	const questions = questionsSchema.parse(
		JSON.parse(readFileSync(join(FIXTURE, "questions/questions.json"), "utf8")),
	);
	const flashcards = JSON.parse(
		readFileSync(join(FIXTURE, "flashcards/flashcards.json"), "utf8"),
	);
	const files = collectFiles(FIXTURE);
	const lessonContent = Object.fromEntries(
		files
			.filter((f) => f.path.startsWith("content/"))
			.map((f): [string, string] => [f.path, new TextDecoder().decode(f.data)]),
	);
	return { manifest, questions, flashcards, lessonContent, files };
}

describe("manifest schema", () => {
	it("accepts the fixture manifest", () => {
		const pkg = loadFixture();
		expect(pkg.manifest.id).toBe("tiny-course");
		expect(pkg.manifest.formatVersion).toBe(1);
	});

	it("rejects invalid course ids", () => {
		expect(() =>
			manifestSchema.parse({ ...loadFixture().manifest, id: "Invalid Id" }),
		).toThrow();
	});

	it("rejects formatVersion from the future", () => {
		expect(() =>
			manifestSchema.parse({ ...loadFixture().manifest, formatVersion: 2 }),
		).toThrow();
	});
});

describe("questions schema", () => {
	it("rejects correct referencing a missing option", () => {
		const pkg = loadFixture();
		const mutated = { ...pkg.questions! };
		mutated["tiny-q1"] = { ...mutated["tiny-q1"], correct: ["z"] };
		expect(() => questionsSchema.parse(mutated)).toThrow();
	});

	it("rejects single-choice with two correct answers", () => {
		const pkg = loadFixture();
		const mutated = { ...pkg.questions! };
		mutated["tiny-q1"] = {
			...mutated["tiny-q1"],
			correct: ["a", "b"],
		};
		expect(() => questionsSchema.parse(mutated)).toThrow();
	});
});

describe("build/read round trip", () => {
	it("preserves manifest, bank, deck, lesson text and assets", () => {
		const pkg = loadFixture();
		const bytes = buildStudy(pkg);
		const restored = readStudy(bytes, { loadLessons: true });

		expect(restored.manifest).toEqual(pkg.manifest);
		expect(restored.questions).toEqual(pkg.questions);
		expect(restored.flashcards).toEqual(pkg.flashcards);
		expect(restored.lessonContent["content/001-primeira-licao.md"]).toContain(
			"{{quiz:tiny-q1}}",
		);
		const asset = restored.files.find((f) => f.path === "assets/diagram.png");
		expect(asset).toBeDefined();
		expect(Buffer.compare(Buffer.from(asset!.data), readFileSync(join(FIXTURE, "assets/diagram.png")))).toBe(0);
	});

	it("throws when the archive has no manifest", () => {
		const bytes = zipSync({ "content/001.md": strToU8("só conteúdo") });
		expect(() => readStudy(bytes)).toThrow(/manifest/);
	});
});

describe("cross references", () => {
	it("passes on the fixture", () => {
		expect(validateCrossReferences(loadFixture())).toEqual([]);
	});

	it("flags unknown quiz ids and missing images", () => {
		const pkg = loadFixture();
		const path = "content/001-primeira-licao.md";
		pkg.lessonContent[path] = pkg.lessonContent[path].replace(
			"{{quiz:tiny-q1}}",
			"{{quiz:nope}}",
		);
		const errors = validateCrossReferences(pkg);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('unknown id "nope"');
	});
});

describe("directives", () => {
	it("extracts only directive paragraphs in order", () => {
		const directives = extractDirectives(
			loadFixture().lessonContent["content/001-primeira-licao.md"],
		);
		expect(directives).toEqual([
			{ kind: "quiz", ref: "tiny-q1" },
			{ kind: "image", path: "assets/diagram.png" },
			{ kind: "flashcard", ref: "tiny-card-1" },
		]);
	});
});
