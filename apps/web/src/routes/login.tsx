import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { InkInput } from "@/components/ink"
import { authClient } from "@/lib/auth/auth-client"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/login")({
	component: LoginPage,
})

export function LoginPage() {
	const navigate = useNavigate()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	async function handleSubmit(event?: FormEvent) {
		event?.preventDefault()
		if (pending) return
		setPending(true)
		setError(null)

		const result = await authClient.signIn.email({ email, password })
		setPending(false)

		if (result.error) {
			setError(t("login.failed"))
			return
		}
		navigate({ to: "/" })
	}

	return (
		<div className="ink-page" style={{ maxWidth: 420 }}>
			<e-title level="1">{t("app.name")}</e-title>
			<e-text>{t("app.tagline")}</e-text>
			<e-divider />
			<e-card>
				<e-title level="2">{t("login.title")}</e-title>
				<form onSubmit={handleSubmit}>
					<div style={{ display: "grid", gap: "var(--ink-space-3)" }}>
						<InkInput
							label={t("login.email")}
							type="email"
							value={email}
							onValueChange={setEmail}
							autoComplete="email"
						/>
						<InkInput
							label={t("login.password")}
							type="password"
							value={password}
							onValueChange={setPassword}
							autoComplete="current-password"
						/>
						{error ? <e-alert>{error}</e-alert> : null}
						<e-button
							variant="primary"
							type="submit"
							onClick={() => void handleSubmit()}
						>
							{pending ? t("library.uploading") : t("login.submit")}
						</e-button>
					</div>
				</form>
			</e-card>
			<e-link href="/register">{t("login.toRegister")}</e-link>
		</div>
	)
}
