import type { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export type RouterContext = {
	queryClient: QueryClient
}

export const router = createRouter({
	routeTree,
	context: {
		queryClient: undefined as unknown as QueryClient,
	},
	scrollRestoration: true,
	defaultPreloadStaleTime: 0,
	defaultViewTransition: true,
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}
