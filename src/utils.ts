export function modulo(n: number, m: number) {
	return ((n % m) + m) % m
}

export function clamp(n: number, minimum: number, maximum: number) {
	return Math.min(Math.max(n, minimum), maximum)
}

export function escapeHtml(text: string) {
	return Object.assign(document.createElement('span'), { textContent: text }).innerHTML
}
