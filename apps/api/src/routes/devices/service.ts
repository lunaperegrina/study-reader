import { desc, eq } from "drizzle-orm"
import type { DeviceSummary, PairingCode } from "@study-reader/contracts"
import db from "@/db/client"
import { deviceTokens, pairingCodes } from "@/db/schema-exported"
import { AppError } from "@/error"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_TTL_MS = 10 * 60 * 1000

function generateCode(length = 6) {
	const values = new Uint32Array(length)
	crypto.getRandomValues(values)
	let code = ""
	for (const value of values) {
		code += CODE_ALPHABET[value % CODE_ALPHABET.length]
	}
	return code
}

/** biome-ignore lint/complexity/noStaticOnlyClass: service pattern */
export abstract class DevicesService {
	static async createPairingCode(userId: string): Promise<PairingCode> {
		await db.delete(pairingCodes).where(eq(pairingCodes.userId, userId))
		const expiresAt = new Date(Date.now() + CODE_TTL_MS)
		const [row] = await db
			.insert(pairingCodes)
			.values({
				code: generateCode(),
				userId,
				expiresAt,
			})
			.returning()
		if (!row) {
			throw new AppError(
				"PAIRING_CODE_FAILED",
				500,
				"Não foi possível gerar o código de pareamento.",
			)
		}
		return { code: row.code, expiresAt: row.expiresAt.toISOString() }
	}

	static async consumePairingCode(code: string): Promise<string> {
		const [row] = await db
			.select()
			.from(pairingCodes)
			.where(eq(pairingCodes.code, code.toUpperCase()))
			.limit(1)
		if (!row || row.expiresAt.getTime() <= Date.now()) {
			throw new AppError(
				"PAIRING_CODE_INVALID",
				400,
				"Código de pareamento inválido ou expirado.",
			)
		}
		await db.delete(pairingCodes).where(eq(pairingCodes.code, row.code))
		return row.userId
	}

	static async listDevices(userId: string): Promise<DeviceSummary[]> {
		const rows = await db
			.select()
			.from(deviceTokens)
			.where(eq(deviceTokens.userId, userId))
			.orderBy(desc(deviceTokens.createdAt))
		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			createdAt: row.createdAt.toISOString(),
			lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
		}))
	}
}
