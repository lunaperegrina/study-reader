import { describe, expect, it } from "vitest"
import { t } from "@/locales/pt-BR"

describe("i18n", () => {
	it("returns the pt-BR string", () => {
		expect(t("library.title")).toBe("Meus cursos")
	})

	it("interpolates params", () => {
		expect(t("library.lessons", { count: 3 })).toBe("3 lições")
	})
})
