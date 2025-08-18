import { assert } from '@std/assert/assert'

export type Flags = {
	regexSyntax: boolean
	matchCase: boolean
	wholeWord: boolean
}

const REGEX_REGEX = /^\s*\/(?<source>.+)\/(?<flags>[dgimsuvy]*)\s*$/su
const EMPTY_REGEX_SOURCE = new RegExp('').source

const wordChar = String.raw`[\p{L}\p{M}\p{N}]`
// TODO: better regex for these? e.g. should "{" surrounded by space be counted as a word?
const startOfWord = `(?:(?<!${wordChar})(?=${wordChar}))`
const endOfWord = `(?:(?<=${wordChar})(?!${wordChar}))`

type RegexSourceOnlyResult = {
	kind: 'sourceOnly'
	usesRegexSyntax: boolean
	regex: RegExp | null
}

type RegexFullResult = {
	kind: 'full'
	regex: RegExp | null
}

type RegexErrorResult = {
	kind: 'error'
	error: SyntaxError
}

type RegexConfig = RegexSourceOnlyResult | RegexFullResult | RegexErrorResult

export function searchTermToRegexResult(searchTerm: string, flagValues: Flags): RegexConfig {
	const m = searchTerm.match(REGEX_REGEX)

	try {
		if (m == null) {
			const regex = getRegexOrThrow(searchTerm, flagValues)

			return {
				kind: 'sourceOnly',
				usesRegexSyntax: flagValues.regexSyntax,
				regex: regex.source === EMPTY_REGEX_SOURCE ? null : regex,
			}
		}

		const { groups } = m
		assert(groups != null)
		const { source, flags } = groups
		assert(source != null && flags != null)
		const regex = new RegExp(source, combineFlags(flags, 'g'))

		return {
			kind: 'full',
			regex: regex.source === EMPTY_REGEX_SOURCE ? null : regex,
		}
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e

		return {
			kind: 'error',
			error: e,
		}
	}
}

function getRegexOrThrow(source: string, flagValues: Flags) {
	let firstError: SyntaxError

	if (!flagValues.regexSyntax) {
		source = RegExp.escape(source)
	}

	for (const unicodeModeFlag of ['v', 'u', '']) {
		try {
			// gives a more concise error message in case of regex syntax error
			new RegExp(source, unicodeModeFlag)
		} catch (e) {
			if (!(e instanceof SyntaxError)) throw e
			firstError ??= e
			continue
		}

		if (flagValues.wholeWord) source = `${startOfWord}${source}${endOfWord}`
		const flags = combineFlags(unicodeModeFlag, flagValues.matchCase ? '' : 'i', 'gm')

		return new RegExp(source, flags)
	}

	throw firstError!
}

function combineFlags(...flags: (string | null | false)[]) {
	return [...new Set(flags.filter(Boolean).join(''))].sort().join('')
}
