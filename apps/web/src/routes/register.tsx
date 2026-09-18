import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { InkButton, InkCard, InkInput } from "@/components/ink"
import { authClient } from "@/lib/auth/auth-client"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/register")({
	component: RegisterPage,
})

function RegisterPage() {
	const navigate = useNavigate()
	const [name, setName] = useState("")
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	async function handleSubmit(event?: FormEvent) {
		event?.preventDefault()
		if (pending) return
		setPending(true)
		setError(null)

		const result = await authClient.signUp.email({ name, email, password })
		setPending(false)

		if (result.error) {
			setError(t("register.failed"))
			return
		}
		navigate({ to: "/library" })
	}

	return (
		<div className="ink-page" style={{ maxWidth: 420 }}>
			<h1 className="ink-title ink-title--1">{t("app.name")}</h1>
			<hr className="ink-divider" />
			<InkCard>
				<h2 className="ink-title ink-title--2">{t("register.title")}</h2>
				<form onSubmit={handleSubmit}>
					<div style={{ display: "grid", gap: "var(--ink-space-3)" }}>
						<InkInput
							label={t("register.name")}
							value={name}
							onValueChange={setName}
							autoComplete="name"
						/>
						<InkInput
							label={t("register.email")}
							type="email"
							value={email}
							onValueChange={setEmail}
							autoComplete="email"
						/>
						<InkInput
							label={t("register.password")}
							type="password"
							value={password}
							onValueChange={setPassword}
							autoComplete="new-password"
						/>
						{error ? <div className="ink-alert">{error}</div> : null}
						<InkButton
							variant="primary"
							type="submit"
							label={pending ? t("library.uploading") : t("register.submit")}
							onClick={() => void handleSubmit()}
						/>
					</div>
				</form>
			</InkCard>
			<p className="ink-text">
				<a href="/login">{t("register.toLogin")}</a>
			</p>
		</div>
	)
}
