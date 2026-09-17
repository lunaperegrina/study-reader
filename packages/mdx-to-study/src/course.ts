import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export type SourceLesson = {
	fid: string;
	title: string;
	slug: string;
	fileStem: string;
	moduleKey: string;
};

export type SourceModule = {
	key: string;
	title: string;
	lessons: SourceLesson[];
};

export type CoursePlan = {
	modules: SourceModule[];
};

type SourceManifest = {
	modules: Record<
		string,
		{
			title: string;
			lessons: Array<{ fid: string; title: string; slug: string }>;
		}
	>;
};

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(path, "utf8"));
}

async function moduleOrder(
	contentDir: string,
	manifestKeys: string[],
): Promise<string[]> {
	const set = new Set(manifestKeys);
	try {
		const meta = (await readJson(join(contentDir, "meta.json"))) as {
			pages?: string[];
		};
		const ordered = (meta.pages ?? []).filter(
			(page) => page !== "---" && set.has(page),
		);
		const covered = new Set(ordered);
		return [...ordered, ...manifestKeys.filter((key) => !covered.has(key))];
	} catch {
		return manifestKeys;
	}
}

async function lessonOrder(
	moduleDir: string,
	lessons: SourceLesson[],
): Promise<SourceLesson[]> {
	try {
		const meta = (await readJson(join(moduleDir, "meta.json"))) as {
			pages?: string[];
		};
		const bySlug = new Map(lessons.map((lesson) => [lesson.fileStem, lesson]));
		const ordered: SourceLesson[] = [];
		for (const page of meta.pages ?? []) {
			const lesson = bySlug.get(page);
			if (lesson) {
				ordered.push(lesson);
				bySlug.delete(page);
			}
		}
		return [...ordered, ...bySlug.values()];
	} catch {
		return lessons;
	}
}

async function resolveStem(moduleDir: string, slug: string): Promise<string> {
	const exists = await readFile(join(moduleDir, `${slug}.mdx`), "utf8")
		.then(() => true)
		.catch(() => false);
	if (exists) return slug;
	const stems = (await readdir(moduleDir))
		.filter((entry) => entry.endsWith(".mdx"))
		.map((entry) => entry.slice(0, -4));
	const candidates = stems.filter(
		(stem) =>
			slug === stem ||
			slug.startsWith(`${stem}-`) ||
			stem.startsWith(`${slug}-`),
	);
	if (candidates.length !== 1) {
		throw new Error(`cannot resolve lesson file for slug "${slug}" in ${moduleDir}`);
	}
	return candidates[0];
}

export async function readCoursePlan(
	sourceRoot: string,
	contentDir: string,
): Promise<CoursePlan> {
	const manifest = (await readJson(
		join(sourceRoot, "manifest.json"),
	)) as SourceManifest;
	const keys = Object.keys(manifest.modules);
	const orderedKeys = await moduleOrder(join(sourceRoot, contentDir), keys);

	const modules: SourceModule[] = [];
	for (const key of orderedKeys) {
		const sourceModule = manifest.modules[key];
		if (!sourceModule) continue;
		const moduleDir = join(sourceRoot, contentDir, key);
		const lessons: SourceLesson[] = [];
		for (const lesson of sourceModule.lessons) {
			lessons.push({
				...lesson,
				fileStem: await resolveStem(moduleDir, lesson.slug),
				moduleKey: key,
			});
		}
		modules.push({
			key,
			title: sourceModule.title,
			lessons: await lessonOrder(moduleDir, lessons),
		});
	}
	return { modules };
}

export function lessonMdxPath(
	sourceRoot: string,
	contentDir: string,
	lesson: SourceLesson,
): string {
	return join(sourceRoot, contentDir, lesson.moduleKey, `${lesson.fileStem}.mdx`);
}
