import { AppOptions } from './types.ts'

export const CUSTOM_ELEMENT_NAME = APP_ID
export const TEMPLATE_ID = namespaced('template')
export const HIGHLIGHT_ALL_ID = namespaced('all')
export const HIGHLIGHT_CURRENT_ID = namespaced('current')
export const HIGHLIGHT_TEXT_ID = namespaced('text')

export const defaultOptions: AppOptions = {
	maxMatches: 5000,

	'defaults.matchCase': false,
	'defaults.wholeWord': false,
	'defaults.useRegex': true,

	'colors.all': '#ffff00', // yellow
	'colors.current': '#ff8c00', // darkorange
	'colors.text': '#000000', // black
}

export function namespaced<T extends string>(str: T) {
	return `${APP_ID}_${str}` as const
}
