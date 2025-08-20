export type GetMatchesRequestData = {
	kind: string
	source: string
	flags: string
	text: string
	start: number
	num: number
}

export type GetMatchesResponseData = {
	kind: string
	results: {
		index: number
		arr: [string, ...string[]]
		groups: Record<string, string> | null
		indices: [number, number][] | null
	}[]
}

// invariant: no dependencies, nothing defined outside this function
export function workerFn(ids: { GET_MATCHES_REQUEST: string; GET_MATCHES_RESPONSE: string }) {
	let regex = /^\b$/g // never matches
	const matches: RegExpExecArray[] = []
	let matchIter: Iterator<RegExpExecArray> = [][Symbol.iterator]()

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
				globalThis.postMessage({
					kind: ids.GET_MATCHES_RESPONSE,
					results: matches.slice(start, end)
						.map((x) => ({
							index: x.index,
							arr: x,
							groups: x.groups,
							indices: x.indices,
						})),
				})
			}
		}
	})
}
