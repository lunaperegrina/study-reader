export function downloadBytes(bytes: Uint8Array<ArrayBuffer>, filename: string) {
	const blob = new Blob([bytes], { type: "application/octet-stream" })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = filename
	anchor.click()
	URL.revokeObjectURL(url)
}
