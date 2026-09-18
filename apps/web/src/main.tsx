import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { router } from "./router"
import "./styles.css"

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60,
		},
	},
})

const rootElement = document.getElementById("root")

if (!rootElement) {
	throw new Error("Root element not found")
}

ReactDOM.createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} context={{ queryClient }} />
		</QueryClientProvider>
	</StrictMode>,
)
