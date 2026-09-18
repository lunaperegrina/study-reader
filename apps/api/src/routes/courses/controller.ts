import { Elysia } from "elysia"
import { AppError } from "@/error"
import { authMacros } from "@/lib/auth/auth-macros"
import { MAX_PACKAGE_BYTES } from "./package-validation"
import { courseIdParamsSchema } from "./model"
import { CoursesService } from "./service"

export const CoursesController = new Elysia({ prefix: "/courses" })
	.use(authMacros)
	.get("/", ({ session }) => CoursesService.list(session.user.id), {
		auth: "session",
	})
	.post(
		"/upload",
		async ({ session, request }) => {
			const declaredLength = Number(request.headers.get("content-length") ?? "0")
			if (declaredLength > MAX_PACKAGE_BYTES) {
				throw new AppError("PACKAGE_TOO_LARGE", 413, "Pacote maior que 50 MB.")
			}
			return CoursesService.upload(
				session.user.id,
				new Uint8Array(await request.arrayBuffer()),
			)
		},
		{
			auth: "session",
			detail: { summary: "Enviar pacote .study", tags: ["Courses"] },
		},
	)
	.get("/:id", ({ session, params }) => CoursesService.get(session.user.id, params.id), {
		auth: "session",
		params: courseIdParamsSchema,
	})
	.delete(
		"/:id",
		({ session, params }) => CoursesService.remove(session.user.id, params.id),
		{
			auth: "session",
			params: courseIdParamsSchema,
		},
	)
	.get(
		"/:id/package",
		({ session, params }) =>
			CoursesService.packageBytes(session.user.id, params.id).then(
				(bytes) =>
					new Response(bytes, {
						headers: {
							"content-type": "application/octet-stream",
							"content-disposition": 'attachment; filename="course.study"',
						},
					}),
			),
		{
			auth: "session",
			params: courseIdParamsSchema,
		},
	)
