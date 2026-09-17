import { z } from "zod";

export const flashcardsSchema = z.array(
	z.object({
		id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).max(128),
		front: z.string().min(1),
		back: z.string().min(1),
		tags: z.array(z.string().max(64)).optional(),
	}),
);

export type StudyFlashcard = z.infer<typeof flashcardsSchema>[number];
export type FlashcardDeck = StudyFlashcard[];
