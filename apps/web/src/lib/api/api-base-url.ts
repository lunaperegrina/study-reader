export function resolveApiBaseUrl(baseUrl: string | undefined) {
	const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/, "")

	if (normalizedBaseUrl && normalizedBaseUrl.length > 0) {
		return normalizedBaseUrl
	}

	if (typeof window !== "undefined") {
		return "http://localhost:3001"
	}

	return "http://localhost:3001"
}
