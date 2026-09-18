import { Elysia } from "elysia"
import { resolveSyncUser } from "@/lib/device-auth"
import { courseStateParamsSchema, putStateBodySchema } from "./model"
import { SyncService } from "./service"

export const SyncController = new Elysia({ prefix: "/sync" })
	.get(
		"/courses",
		({ request }) =>
			resolveSyncUser(request.headers).then((user) =>
				SyncService.listCourses(user.id),
			),
		{
			detail: { summary: "Cursos da conta (para dispositivos)", tags: ["Sync"] },
		},
	)
	.get(
		"/courses/:courseId/state",
		({ request, params }) =>
			resolveSyncUser(request.headers).then((user) =>
				SyncService.getState(user.id, params.courseId),
			),
		{
			params: courseStateParamsSchema,
			detail: { summary: "Estado do curso (progresso/respostas/revisões)", tags: ["Sync"] },
		},
	)
	.put(
		"/courses/:courseId/state",
		({ request, params, body }) =>
			resolveSyncUser(request.headers).then((user) =>
				SyncService.putState(user.id, params.courseId, body),
			),
		{
			params: courseStateParamsSchema,
			body: putStateBodySchema,
			detail: { summary: "Mesclar e gravar estado do curso (per-key LWW)", tags: ["Sync"] },
		},
	)
	.get(
		"/courses/:courseId/package",
		({ request, params }) =>
			resolveSyncUser(request.headers).then((user) =>
				SyncService.packageBytes(user.id, params.courseId).then(
					(bytes) =>
						new Response(bytes, {
							headers: {
								"content-type": "application/octet-stream",
								"content-disposition": `attachment; filename="${params.courseId}.study"`,
							},
						}),
				),
			),
		{
			params: courseStateParamsSchema,
			detail: { summary: "Baixar o pacote .study", tags: ["Sync"] },
		},
	)
