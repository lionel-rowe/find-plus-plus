import './types.d.ts'
import { assert, assertEquals, assertMatch, assertNotMatch } from '@std/assert'
import { searchTermToRegexResult } from './regex.ts'
import type { Flags, RegexConfig } from './regex.ts'

const cases: {
	searchTerm: string
	flagValues: Flags
	result: RegexConfig
	match?: string[]
	noMatch?: string[]
}[] = [
	{
		searchTerm: 'abc',
		flagValues: { useRegex: false, matchCase: false, wholeWord: false, normalizeDiacritics: false },
		result: { kind: 'sourceOnly', regex: /\x61bc/gimv, useRegex: false, empty: false, normalizations: [] },
		match: ['abc', 'ABC', 'abcd'],
		noMatch: ['ab', 'ab c', 'a bc'],
	},
	{
		searchTerm: '/abc/ui',
		flagValues: { useRegex: false, matchCase: true, wholeWord: true, normalizeDiacritics: false },
		result: { kind: 'full', regex: /abc/giu, empty: false, normalizations: [] },
		match: ['abc', 'ABC', 'abcd'],
		noMatch: ['ab', 'ab c', 'a bc'],
	},
	{
		searchTerm: '',
		flagValues: { useRegex: false, matchCase: false, wholeWord: false, normalizeDiacritics: false },
		result: { kind: 'sourceOnly', regex: /(?:)/gimv, useRegex: false, empty: true, normalizations: [] },
	},
	{
		searchTerm: '\\',
		flagValues: { useRegex: true, matchCase: false, wholeWord: false, normalizeDiacritics: false },
		result: {
			kind: 'error',
			error: new SyntaxError('Invalid regular expression: /\\/v: \\ at end of pattern'),
			normalizations: [],
		},
	},
	{
		searchTerm: '\\',
		flagValues: { useRegex: false, matchCase: false, wholeWord: false, normalizeDiacritics: false },
		result: { kind: 'sourceOnly', regex: /\\/gimv, useRegex: false, empty: false, normalizations: [] },
	},
	{
		searchTerm: '_',
		flagValues: { useRegex: false, matchCase: false, wholeWord: false, normalizeDiacritics: true },
		result: {
			kind: 'sourceOnly',
			regex: /_/gimv,
			useRegex: false,
			empty: false,
			normalizations: ['diacritics'],
		},
	},
]

Deno.test(searchTermToRegexResult.name, async (t) => {
	for (const { searchTerm, flagValues, result, match, noMatch } of cases) {
		const _desc = Deno.inspect([searchTerm, flagValues], { colors: true, breakLength: Infinity })
		const description = _desc.slice(_desc.indexOf('[') + 1, _desc.lastIndexOf(']')).trim()

		await t.step(description, () => {
			const actual = searchTermToRegexResult(searchTerm, flagValues)
			if (result.kind === 'error') {
				assert(actual.kind === 'error')
				const { error: rError, ...r } = result
				const { error: aError, ...a } = actual
				assertEquals(a, r)
				assert(aError instanceof rError.constructor)
				assertEquals(aError.message, rError.message)
			} else {
				assertEquals(actual, result)
			}

			if (match?.length) {
				assert(actual.kind !== 'error')
				for (const m of match) assertMatch(m, new RegExp(actual.regex))
			}
			if (noMatch?.length) {
				assert(actual.kind !== 'error')
				for (const m of noMatch) assertNotMatch(m, new RegExp(actual.regex))
			}
		})
	}
})
