import { Elysia } from "elysia"
import { AppError } from "@/error"
import { authMacros } from "@/lib/auth/auth-macros"
import { assembleBodySchema, lessonBodySchema, outlineBodySchema } from "./model"
import { CreatorService } from "./service"

export const CreatorController = new Elysia({ prefix: "/creator" })
	.use(authMacros)
	.post(
		"/outline",
		({ session, body }) => CreatorService.outline(session.user.id, body.sourceText),
		{
			auth: "session",
			body: outlineBodySchema,
			detail: { summary: "Gerar outline de curso com IA", tags: ["Creator"] },
		},
	)
	.post(
		"/lesson",
		({ session, body }) =>
			CreatorService.lesson(body.sourceText, body.outline, body.lessonId),
		{
			auth: "session",
			body: lessonBodySchema,
			detail: { summary: "Gerar o conteúdo de uma lição", tags: ["Creator"] },
		},
	)
	.post(
		"/assemble",
		({ session, body }) => CreatorService.assemble(session.user.id, body),
		{
			auth: "session",
			body: assembleBodySchema,
			detail: { summary: "Montar e salvar o curso .study", tags: ["Creator"] },
		},
	)
	.post(
		"/extract-pdf",
		async ({ request }) => {
			const bytes = new Uint8Array(await request.arrayBuffer())
			if (bytes.byteLength === 0) {
				throw new AppError("INVALID_PDF", 400, "Arquivo vazio.")
			}
			if (bytes.byteLength > 30 * 1024 * 1024) {
				throw new AppError("PACKAGE_TOO_LARGE", 413, "PDF maior que 30 MB.")
			}

			const { extractText, getDocumentProxy } = await import("unpdf")
			const pdf = await getDocumentProxy(bytes)
			const { text } = await extractText(pdf, { mergePages: true })
			const sourceText = (Array.isArray(text) ? text.join("\n\n") : text).trim()

			if (sourceText.length < 200) {
				throw new AppError(
					"INVALID_PDF",
					422,
					"Não foi possível extrair texto suficiente deste PDF (pode ser digitalizado/imagens).",
				)
			}
			return { text: sourceText.slice(0, 400_000) }
		},
		{
			auth: "session",
			detail: { summary: "Extrair texto de um PDF", tags: ["Creator"] },
		},
	)
