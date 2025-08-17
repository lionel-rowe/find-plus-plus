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

type RegexConfig = {
	kind: 'full' | 'sourceOnly'
	regex: RegExp | null
}

export function searchTermToRegexConfig(searchTerm: string, flagValues: Flags): RegexConfig {
	const m = searchTerm.match(REGEX_REGEX)

	if (m == null) {
		const regex = createRegex(searchTerm, flagValues)

		return {
			kind: 'sourceOnly',
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
}

function createRegex(source: string, flagValues: Flags) {
	if (!flagValues.regexSyntax) source = RegExp.escape(source)
	if (flagValues.wholeWord) source = `${startOfWord}${source}${endOfWord}`
	const flags = combineFlags(flagValues.matchCase ? '' : 'i', 'gvm')

	return new RegExp(source, flags)
}

function combineFlags(...flags: (string | null | false)[]) {
	return [...new Set(flags.filter(Boolean).join(''))].sort().join('')
}
