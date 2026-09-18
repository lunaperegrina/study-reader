import { Elysia } from "elysia"
import { CoursesController } from "./courses/controller"
import { DevicesController } from "./devices/controller"

export const ApiRoutes = new Elysia({ prefix: "/v1" })
	.use(CoursesController)
	.use(DevicesController)
