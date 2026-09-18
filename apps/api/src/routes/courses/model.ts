import { z } from "zod"

export const courseIdParamsSchema = z.object({
	id: z.string().uuid(),
})

export type CourseIdParams = z.infer<typeof courseIdParamsSchema>
