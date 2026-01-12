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

export type Expand<T> = T extends object ? T extends infer O ? { [K in keyof O]: Expand<O[K]> } : never
	: T

type AwaitedProperties<T> = { [K in keyof T]: Awaited<T[K]> }
export async function promiseAllKeyed<T extends Record<string, unknown>>(obj: T): Promise<AwaitedProperties<T>> {
	const keys = Object.keys(obj)
	const values = await Promise.all(Object.values(obj))
	const resObj: Record<string, unknown> = Object.create(null)
	for (let i = 0; i < keys.length; ++i) {
		resObj[keys[i]] = values[i]
	}
	return resObj as AwaitedProperties<T>
}
