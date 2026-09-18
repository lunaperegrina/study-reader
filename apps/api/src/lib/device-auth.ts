import { createHash, randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import db from "@/db/client"
import { deviceTokens } from "@/db/schema-exported"
import { auth } from "@/lib/auth/auth"
import { AppError } from "@/error"

export type SyncUser = { id: string }

export function hashDeviceToken(token: string) {
	return createHash("sha256").update(token).digest("hex")
}

export function generateDeviceToken() {
	return `srd_${randomBytes(24).toString("hex")}`
}

export async function resolveSyncUser(headers: Headers): Promise<SyncUser> {
	const authorization = headers.get("authorization")
	if (authorization?.startsWith("Bearer ")) {
		const token = authorization.slice(7).trim()
		if (token.length > 0) {
			const [row] = await db
				.select({ userId: deviceTokens.userId })
				.from(deviceTokens)
				.where(eq(deviceTokens.tokenHash, hashDeviceToken(token)))
				.limit(1)
			if (!row) {
				throw new AppError(
					"DEVICE_UNAUTHORIZED",
					401,
					"Dispositivo não autorizado. Pareie novamente.",
				)
			}
			void db
				.update(deviceTokens)
				.set({ lastSeenAt: new Date() })
				.where(eq(deviceTokens.tokenHash, hashDeviceToken(token)))
			return { id: row.userId }
		}
	}

	const session = await auth.api.getSession({ headers })
	if (!session?.user) {
		throw new AppError(
			"USER_NOT_AUTHENTICATED",
			401,
			"Faça login para continuar.",
		)
	}
	return { id: session.user.id }
}
