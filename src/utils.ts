export function modulo(n: number, m: number) {
	return ((n % m) + m) % m
}

export function escapeHtml(text: string) {
	return Object.assign(document.createElement('span'), { textContent: text }).innerHTML
}
