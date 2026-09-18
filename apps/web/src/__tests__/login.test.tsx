import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/auth-client", () => ({
	authClient: {
		signIn: {
			email: vi.fn().mockResolvedValue({ data: {}, error: null }),
		},
	},
}))

const { LoginPage } = await import("@/routes/login")

describe("LoginPage", () => {
	it("renders the app name, form and register link", () => {
		render(<LoginPage />)
		expect(screen.getByText("study-reader")).toBeDefined()
		expect(screen.getAllByText("Entrar").length).toBeGreaterThanOrEqual(2)
		expect(screen.getByText("Não tem conta? Criar conta")).toBeDefined()
	})
})
