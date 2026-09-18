import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildStudy, type StudyFile, type StudyPackage } from "../src/index.ts";

const fixture = join(import.meta.dirname, "../tests/fixtures/tiny-course");

function collectFiles(dir: string, base = dir): Promise<StudyFile[]> {
	return readdir(dir).then(async (entries) => {
		const files: StudyFile[] = [];
		for (const entry of entries) {
			const full = join(dir, entry);
			if ((await stat(full)).isDirectory()) {
				files.push(...(await collectFiles(full, base)));
			} else {
				files.push({
					path: full.slice(base.length + 1).replaceAll("\\", "/"),
					data: new Uint8Array(await readFile(full)),
				});
			}
		}
		return files;
	});
}

const [manifest, questions, flashcards, files] = await Promise.all([
	readFile(join(fixture, "manifest.json"), "utf8"),
	readFile(join(fixture, "questions/questions.json"), "utf8"),
	readFile(join(fixture, "flashcards/flashcards.json"), "utf8"),
	collectFiles(fixture),
]);

const pkg: StudyPackage = {
	manifest: JSON.parse(manifest),
	questions: JSON.parse(questions),
	flashcards: JSON.parse(flashcards),
	lessonContent: {},
	files,
};

const outDir = join(import.meta.dirname, "../../../examples");
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "tiny-course.study"), buildStudy(pkg));
console.log(`✅ ${join(outDir, "tiny-course.study")}`);
