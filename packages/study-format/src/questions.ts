import { z } from "zod";

const optionSchema = z.object({
	id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/).max(32),
	text: z.string().min(1),
});

const questionSchema = z
	.object({
		type: z.enum(["single-choice", "multiple-choice"]),
		question: z.string().min(1),
		code: z.string().optional(),
		options: z.array(optionSchema).min(2),
		correct: z.array(z.string()).min(1),
		explanation: z.string().optional(),
	})
	.refine(
		(q) => q.correct.every((id) => q.options.some((o) => o.id === id)),
		{ message: "correct references an option id that does not exist" },
	)
	.refine(
		(q) =>
			q.type === "multiple-choice" ||
			(q.correct.length === 1 && new Set(q.correct).size === 1),
		{ message: "single-choice must have exactly one correct option" },
	)
	.refine(
		(q) =>
			new Set(q.options.map((o) => o.id)).size === q.options.length,
		{ message: "option ids must be unique within a question" },
	);

export const questionsSchema = z.record(z.string(), questionSchema);

export type StudyQuestion = z.infer<typeof questionSchema>;
export type QuestionBank = Record<string, StudyQuestion>;
