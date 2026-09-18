import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { InkButton } from "@/components/ink"
import { authClient } from "@/lib/auth/auth-client"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app")({
	beforeLoad: async () => {
		const { data } = await authClient.getSession()
		if (!data) {
			throw redirect({ to: "/login" })
		}
	},
	component: AppLayout,
})

function AppLayout() {
	async function handleLogout() {
		await authClient.signOut()
		window.location.href = "/login"
	}

	return (
		<div className="ink-page">
			<header
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "var(--ink-space-3)",
					marginBottom: "var(--ink-space-5)",
				}}
			>
				<h3 className="ink-title ink-title--3">{t("app.name")}</h3>
				<nav
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--ink-space-3)",
					}}
				>
					<Link to="/">{t("nav.library")}</Link>
					<Link to="/settings">{t("nav.settings")}</Link>
					<InkButton label={t("nav.logout")} onClick={handleLogout} />
				</nav>
			</header>
			<Outlet />
		</div>
	)
}
