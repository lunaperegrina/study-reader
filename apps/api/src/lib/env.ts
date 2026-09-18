export type AllowedOrigin = string

const defaultAllowedOrigins: AllowedOrigin[] = [
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:5173",
]

export function getAllowedOriginsFromEnv(value: string | undefined) {
	if (!value?.trim()) return defaultAllowedOrigins

	return value
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0)
}

export type ProductionEnvironment = {
	nodeEnv: string | undefined
	secret: string | undefined
	allowedOrigins: string | undefined
}

export function assertProductionEnv(env: ProductionEnvironment) {
	if (env.nodeEnv !== "production") return

	if (!env.secret || env.secret.length < 32) {
		throw new Error(
			"BETTER_AUTH_SECRET must be set with at least 32 characters in production",
		)
	}
	if (!env.allowedOrigins?.trim()) {
		throw new Error("API_ALLOWED_ORIGINS must be set in production")
	}
}
