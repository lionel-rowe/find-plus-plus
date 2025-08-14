// modified from @std/async/unstable-throttle (MIT license)
// https://github.com/denoland/std/issues/6796
// https://github.com/denoland/std/issues/6797

export type TimeFrame = number | ((previousExecution: number) => number)

export type ThrottleOptions = {
	ensureLast?: boolean
}

export interface ThrottledFunction<T extends Array<unknown>> {
	(...args: T): void
	clear(): void
	flush(): void
	readonly throttling: boolean
	readonly lastExecution: number
}

// deno-lint-ignore no-explicit-any
export function throttle<T extends Array<any>>(
	fn: (this: ThrottledFunction<T>, ...args: T) => void,
	timeframe: TimeFrame,
	options?: ThrottleOptions,
): ThrottledFunction<T> {
	const ensureLast = Boolean(options?.ensureLast)

	let lastExecution = NaN
	let flush: (() => void) | null = null

	let tf = typeof timeframe === 'function' ? 0 : timeframe

	let timeout = -1

	const throttled = ((...args: T) => {
		flush = () => {
			const start = Date.now()
			try {
				clearTimeout(timeout)
				fn.call(throttled, ...args)
			} finally {
				lastExecution = Date.now()
				if (typeof timeframe === 'function') tf = timeframe(lastExecution - start)
				flush = null
			}
		}
		if (throttled.throttling) {
			if (ensureLast) {
				timeout = setTimeout(() => flush?.(), tf)
			}
		} else {
			flush?.()
		}
	}) as ThrottledFunction<T>

	throttled.clear = () => {
		lastExecution = NaN
	}

	throttled.flush = () => {
		lastExecution = NaN
		flush?.()
		throttled.clear()
	}

	Object.defineProperties(throttled, {
		throttling: { get: () => Date.now() - lastExecution <= tf },
		lastExecution: { get: () => lastExecution },
	})

	return throttled
}
