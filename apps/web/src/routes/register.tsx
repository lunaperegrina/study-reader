import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { InkInput } from "@/components/ink"
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
		navigate({ to: "/" })
	}

	return (
		<div className="ink-page" style={{ maxWidth: 420 }}>
			<e-title level="1">{t("app.name")}</e-title>
			<e-divider />
			<e-card>
				<e-title level="2">{t("register.title")}</e-title>
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
						{error ? <e-alert>{error}</e-alert> : null}
						<e-button
							variant="primary"
							type="submit"
							onClick={() => void handleSubmit()}
						>
							{pending ? t("library.uploading") : t("register.submit")}
						</e-button>
					</div>
				</form>
			</e-card>
			<e-link href="/login">{t("register.toLogin")}</e-link>
		</div>
	)
}
