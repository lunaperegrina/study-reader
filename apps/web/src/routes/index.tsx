import { createFileRoute, Link } from "@tanstack/react-router"
import { InkButton, InkCard } from "@/components/ink"
import { authClient } from "@/lib/auth/auth-client"
import { t } from "@/locales/pt-BR"

const GITHUB_URL = "https://github.com/lunaperegrina/study-reader"
const SPEC_URL = `${GITHUB_URL}/blob/main/packages/study-format/SPEC.md`

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const { data } = await authClient.getSession()
		return { hasSession: Boolean(data) }
	},
	component: LandingPage,
})

const STATS = [
	{ value: t("landing.stats.file.value"), label: t("landing.stats.file.label") },
	{ value: t("landing.stats.srs.value"), label: t("landing.stats.srs.label") },
	{ value: t("landing.stats.offline.value"), label: t("landing.stats.offline.label") },
	{ value: t("landing.stats.open.value"), label: t("landing.stats.open.label") },
]

const STEPS = [
	{ num: "01", title: t("landing.how.step1.title"), desc: t("landing.how.step1.desc") },
	{ num: "02", title: t("landing.how.step2.title"), desc: t("landing.how.step2.desc") },
	{ num: "03", title: t("landing.how.step3.title"), desc: t("landing.how.step3.desc") },
	{ num: "04", title: t("landing.how.step4.title"), desc: t("landing.how.step4.desc") },
]

const FEATURES = [
	{ title: t("landing.features.library.title"), desc: t("landing.features.library.desc") },
	{ title: t("landing.features.creator.title"), desc: t("landing.features.creator.desc") },
	{ title: t("landing.features.webreader.title"), desc: t("landing.features.webreader.desc") },
	{ title: t("landing.features.srs.title"), desc: t("landing.features.srs.desc") },
	{ title: t("landing.features.sync.title"), desc: t("landing.features.sync.desc") },
	{ title: t("landing.features.plugin.title"), desc: t("landing.features.plugin.desc") },
]

const FAQ = [
	{ q: t("landing.faq.q1"), a: t("landing.faq.a1") },
	{ q: t("landing.faq.q2"), a: t("landing.faq.a2") },
	{ q: t("landing.faq.q3"), a: t("landing.faq.a3") },
	{ q: t("landing.faq.q4"), a: t("landing.faq.a4") },
	{ q: t("landing.faq.q5"), a: t("landing.faq.a5") },
]

function LandingPage() {
	const { hasSession } = Route.useRouteContext()

	return (
		<div className="ink-page ink-page--landing">
			<main className="landing">
				<div className="landing__inner">
					<div className="landing__top">
						<span className="ink-text--label">{t("landing.hero.eyebrow")}</span>
						<div
							style={{
								display: "flex",
								gap: "var(--ink-space-2)",
								flexWrap: "wrap",
							}}
						>
							<span className="ink-badge ink-badge--inverted">
								{t("landing.badge.format")}
							</span>
							<span className="ink-badge">{t("landing.badge.licenses")}</span>
							<span className="ink-badge">{t("landing.badge.offline")}</span>
						</div>
					</div>

					<section className="landing__hero">
						<div>
							<h1 className="ink-title ink-title--1 landing__hero-title">
								{t("landing.hero.title")}
							</h1>
							<p className="landing__hero-sub">{t("landing.hero.sub")}</p>
							<div className="landing__hero-ctas">
								{hasSession ? (
									<Link to="/library" style={{ textDecoration: "none" }}>
										<InkButton variant="primary" label={t("landing.hero.ctaSession")} />
									</Link>
								) : (
									<>
										<Link to="/register" style={{ textDecoration: "none" }}>
											<InkButton variant="primary" label={t("landing.hero.ctaPrimary")} />
										</Link>
										<Link to="/login" style={{ textDecoration: "none" }}>
											<InkButton label={t("landing.hero.ctaSecondary")} />
										</Link>
									</>
								)}
								<a className="ink-link" data-external href={GITHUB_URL}>
									{t("landing.footer.github")}
								</a>
							</div>
						</div>
						<div className="landing__code">
							<div className="landing__code-title">{t("landing.hero.codeTitle")}</div>
							<pre>{t("landing.hero.code")}</pre>
						</div>
					</section>

					<div className="landing__stats">
						{STATS.map((stat) => (
							<div className="landing__stat" key={stat.label}>
								<div className="landing__stat-value">{stat.value}</div>
								<div className="landing__stat-label">{stat.label}</div>
							</div>
						))}
					</div>

					<section className="landing__section">
						<span className="ink-text--label">{t("landing.what.eyebrow")}</span>
						<h2 className="ink-title ink-title--2 landing__section-title">
							{t("landing.what.title")}
						</h2>
						<div className="landing__prose">
							<p>{t("landing.what.p1")}</p>
							<p>{t("landing.what.p2")}</p>
							<p>{t("landing.what.p3")}</p>
						</div>
					</section>

					<section className="landing__section">
						<span className="ink-text--label">{t("landing.how.eyebrow")}</span>
						<h2 className="ink-title ink-title--2 landing__section-title">
							{t("landing.how.title")}
						</h2>
						<div className="landing__defrows">
							{STEPS.map((step) => (
								<div className="landing__defrow" key={step.num}>
									<span className="landing__defrow-num">{step.num}</span>
									<h3 className="landing__defrow-title">{step.title}</h3>
									<p className="landing__defrow-desc">{step.desc}</p>
								</div>
							))}
						</div>
					</section>

					<section className="landing__section">
						<span className="ink-text--label">{t("landing.format.eyebrow")}</span>
						<h2 className="ink-title ink-title--2 landing__section-title">
							{t("landing.format.title")}
						</h2>
						<div className="landing__format">
							<p className="landing__prose">{t("landing.format.p1")}</p>
							<div className="landing__code">
								<div className="landing__code-title">manifest.json</div>
								<pre>{t("landing.format.code")}</pre>
							</div>
						</div>
					</section>

					<section className="landing__section">
						<span className="ink-text--label">{t("landing.features.eyebrow")}</span>
						<h2 className="ink-title ink-title--2 landing__section-title">
							{t("landing.features.title")}
						</h2>
						<div className="landing__features">
							{FEATURES.map((feature) => (
								<InkCard key={feature.title}>
									<h3
										className="ink-title ink-title--4"
										style={{ marginBottom: "var(--ink-space-2)" }}
									>
										{feature.title}
									</h3>
									<p className="ink-text ink-text--small">{feature.desc}</p>
								</InkCard>
							))}
						</div>
					</section>

					<section className="landing__section">
						<span className="ink-text--label">{t("landing.faq.eyebrow")}</span>
						<h2 className="ink-title ink-title--2 landing__section-title">
							{t("landing.faq.title")}
						</h2>
						<div className="landing__faq">
							{FAQ.map((item) => (
								<details key={item.q}>
									<summary>{item.q}</summary>
									<p className="landing__faq-answer">{item.a}</p>
								</details>
							))}
						</div>
					</section>

					<footer className="landing__footer">
						<span>{t("landing.footer.tagline")}</span>
						<div className="landing__footer-links">
							<a className="ink-link" data-external href={GITHUB_URL}>
								{t("landing.footer.github")}
							</a>
							<a className="ink-link" data-external href={SPEC_URL}>
								{t("landing.footer.spec")}
							</a>
							<span>{t("landing.footer.licenses")}</span>
						</div>
					</footer>
				</div>
			</main>
		</div>
	)
}
