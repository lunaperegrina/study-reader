import { createAuthClient } from "better-auth/react"
import { resolveApiBaseUrl } from "@/lib/api/api-base-url"

export const authClient = createAuthClient({
	baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
})
