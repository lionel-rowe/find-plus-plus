import { AppOptions } from './types.ts'

export const CUSTOM_ELEMENT_NAME = APP_ID
export const TEMPLATE_ID = namespaced('template')
export const HIGHLIGHT_ALL_ID = namespaced('all')
export const HIGHLIGHT_ONE_ID = namespaced('one')

export const defaultOptions: AppOptions = {
	'defaults.matchCase': false,
	'defaults.wholeWord': false,
	'defaults.useRegex': true,
}

export function namespaced<T extends string>(str: T) {
	return `${APP_ID}_${str}` as const
}
