import { assert } from '@std/assert/assert'
import type { AppOptions, ShortkeyConfigMapping } from './types.ts'
import { comboToPretty } from './shortkeys.ts'

export type FlagName = 'useRegex' | 'matchCase' | 'wholeWord' | 'normalizeDiacritics'

export function setFlagDefaults(form: HTMLFormElement, options: AppOptions) {
	const defaults: Record<FlagName, boolean> = {
		useRegex: options.flags.useRegex.default,
		matchCase: options.flags.matchCase.default,
		wholeWord: options.flags.wholeWord.default,
		normalizeDiacritics: options.flags.normalizeDiacritics.default,
	}

	for (const [k, v] of Object.entries(defaults)) {
		const el = form.querySelector(`[name="${k}"]`)
		assert(el instanceof HTMLInputElement && el.type === 'checkbox')
		el.checked = v
	}
}

export function getFlags(form: HTMLFormElement) {
	const useRegex = isSet(form, 'useRegex')
	const matchCase = isSet(form, 'matchCase')
	const wholeWord = isSet(form, 'wholeWord')
	const normalizeDiacritics = isSet(form, 'normalizeDiacritics')
	return { useRegex, matchCase, wholeWord, normalizeDiacritics }
}

function isSet(form: HTMLFormElement, name: FlagName) {
	const el = form.querySelector(`[name="${name}"]`)
	assert(el instanceof HTMLInputElement && el.type === 'checkbox')
	return el.checked
}

export function updateShortkeyHints(form: HTMLFormElement, shortkeys: ShortkeyConfigMapping, showHint: boolean) {
	for (const [k, v] of Object.entries(shortkeys)) {
		const el = form.querySelector(`[name="${k}"]`)
		assert(el instanceof HTMLInputElement && el.type === 'checkbox')
		const label = el.labels![0]!.closest('abbr')!
		label.title = [v.description, showHint && ` (${comboToPretty(v.shortkey)})`].filter(Boolean).join('')
	}
}
