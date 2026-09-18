import { Elysia } from "elysia"
import { authMacros } from "@/lib/auth/auth-macros"
import { courseStateParamsSchema, putStateBodySchema } from "./model"
import { SyncService } from "./service"

export const SyncController = new Elysia({ prefix: "/sync" })
	.use(authMacros)
	.get(
		"/courses/:courseId/state",
		({ session, params }) =>
			SyncService.getState(session.user.id, params.courseId),
		{
			auth: "session",
			params: courseStateParamsSchema,
			detail: { summary: "Estado do curso (progresso/respostas/revisões)", tags: ["Sync"] },
		},
	)
	.put(
		"/courses/:courseId/state",
		({ session, params, body }) =>
			SyncService.putState(session.user.id, params.courseId, body),
		{
			auth: "session",
			params: courseStateParamsSchema,
			body: putStateBodySchema,
			detail: { summary: "Mesclar e gravar estado do curso (per-key LWW)", tags: ["Sync"] },
		},
	)
