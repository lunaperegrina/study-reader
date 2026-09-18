/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		viteReact(),
	],
	test: {
		environment: "jsdom",
		globals: true,
		exclude: ["**/node_modules/**", "**/dist/**"],
		setupFiles: ["./src/test-setup.ts"],
		testTimeout: 15000,
	},
})
