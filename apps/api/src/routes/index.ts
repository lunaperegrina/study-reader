import { Elysia } from "elysia"
import { CoursesController } from "./courses/controller"
import { CreatorController } from "./creator/controller"
import { DevicesController } from "./devices/controller"
import { SyncController } from "./sync/controller"

export const ApiRoutes = new Elysia({ prefix: "/v1" })
	.use(CoursesController)
	.use(DevicesController)
	.use(SyncController)
	.use(CreatorController)
