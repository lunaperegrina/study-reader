import { type ReactNode, useEffect, useRef } from "react"

type InkInputProps = {
	label?: string
	placeholder?: string
	type?: string
	value: string
	onValueChange: (value: string) => void
	autoComplete?: string
}

export function InkInput({
	label,
	placeholder,
	type,
	value,
	onValueChange,
	autoComplete,
}: InkInputProps) {
	const ref = useRef<HTMLElement>(null)

	useEffect(() => {
		const element = ref.current
		if (!element) return

		function readEvent(event: Event) {
			const detail = (event as CustomEvent<{ value?: string }>).detail
			const host = event.target as { value?: string } | null
			onValueChange(
				detail?.value ?? host?.value ?? (element as { value?: string }).value ?? "",
			)
		}

		function readNative(event: Event) {
			onValueChange((event.target as HTMLInputElement).value)
		}

		element.addEventListener("e-change", readEvent)
		const native = element.querySelector("input, textarea")
		native?.addEventListener("input", readNative)
		return () => {
			element.removeEventListener("e-change", readEvent)
			native?.removeEventListener("input", readNative)
		}
	}, [onValueChange])

	return (
		<e-input
			ref={ref}
			label={label}
			placeholder={placeholder}
			type={type}
			value={value}
			autocomplete={autoComplete}
		/>
	)
}

type InkDialogProps = {
	open: boolean
	title: string
	children: ReactNode
}

export function InkDialog({ open, title, children }: InkDialogProps) {
	return (
		<e-dialog open={open ? true : undefined} label={title} heading={title}>
			{children}
		</e-dialog>
	)
}
