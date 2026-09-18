import { z } from "zod"
import { syncStateSchema } from "@study-reader/contracts"

export const courseStateParamsSchema = z.object({
	courseId: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]*$/)
		.max(128),
})

export const putStateBodySchema = syncStateSchema
