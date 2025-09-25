export function modulo(n: number, m: number) {
	return ((n % m) + m) % m
}

export function escapeHtml(text: string) {
	return Object.assign(document.createElement('span'), { textContent: text }).innerHTML
}

type Strategy = 'round' | 'floor' | 'ceil' | 'trunc'
export function roundTo(n: number, digits: number, strategy: Strategy = 'round') {
	const factor = 10 ** digits
	return Math[strategy](n * factor) / factor
}

export type ExpandRecursively<T> = T extends object
	? T extends infer O ? { [K in keyof O]: ExpandRecursively<O[K]> } : never
	: T
