import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { convertCourse } from "./convert.ts";

type Args = {
	source?: string;
	out: string;
	contentDir: string;
	id: string;
	title: string;
	description?: string;
	author?: string;
	language?: string;
	version: number;
	keyframes: number;
	cover?: string;
	filename?: string;
};

function parseArgs(argv: string[]): Args & { source: string } {
	const args: Args = {
		out: "examples",
		contentDir: "site/content/docs",
		id: "course-system-design-em-livro",
		title: "System Design em Livro",
		version: 1,
		keyframes: 4,
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const next = (): string => {
			i += 1;
			const value = argv[i];
			if (value === undefined) throw new Error(`missing value for ${arg}`);
			return value;
		};
		switch (arg) {
			case "--source":
				args.source = next();
				break;
			case "--out":
				args.out = next();
				break;
			case "--content-dir":
				args.contentDir = next();
				break;
			case "--id":
				args.id = next();
				break;
			case "--title":
				args.title = next();
				break;
			case "--description":
				args.description = next();
				break;
			case "--author":
				args.author = next();
				break;
			case "--language":
				args.language = next();
				break;
			case "--version":
				args.version = Number(next());
				break;
			case "--keyframes":
				args.keyframes = Number(next());
				break;
			case "--no-keyframes":
				args.keyframes = 0;
				break;
			case "--cover":
				args.cover = next();
				break;
			case "--filename":
				args.filename = next();
				break;
			case "--":
				break;
			default:
				throw new Error(`unknown argument: ${arg}`);
		}
	}
	if (!args.source) {
		throw new Error(
			"usage: convert --source <course-books-dir> [--out examples] [--keyframes 4] ...",
		);
	}
	return args as Args & { source: string };
}

const args = parseArgs(process.argv.slice(2));
const result = await convertCourse({
	sourceRoot: resolve(args.source),
	contentDir: args.contentDir,
	id: args.id,
	title: args.title,
	description: args.description,
	author: args.author,
	language: args.language,
	version: args.version,
	keyframesPerLesson: args.keyframes,
	coverPath: args.cover ? resolve(args.cover) : undefined,
});

const outPath = resolve(args.out, `${args.filename ?? args.id}.study`);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, result.bytes);

const mb = (result.stats.bytes / 1024 / 1024).toFixed(1);
console.log(`✅ ${outPath}`);
console.log(
	`${result.stats.modules} módulos · ${result.stats.lessons} lições · ${result.stats.questions} questões · ${result.stats.images} imagens · ${mb} MB`,
);
for (const warning of result.stats.warnings) {
	console.warn(`⚠️  ${warning}`);
}
