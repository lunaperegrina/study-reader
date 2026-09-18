import { describe, expect, it } from "vitest"
import { isLoopbackOrigin } from "../src/lib/env"

describe("isLoopbackOrigin", () => {
	it.each([
		"http://localhost:5173",
		"http://localhost:5174",
		"http://localhost",
		"http://127.0.0.1:5173",
		"https://localhost:8443",
	])("allows dev origin %s", (origin) => {
		expect(isLoopbackOrigin(origin)).toBe(true)
	})

	it.each([
		"http://example.com",
		"http://localhost.evil.com",
		"http://192.168.15.4:3001",
		"http://sub.localhost:5173",
	])("rejects non-loopback origin %s", (origin) => {
		expect(isLoopbackOrigin(origin)).toBe(false)
	})
})
