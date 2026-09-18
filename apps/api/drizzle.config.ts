import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "drizzle",
	schema: "./src/db/schema-exported.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	migrations: {
		table: "__drizzle_migrations__",
		schema: "public",
	},
	verbose: true,
})
