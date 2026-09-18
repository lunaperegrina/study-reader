import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { AppError } from "./error"
import { auth } from "./lib/auth/auth"
import { getAllowedOriginsFromEnv, isLoopbackOrigin } from "./lib/env"
import { createRateLimiter } from "./lib/rate-limit"
import { ApiRoutes } from "./routes"

const isProduction = process.env.NODE_ENV === "production"
const allowedOrigins = getAllowedOriginsFromEnv(process.env.API_ALLOWED_ORIGINS)

function isOriginAllowed(origin: string) {
	if (!isProduction && isLoopbackOrigin(origin)) return true
	return allowedOrigins.includes(origin)
}

const generalLimiter = createRateLimiter({ windowSeconds: 60, max: 120 })

function resolveClientIp(request: Request) {
	const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
	if (forwarded) return forwarded
	return request.headers.get("x-real-ip") ?? "unknown"
}

export const app = new Elysia({ prefix: "/api" })
	.onError(({ error, set }) => {
		console.error(error)

		if (error instanceof AppError) {
			set.status = error.statusCode
			return {
				error: error.message,
				code: error.code,
				...(error.details ? { details: error.details } : {}),
			}
		}

		set.status = 500
		return {
			error: "Internal error",
			code: "INTERNAL_ERROR",
		}
	})
	.use(
		cors({
			origin: (request) => {
				const origin = request.headers.get("origin")
				return origin ? isOriginAllowed(origin) : false
			},
			allowedHeaders: ["Content-Type", "Authorization", "User-Agent"],
			methods: ["POST", "GET", "PUT", "PATCH", "DELETE", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	.onBeforeHandle(({ request, set }) => {
		const origin = request.headers.get("origin")

		if (origin && !isOriginAllowed(origin)) {
			set.status = 403
			return {
				error: "Origin not allowed",
				code: "CORS_ORIGIN_NOT_ALLOWED",
			}
		}

		if (!isProduction) return

		const { pathname } = new URL(request.url)
		if (request.method === "OPTIONS" || !pathname.startsWith("/api/v1/")) return

		const decision = generalLimiter.check(resolveClientIp(request))
		if (!decision.allowed) {
			set.status = 429
			set.headers["retry-after"] = String(decision.retryAfterSeconds)
			return {
				error: "Too many requests",
				code: "RATE_LIMITED",
			}
		}
	})
	.all("/auth/*", ({ request }) => auth.handler(request))
	.use(ApiRoutes)
	.get("/health", () => ({ ok: true }))

export default {
	port: Number(process.env.PORT ?? 3001),
	fetch: app.fetch,
}
