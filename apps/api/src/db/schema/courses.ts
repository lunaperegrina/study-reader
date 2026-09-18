import {
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"
import type { StudyManifest } from "@study-reader/study-format"
import type {
	AnswersState,
	ProgressState,
	ReviewsState,
} from "@study-reader/contracts"
import { user } from "./auth"

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return "bytea"
	},
})

export const courses = pgTable(
	"courses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		courseId: text("course_id").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		language: text("language"),
		author: text("author"),
		version: integer("version").notNull().default(1),
		source: text("source").notNull(),
		manifest: jsonb("manifest").$type<StudyManifest>().notNull(),
		moduleCount: integer("module_count").notNull(),
		lessonCount: integer("lesson_count").notNull(),
		data: bytea("data").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("courses_owner_idx").on(table.ownerId),
		uniqueIndex("courses_owner_course_idx").on(table.ownerId, table.courseId),
	],
)

export const courseState = pgTable(
	"course_state",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		courseId: text("course_id").notNull(),
		progress: jsonb("progress")
			.$type<ProgressState>()
			.notNull()
			.default({ currentLesson: null, completedLessons: {} }),
		answers: jsonb("answers").$type<AnswersState>().notNull().default({}),
		reviews: jsonb("reviews").$type<ReviewsState>().notNull().default({}),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.courseId] })],
)
