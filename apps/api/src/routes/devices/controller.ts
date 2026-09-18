import { Elysia } from "elysia"
import { authMacros } from "@/lib/auth/auth-macros"
import { pairBodySchema } from "./model"
import { DevicesService } from "./service"

export const DevicesController = new Elysia({ prefix: "/devices" })
	.post(
		"/pair",
		({ body }) =>
			DevicesService.pairWithCode(body.code, body.name ?? "KOReader"),
		{
			detail: { summary: "Parear dispositivo com código", tags: ["Devices"] },
			body: pairBodySchema,
		},
	)
	.use(authMacros)
	.post(
		"/pairing-code",
		({ session }) => DevicesService.createPairingCode(session.user.id),
		{
			auth: "session",
			detail: { summary: "Gerar código de pareamento", tags: ["Devices"] },
		},
	)
	.get("/", ({ session }) => DevicesService.listDevices(session.user.id), {
		auth: "session",
	})
