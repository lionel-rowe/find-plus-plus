import { assert } from '@std/assert/assert'
import { AppOptions } from './types.ts'

class NamespacedIdsMap extends Map<string, `${typeof APP_NS}_${string}`> {
	override get<K extends string>(key: K) {
		assert(this.has(key), `Key "${key}" not found in map.`)
		return super.get(key) as `${typeof APP_NS}_${K}`
	}
}

export const namespacedIds = new NamespacedIdsMap()
export function namespaced<T extends string>(str: T) {
	assert(!namespacedIds.has(str), `ID "${str}" is already namespaced.`)
	const ns = `${APP_NS}_${str}` as const
	namespacedIds.set(str, ns)
	return ns
}

export const CUSTOM_ELEMENT_NAME = APP_NS
export const TEMPLATE_ID = namespaced('template')
export const HIGHLIGHT_ALL_ID = namespaced('all')
export const HIGHLIGHT_CURRENT_ID = namespaced('current')
export const HIGHLIGHT_TEXT_ID = namespaced('text')
export const WORKER_RUNNER_ID = namespaced('worker-runner')

export const WORKER_READY = namespaced('worker-ready')
export const GET_MATCHES_REQUEST = namespaced('get-matches-request')
export const GET_MATCHES_RESPONSE = namespaced('get-matches-response')

export const defaultOptions: AppOptions = {
	maxTimeout: 5000, // 5 seconds
	maxMatches: 500,

	'defaults.matchCase': false,
	'defaults.wholeWord': false,
	'defaults.useRegex': true,

	'colors.all': '#ffff00', // yellow
	'colors.current': '#ff8c00', // darkorange
	'colors.text': '#000000', // black
}
