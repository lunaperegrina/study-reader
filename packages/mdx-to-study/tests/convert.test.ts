import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { convertCourse } from "../src/convert.ts";
import { readStudy } from "@study-reader/study-format";
import { extractJsxBlocks } from "../src/extract-jsx.ts";
import { selectKeyframes } from "../src/keyframes.ts";

const SOURCE = join(import.meta.dirname, "fixtures/mini-course");

async function convertFixture() {
	return convertCourse({
		sourceRoot: SOURCE,
		contentDir: "site/content/docs",
		id: "mini-course",
		title: "Mini Course",
		language: "pt-BR",
		keyframesPerLesson: 2,
	});
}

describe("extractJsxBlocks", () => {
	it("extracts Mermaid, Callout and Quiz blocks leaving placeholders", () => {
		const mdx = `Intro\n\n<Mermaid chart={\`flowchart TD\n    A --> B\`} />\n\nMeio.\n\n<Callout type="info">nota</Callout>\n\n<Quiz\n  questions={[{\n    prompt: "p",\n    options: ["a", "b"],\n    answer: [0],\n    explanation: "e"\n  }]}\n/>\n\nFim.`;
		const { markdown, blocks } = extractJsxBlocks(mdx);
		expect(blocks.map((b) => b.kind)).toEqual(["mermaid", "callout", "quiz"]);
		expect(markdown).not.toContain("<Quiz");
		expect(markdown).not.toContain("<Mermaid");
		expect(markdown).not.toContain("<Callout");
		expect(markdown).toContain("%%JSX:0%%");
		expect(markdown).toContain("Intro");
		expect(markdown).toContain("Fim.");
	});
});

describe("selectKeyframes", () => {
	it("spreads selection over the timeline preferring stability", () => {
		const selected = selectKeyframes(
			[
				{ t: 0.5, stable_for: 3, png: "a" },
				{ t: 100, stable_for: 8, png: "b" },
				{ t: 200, stable_for: 5, png: "c" },
			],
			2,
		);
		expect(selected.map((k) => k.png)).toEqual(["b", "c"]);
	});
});

describe("convertCourse", () => {
	it("produces a valid .study honoring meta.json ordering and directives", async () => {
		const result = await convertFixture();
		expect(result.stats.warnings).toEqual([]);

		const pkg = readStudy(result.bytes, { loadLessons: true });

		expect(pkg.manifest.id).toBe("mini-course");
		expect(pkg.manifest.language).toBe("pt-BR");
		expect(pkg.manifest.cover).toBe("assets/cover.jpg");
		expect(pkg.files.some((f) => f.path === "assets/cover.jpg")).toBe(true);

		expect(pkg.manifest.modules.map((m) => m.id)).toEqual(["mod-b", "mod-a"]);
		const [modB, modA] = pkg.manifest.modules;
		expect(modB.lessons[0].content).toBe("content/001-unica.md");
		expect(modA.lessons.map((l) => l.id)).toEqual(["T02", "T01"]);
		expect(modA.lessons[0].content).toBe("content/002-segunda.md");
		expect(modA.lessons[1].content).toBe("content/003-primeira.md");
		expect(modA.lessons[1].title).toBe("Primeira Lição");

		expect(Object.keys(pkg.questions!).sort()).toEqual([
			"T01-q1",
			"T01-q2",
			"T02-q1",
		]);
		expect(pkg.questions!["T01-q1"]).toMatchObject({
			type: "single-choice",
			correct: ["a"],
		});
		expect(pkg.questions!["T01-q2"]).toMatchObject({
			type: "multiple-choice",
			correct: ["a", "b"],
		});
		expect(pkg.questions!["T01-q1"].options[1].text).toBe("Disponibilidade");

		const primeira = pkg.lessonContent["content/003-primeira.md"];
		expect(primeira).toContain("{{quiz:T01-q1}}");
		expect(primeira).toContain("{{quiz:T01-q2}}");
		expect(primeira).toContain("{{image:assets/T01-k1.jpg}}");
		expect(primeira).toContain("{{image:assets/T01-k2.jpg}}");
		expect(primeira).toContain("> ⚠️ Um NoSQL pode implementar");
		expect(primeira).toMatch(/^\| *Letra *\| *Propriedade *\|/m);
		expect(primeira).not.toContain("title: Primeira Lição");
		expect(primeira).not.toContain("<Quiz");
		expect(primeira).not.toContain("<Mermaid");
		expect(primeira).not.toContain("<Callout");

		expect(pkg.files.some((f) => f.path === "assets/T01-k1.jpg")).toBe(true);
		expect(pkg.files.some((f) => f.path === "assets/T01-k2.jpg")).toBe(true);
		expect(pkg.files.some((f) => f.path === "assets/T02-k1.jpg")).toBe(true);

		const unica = pkg.lessonContent["content/001-unica.md"];
		expect(unica).toContain("Só texto puro aqui.");
	});
});
