import { Elysia } from "elysia"
import { AppError } from "@/error"
import { auth } from "@/lib/auth/auth"

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

export const authMacros = new Elysia({ name: "auth-macros" }).macro({
	auth: (requirement: "session") => ({
		async resolve({ request: { headers } }) {
			if (requirement !== "session") {
				throw new AppError("INTERNAL_ERROR", 500, "Requisito de auth inválido.")
			}

			const session = await auth.api.getSession({ headers })
			if (!session?.user) {
				throw new AppError(
					"USER_NOT_AUTHENTICATED",
					401,
					"Faça login para continuar.",
				)
			}
			return { session }
		},
	}),
})

export type AuthSession = NonNullable<Session>
