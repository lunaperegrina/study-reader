import {
	type ButtonHTMLAttributes,
	type CSSProperties,
	type InputHTMLAttributes,
	type ReactNode,
} from "react"

type InkButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
	label: ReactNode
	variant?: "primary" | "default"
	style?: CSSProperties
}

export function InkButton({ label, variant, style, ...rest }: InkButtonProps) {
	return (
		<button
			className={
				variant === "primary" ? "sr-button sr-button--primary" : "sr-button"
			}
			style={style}
			{...rest}
		>
			{label}
		</button>
	)
}

type InkInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
	label?: string
	value: string
	onValueChange: (value: string) => void
}

export function InkInput({ label, onValueChange, ...rest }: InkInputProps) {
	return (
		<label style={{ display: "grid", gap: "var(--ink-space-2)" }}>
			{label ? <span className="ink-label">{label}</span> : null}
			<input
				className="ink-control"
				onChange={(event) => onValueChange(event.target.value)}
				{...rest}
			/>
		</label>
	)
}

type InkCardProps = {
	children: ReactNode
	style?: CSSProperties
}

export function InkCard({ children, style }: InkCardProps) {
	return (
		<section className="ink-card" style={style}>
			<div className="ink-card__body">{children}</div>
		</section>
	)
}
