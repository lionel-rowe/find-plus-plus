import type { GET_MATCHES_REQUEST, GET_MATCHES_RESPONSE, WORKER_READY } from './config.ts'

export type GetMatchesRequestData = {
	kind: typeof GET_MATCHES_REQUEST
	source: string
	flags: string
	text: string
	start: number
	num: number
}

export type GetMatchesResponseData = {
	kind: typeof GET_MATCHES_RESPONSE
	results: {
		index: number
		arr: [string, ...string[]]
		groups: Record<string, string> | null | undefined
		indices: [number, number][] | null | undefined
	}[]
}
export type WorkerMessageIds = {
	WORKER_READY: typeof WORKER_READY
	GET_MATCHES_REQUEST: typeof GET_MATCHES_REQUEST
	GET_MATCHES_RESPONSE: typeof GET_MATCHES_RESPONSE
}

// invariant: no dependencies, nothing defined outside this function
export function workerFn(ids: WorkerMessageIds) {
	let regex = /^\b$/g // never matches
	const matches: RegExpExecArray[] = []
	let matchIter: Iterator<RegExpExecArray> = [][Symbol.iterator]()

	globalThis.postMessage({ kind: ids.WORKER_READY })

	globalThis.addEventListener('message', (e) => {
		switch (e.data.kind) {
			case ids.GET_MATCHES_REQUEST: {
				const { source, flags, text, start, num } = e.data as GetMatchesRequestData

				if (source !== regex.source || flags !== regex.flags) {
					regex = new RegExp(source, flags)
					matches.length = 0
					matchIter = String(text).matchAll(regex)[Symbol.iterator]()
				}

				const end = start + num
				while (matches.length < end) {
					const next = matchIter.next()
					if (next.done) break
					matches.push(next.value)
				}
				const response: GetMatchesResponseData = {
					kind: ids.GET_MATCHES_RESPONSE,
					results: matches.slice(start, end)
						.map((x) => ({
							index: x.index,
							arr: [...x] as [string, ...string[]],
							groups: x.groups,
							indices: x.indices,
						})),
				}

				globalThis.postMessage(response)
			}
		}
	})
}
