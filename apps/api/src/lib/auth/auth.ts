import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import db from "@/db/client"
import * as schema from "@/db/schema-exported"
import { assertProductionEnv, getAllowedOriginsFromEnv } from "@/lib/env"

assertProductionEnv({
	nodeEnv: process.env.NODE_ENV,
	secret: process.env.BETTER_AUTH_SECRET,
	allowedOrigins: process.env.API_ALLOWED_ORIGINS,
})

export const auth = betterAuth({
	baseURL: {
		allowedHosts: ["api.study-reader.dev", "localhost:3001", "*.up.railway.app"],
		protocol: "auto",
		fallback: "http://localhost:3001",
	},
	trustedOrigins: [...getAllowedOriginsFromEnv(process.env.API_ALLOWED_ORIGINS)],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	rateLimit: {
		enabled: process.env.NODE_ENV === "production",
	},
	advanced: {
		trustedProxyHeaders: true,
	},
})
