import { assert } from '@std/assert/assert'
import type { AppOptions, ShortkeyConfig } from './types.ts'
import { comboToPretty } from './shortkeys.ts'

export type FlagName = 'useRegex' | 'matchCase' | 'wholeWord' | 'normalizeDiacritics'

export function setFlagDefaults(form: HTMLFormElement, options: AppOptions) {
	const defaults: Record<FlagName, boolean> = {
		'useRegex': options['defaults.useRegex'],
		'matchCase': options['defaults.matchCase'],
		'wholeWord': options['defaults.wholeWord'],
		'normalizeDiacritics': options['defaults.normalizeDiacritics'],
	}

	for (const [k, v] of Object.entries(defaults)) {
		const el = form.querySelector(`[name="${k}"]`)
		assert(el instanceof HTMLInputElement && el.type === 'checkbox')
		el.checked = v
	}
}

export function getFlags(form: HTMLFormElement) {
	const regexSyntax = isSet(form, 'useRegex')
	const matchCase = isSet(form, 'matchCase')
	const wholeWord = isSet(form, 'wholeWord')
	const normalizeDiacritics = isSet(form, 'normalizeDiacritics')
	return { regexSyntax, matchCase, wholeWord, normalizeDiacritics }
}

function isSet(form: HTMLFormElement, name: FlagName) {
	const el = form.querySelector(`[name="${name}"]`)
	assert(el instanceof HTMLInputElement && el.type === 'checkbox')
	return el.checked
}

export function updateShortkeyHints(form: HTMLFormElement, shortkeys: ShortkeyConfig, showHint: boolean) {
	const s: Record<FlagName, ShortkeyConfig[keyof ShortkeyConfig]> = {
		'useRegex': shortkeys.useRegex,
		'matchCase': shortkeys.matchCase,
		'wholeWord': shortkeys.wholeWord,
		'normalizeDiacritics': shortkeys.normalizeDiacritics,
	}

	for (const [k, v] of Object.entries(s)) {
		const el = form.querySelector(`[name="${k}"]`)
		assert(el instanceof HTMLInputElement && el.type === 'checkbox')
		const label = el.labels![0]!.closest('abbr')!
		label.title = [v.description, showHint && ` (${comboToPretty(v.combo)})`].filter(Boolean).join('')
	}
}
