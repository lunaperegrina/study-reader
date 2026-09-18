import { z } from "zod"

export const pairBodySchema = z.object({
	code: z.string().regex(/^[A-Z0-9]{6}$/),
	name: z.string().max(64).optional(),
})
