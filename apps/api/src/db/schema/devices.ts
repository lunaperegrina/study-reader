import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const pairingCodes = pgTable(
	"pairing_codes",
	{
		code: text("code").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("pairing_codes_user_idx").on(table.userId)],
)

export const deviceTokens = pgTable(
	"device_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		lastSeenAt: timestamp("last_seen_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("device_tokens_user_idx").on(table.userId)],
)
