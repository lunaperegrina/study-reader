import { createFileRoute } from "@tanstack/react-router"
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
			<e-title level="1">{t("settings.title")}</e-title>

			<e-card>
				<e-title level="3">{t("settings.devices")}</e-title>
				<e-text>{t("settings.devicesHint")}</e-text>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--ink-space-3)",
						margin: "var(--ink-space-3) 0",
					}}
				>
					<e-button
						variant="primary"
						onClick={() => pairingMutation.mutate()}
						disabled={pairingMutation.isPending}
					>
						{t("settings.generateCode")}
					</e-button>
					{code ? (
						<span>
							<e-title level="2" style={{ letterSpacing: "0.2em" }}>
								{code.code}
							</e-title>
							<e-text>
								{t("settings.codeExpires", {
									time: new Date(code.expiresAt).toLocaleTimeString("pt-BR"),
								})}
							</e-text>
						</span>
					) : null}
				</div>
				{devicesQuery.data && devicesQuery.data.length > 0 ? (
					<e-list>
						{devicesQuery.data.map((device) => (
							<e-text key={device.id}>
								{device.name} —{" "}
								{t("settings.deviceSince", {
									date: new Date(device.createdAt).toLocaleDateString("pt-BR"),
								})}
							</e-text>
						))}
					</e-list>
				) : (
					<e-text>{t("settings.noDevices")}</e-text>
				)}
			</e-card>
		</section>
	)
}
