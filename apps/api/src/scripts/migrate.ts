import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"

const MIGRATION_LOCK_KEY = 9_002_318n

export async function runMigrations() {
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations.")

	const lockTimeoutMs = Number(process.env.MIGRATION_LOCK_TIMEOUT_MS) || 60_000

	const client = new Client({ connectionString: databaseUrl })

	try {
		await client.connect()
		await client.query(`set lock_timeout = ${lockTimeoutMs}`)
		await client.query(`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`)

		try {
			await migrate(drizzle(client), {
				migrationsFolder:
					process.env.MIGRATIONS_FOLDER ??
					fileURLToPath(new URL("../../drizzle", import.meta.url)),
			})
		} finally {
			await client.query(`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`)
		}

		console.log("[migrate] migrations applied")
	} finally {
		await client.end()
	}
}

if (import.meta.main) await runMigrations()
