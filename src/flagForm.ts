import { assert } from '@std/assert/assert'
import type { AppOptions } from './types.ts'

export type FlagName = 'use-regex' | 'match-case' | 'whole-word'

export function setFlagDefaults(form: HTMLFormElement, options: AppOptions) {
	const defaults: Record<FlagName, boolean> = {
		'use-regex': options['defaults.useRegex'],
		'match-case': options['defaults.matchCase'],
		'whole-word': options['defaults.wholeWord'],
	}

	for (const [k, v] of Object.entries(defaults)) {
		const el = form.querySelector(`[name="${k}"]`)
		assert(el instanceof HTMLInputElement && el.type === 'checkbox')
		el.checked = v
	}
}

export function getFlags(form: HTMLFormElement) {
	const regexSyntax = isSet(form, 'use-regex')
	const matchCase = isSet(form, 'match-case')
	const wholeWord = isSet(form, 'whole-word')
	return { regexSyntax, matchCase, wholeWord }
}

function isSet(form: HTMLFormElement, name: FlagName) {
	const el = form.querySelector(`[name="${name}"]`)
	assert(el instanceof HTMLInputElement && el.type === 'checkbox')
	return el.checked
}
