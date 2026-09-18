import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema-exported"

const db = drizzle(process.env.DATABASE_URL ?? "", { schema })

export type DbExecutor =
	| typeof db
	| Parameters<Parameters<typeof db.transaction>[0]>[0]

export default db
