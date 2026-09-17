import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type SourceLesson = {
	fid: string;
	title: string;
	slug: string;
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
		const bySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
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
		const lessons: SourceLesson[] = sourceModule.lessons.map((lesson) => ({
			...lesson,
			moduleKey: key,
		}));
		const moduleDir = join(sourceRoot, contentDir, key);
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
	return join(sourceRoot, contentDir, lesson.moduleKey, `${lesson.slug}.mdx`);
}
