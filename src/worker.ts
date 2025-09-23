import { NormalizedMatcher } from '@li/irregex/matchers/normalized'
import { GET_MATCHES_REQUEST, GET_MATCHES_RESPONSE, WORKER_READY } from './config.ts'
import { normalizersFor } from './normalizers.ts'

// TODO: maybe others? (e.g. whitespace)
export type Normalization = 'diacritics'
export type GetMatchesRequestData = {
	kind: typeof GET_MATCHES_REQUEST
	source: string
	flags: string
	text: string
	start: number
	num: number
	reqNo: number
	normalizations: Normalization[]
}

export type GetMatchesResponseData = {
	kind: typeof GET_MATCHES_RESPONSE
	results: {
		index: number
		arr: [string, ...string[]]
		groups: Record<string, string> | null | undefined
		indices: [number, number][] | null | undefined
	}[]
	reqNo: number
}

let regex = /^\b$/g // never matches
const matches: RegExpExecArray[] = []
let matchIter: Iterator<RegExpExecArray> = [][Symbol.iterator]()

globalThis.postMessage({ kind: WORKER_READY })

globalThis.addEventListener('message', (e) => {
	switch (e.data.kind) {
		case GET_MATCHES_REQUEST: {
			const { source, flags, text, start, num, reqNo, normalizations } = e.data as GetMatchesRequestData

			if (source !== regex.source || flags !== regex.flags) {
				regex = new RegExp(source, flags)
				if (normalizations.includes('diacritics')) {
					regex = new NormalizedMatcher({
						matcher: regex,
						normalizers: normalizersFor(normalizations),
					}).asRegExp()
				}
				matches.length = 0
				matchIter = text.matchAll(regex)[Symbol.iterator]()
			}

			const end = start + num
			while (matches.length < end) {
				const next = matchIter.next()
				if (next.done) break

				// // for debugging
				// const start = Date.now()
				// while (Date.now() - start < 100) {/* simulate lag */}

				matches.push(next.value)
			}
			const response: GetMatchesResponseData = {
				kind: GET_MATCHES_RESPONSE,
				reqNo,
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
