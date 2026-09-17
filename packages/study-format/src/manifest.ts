import { z } from "zod";

export const FORMAT_VERSION = 1;

export const manifestSchema = z.object({
	formatVersion: z.literal(FORMAT_VERSION),
	id: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]*$/)
		.max(128),
	version: z.number().int().min(1),
	title: z.string().min(1).max(512),
	description: z.string().max(2048).optional(),
	author: z.string().max(256).optional(),
	language: z
		.string()
		.regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/)
		.optional(),
	cover: z.string().regex(/^assets\/.+$/).optional(),
	modules: z
		.array(
			z.object({
				id: z
					.string()
					.regex(/^[a-z0-9][a-z0-9-]*$/)
					.max(128),
				title: z.string().min(1).max(512),
				lessons: z
					.array(
						z.object({
							id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).max(128),
							title: z.string().min(1).max(512),
							content: z.string().regex(/^content\/.+\.md$/),
						}),
					)
					.min(1),
			}),
		)
		.min(1),
	extensions: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export type StudyManifest = z.infer<typeof manifestSchema>;

export type StudyLesson = StudyManifest["modules"][number]["lessons"][number];
export type StudyModule = StudyManifest["modules"][number];
