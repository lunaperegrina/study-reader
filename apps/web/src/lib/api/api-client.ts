import { resolveApiBaseUrl } from "./api-base-url"

export class ApiError extends Error {
	code: string
	status: number

	constructor(message: string, code: string, status: number) {
		super(message)
		this.code = code
		this.status = status
	}
}

async function parseErrorBody(response: Response) {
	let message = `Erro ${response.status}`
	let code = "REQUEST_FAILED"
	try {
		const body = (await response.json()) as {
			error?: string
			code?: string
		}
		message = body.error ?? message
		code = body.code ?? code
	} catch {}
	return new ApiError(message, code, response.status)
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(
		`${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)}${path}`,
		{
			credentials: "include",
			...init,
			headers: {
				...(init?.body ? { "Content-Type": "application/json" } : {}),
				...init?.headers,
			},
		},
	)

	if (!response.ok) {
		throw await parseErrorBody(response)
	}

	return (await response.json()) as T
}

export async function apiUpload<T>(
	path: string,
	bytes: Uint8Array<ArrayBuffer>,
): Promise<T> {
	const response = await fetch(
		`${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)}${path}`,
		{
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/octet-stream" },
			body: bytes,
		},
	)

	if (!response.ok) {
		throw await parseErrorBody(response)
	}

	return (await response.json()) as T
}

export async function apiFetchBytes(
	path: string,
	init?: RequestInit,
): Promise<Uint8Array<ArrayBuffer>> {
	const response = await fetch(
		`${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)}${path}`,
		{
			credentials: "include",
			...init,
		},
	)

	if (!response.ok) {
		throw await parseErrorBody(response)
	}

	return new Uint8Array((await response.arrayBuffer()) as ArrayBuffer)
}
