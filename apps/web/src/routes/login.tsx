import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { InkButton, InkCard, InkInput } from "@/components/ink"
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
			<h1 className="ink-title ink-title--1">{t("app.name")}</h1>
			<p className="ink-text">{t("app.tagline")}</p>
			<hr className="ink-divider" />
			<InkCard>
				<h2 className="ink-title ink-title--2">{t("login.title")}</h2>
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
						{error ? <div className="ink-alert">{error}</div> : null}
						<InkButton
							variant="primary"
							type="submit"
							label={pending ? t("library.uploading") : t("login.submit")}
							onClick={() => void handleSubmit()}
						/>
					</div>
				</form>
			</InkCard>
			<p className="ink-text">
				<a href="/register">{t("login.toRegister")}</a>
			</p>
		</div>
	)
}
