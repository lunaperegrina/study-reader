import { anthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { AppError } from "@/error"

export function resolveCreatorModel() {
	if (process.env.ANTHROPIC_API_KEY) {
		return anthropic(process.env.CREATOR_MODEL ?? "claude-sonnet-4-5")
	}
	if (process.env.OPENAI_API_KEY) {
		const openai = createOpenAI({
			baseURL: process.env.OPENAI_BASE_URL,
		})
		return openai(process.env.CREATOR_MODEL ?? "gpt-4.1")
	}
	throw new AppError(
		"AI_NOT_CONFIGURED",
		503,
		"Nenhum provedor de IA configurado (defina ANTHROPIC_API_KEY ou OPENAI_API_KEY).",
	)
}

export function creatorMonthlyLimit() {
	const parsed = Number(process.env.CREATOR_MONTHLY_LIMIT ?? "3")
	return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 3
}
