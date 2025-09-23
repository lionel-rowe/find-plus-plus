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
		flagValues: { regexSyntax: false, matchCase: false, wholeWord: false },
		result: { kind: 'sourceOnly', regex: /\x61bc/gimv, usesRegexSyntax: false, empty: false },
		match: ['abc', 'ABC', 'abcd'],
		noMatch: ['ab', 'ab c', 'a bc'],
	},
	{
		searchTerm: '/abc/ui',
		flagValues: { regexSyntax: false, matchCase: true, wholeWord: true },
		result: { kind: 'full', regex: /abc/giu, empty: false },
		match: ['abc', 'ABC', 'abcd'],
		noMatch: ['ab', 'ab c', 'a bc'],
	},
	{
		searchTerm: '',
		flagValues: { regexSyntax: false, matchCase: false, wholeWord: false },
		result: { kind: 'sourceOnly', regex: /(?:)/gimv, usesRegexSyntax: false, empty: true },
	},
	{
		searchTerm: '\\',
		flagValues: { regexSyntax: true, matchCase: false, wholeWord: false },
		result: { kind: 'error', error: new SyntaxError('Invalid regular expression: /\\/v: \\ at end of pattern') },
	},
	{
		searchTerm: '\\',
		flagValues: { regexSyntax: false, matchCase: false, wholeWord: false },
		result: { kind: 'sourceOnly', regex: /\\/gimv, usesRegexSyntax: false, empty: false },
	},
]

Deno.test(searchTermToRegexResult.name, async (t) => {
	for (const { searchTerm, flagValues, result, match, noMatch } of cases) {
		const _desc = Deno.inspect([searchTerm, flagValues], { colors: true })
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
