import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import db from "@/db/client"
import * as schema from "@/db/schema-exported"
import {
	assertProductionEnv,
	getAllowedOriginsFromEnv,
	isLoopbackOrigin,
} from "@/lib/env"

assertProductionEnv({
	nodeEnv: process.env.NODE_ENV,
	secret: process.env.BETTER_AUTH_SECRET,
	allowedOrigins: process.env.API_ALLOWED_ORIGINS,
})

const isProduction = process.env.NODE_ENV === "production"
const allowedOrigins = getAllowedOriginsFromEnv(process.env.API_ALLOWED_ORIGINS)
const crossSiteCookies = process.env.AUTH_CROSS_SITE_COOKIES === "1"

export const auth = betterAuth({
	baseURL: {
		allowedHosts: ["api.study-reader.dev", "localhost:3001", "*.up.railway.app"],
		protocol: "auto",
		fallback: "http://localhost:3001",
	},
	trustedOrigins: (request) => {
		const origin = request?.headers.get("origin")
		if (!isProduction && origin && isLoopbackOrigin(origin)) {
			return [...allowedOrigins, origin]
		}
		return allowedOrigins
	},
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
		defaultCookieAttributes: crossSiteCookies
			? { sameSite: "none" as const }
			: undefined,
	},
})
