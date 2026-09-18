import type { DetailedHTMLProps, HTMLAttributes } from "react"

type EpaperElement = DetailedHTMLProps<
	HTMLAttributes<HTMLElement>,
	HTMLElement
> & {
	variant?: string
	level?: number | string
	label?: string
	placeholder?: string
	value?: string
	href?: string
	open?: boolean
	max?: number | string
	[x: string]: unknown
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			"e-button": EpaperElement
			"e-card": EpaperElement
			"e-title": EpaperElement
			"e-text": EpaperElement
			"e-link": EpaperElement
			"e-badge": EpaperElement
			"e-tag": EpaperElement
			"e-input": EpaperElement
			"e-textarea": EpaperElement
			"e-alert": EpaperElement
			"e-progress": EpaperElement
			"e-empty": EpaperElement
			"e-dialog": EpaperElement
			"e-list": EpaperElement
			"e-divider": EpaperElement
			"e-steps": EpaperElement
			"e-pin-input": EpaperElement
			"e-segmented": EpaperElement
		}
	}
}
