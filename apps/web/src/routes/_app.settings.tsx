import { createFileRoute } from "@tanstack/react-router"
import { InkButton, InkCard } from "@/components/ink"
import { useDevicesQuery, usePairingCodeMutation } from "@/queries/courses"
import { t } from "@/locales/pt-BR"

export const Route = createFileRoute("/_app/settings")({
	component: SettingsPage,
})

function SettingsPage() {
	const devicesQuery = useDevicesQuery()
	const pairingMutation = usePairingCodeMutation()
	const code = pairingMutation.data

	return (
		<section style={{ display: "grid", gap: "var(--ink-space-4)" }}>
			<h1 className="ink-title ink-title--1">{t("settings.title")}</h1>

			<InkCard>
				<h3 className="ink-title ink-title--3">{t("settings.devices")}</h3>
				<p className="ink-text">{t("settings.devicesHint")}</p>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--ink-space-3)",
						margin: "var(--ink-space-3) 0",
						flexWrap: "wrap",
					}}
				>
					<InkButton
						variant="primary"
						label={t("settings.generateCode")}
						disabled={pairingMutation.isPending}
						onClick={() => pairingMutation.mutate()}
					/>
					{code ? (
						<span>
							<strong
								className="ink-title ink-title--2"
								style={{ letterSpacing: "0.2em", fontVariantNumeric: "tabular-nums" }}
							>
								{code.code}
							</strong>
							<span className="ink-text ink-text--caption" style={{ display: "block" }}>
								{t("settings.codeExpires", {
									time: new Date(code.expiresAt).toLocaleTimeString("pt-BR"),
								})}
							</span>
						</span>
					) : null}
				</div>
				{devicesQuery.data && devicesQuery.data.length > 0 ? (
					<ul style={{ margin: 0, paddingLeft: "var(--ink-space-5)" }}>
						{devicesQuery.data.map((device) => (
							<li key={device.id} className="ink-text">
								{device.name} —{" "}
								{t("settings.deviceSince", {
									date: new Date(device.createdAt).toLocaleDateString("pt-BR"),
								})}
							</li>
						))}
					</ul>
				) : (
					<p className="ink-text">{t("settings.noDevices")}</p>
				)}
			</InkCard>
		</section>
	)
}
