import { assert } from '@std/assert/assert'
import { Normalization } from './worker.ts'

export type Flags = {
	useRegex: boolean
	matchCase: boolean
	wholeWord: boolean
	normalizeDiacritics: boolean
}

const REGEX_REGEX = /^\s*\/(?<source>.+)\/(?<flags>[dgimsuvy]*)\s*$/su
const EMPTY_REGEX_SOURCE = new RegExp('').source

type WordDelimiters = {
	wordChar: string
	nonSpace: string
}

const wordDelimiterCache = new Map<string, WordDelimiters>()
function wordBoundaryForMode(mode: 'v' | 'u' | ''): string {
	const cached = wordDelimiterCache.get(mode)
	if (cached) return getWordBoundary(cached)

	const wordDelimiters: WordDelimiters = mode === ''
		? {
			wordChar: String.raw`\w`,
			nonSpace: String.raw`\S`,
		}
		: {
			wordChar: String.raw`[\p{L}\p{M}\p{N}]`,
			nonSpace: String.raw`\P{space}`,
		}

	wordDelimiterCache.set(mode, wordDelimiters)
	return getWordBoundary(wordDelimiters)
}

function firstOfKind(source: string) {
	return `(?<!${source})(?=${source})`
}
function lastOfKind(source: string) {
	return `(?<=${source})(?!${source})`
}
function anyOf(sources: string[], convert?: (source: string) => string) {
	convert ??= (source) => source
	return `(?:${sources.map(convert).join('|')})`
}
function getWordBoundary({ wordChar, nonSpace }: WordDelimiters) {
	const alternates = [wordChar, nonSpace]
	return anyOf([
		anyOf(alternates, firstOfKind),
		anyOf(alternates, lastOfKind),
	])
}

type RegexSourceOnlyResult = {
	kind: 'sourceOnly'
	useRegex: boolean
	regex: RegExp
	empty: boolean
	normalizations: Normalization[]
}

type RegexFullResult = {
	kind: 'full'
	regex: RegExp
	empty: boolean
	normalizations: Normalization[]
}

type RegexErrorResult = {
	kind: 'error'
	error: SyntaxError
	normalizations: Normalization[]
}

export type RegexConfig = RegexSourceOnlyResult | RegexFullResult | RegexErrorResult

function isEmpty(source: string, flagValues: Flags) {
	return source === '' || (flagValues.useRegex && source === EMPTY_REGEX_SOURCE)
}

export function searchTermToRegexResult(searchTerm: string, flagValues: Flags): RegexConfig {
	const m = searchTerm.match(REGEX_REGEX)
	const normalizations: Normalization[] = []
	if (flagValues.normalizeDiacritics) normalizations.push('diacritics')

	try {
		if (m == null) {
			const regex = getRegexOrThrow(searchTerm, flagValues)

			return {
				kind: 'sourceOnly',
				useRegex: flagValues.useRegex,
				regex,
				empty: isEmpty(searchTerm, flagValues),
				normalizations,
			}
		}

		const { groups } = m
		assert(groups != null)
		const { source, flags } = groups
		assert(source != null && flags != null)
		const regex = new RegExp(source, combineFlags(flags, 'g'))

		return {
			kind: 'full',
			regex,
			empty: regex.source === EMPTY_REGEX_SOURCE,
			normalizations,
		}
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e

		return {
			kind: 'error',
			error: e,
			normalizations,
		}
	}
}

function getRegexOrThrow(source: string, flagValues: Flags) {
	let firstError: SyntaxError

	if (!flagValues.useRegex) {
		source = RegExp.escape(source)
	}

	for (const unicodeModeFlag of ['v', 'u', ''] as const) {
		try {
			// gives a more concise error message in case of regex syntax error
			new RegExp(source, unicodeModeFlag)
		} catch (e) {
			if (!(e instanceof SyntaxError)) throw e
			firstError ??= e
			continue
		}

		if (flagValues.wholeWord) {
			const wordBoundary = wordBoundaryForMode(unicodeModeFlag)
			source = `${wordBoundary}${source}${wordBoundary}`
		}
		const flags = combineFlags(unicodeModeFlag, flagValues.matchCase ? '' : 'i', 'gm')

		return new RegExp(source, flags)
	}

	throw firstError!
}

function combineFlags(...flags: (string | null | false)[]) {
	return [...new Set(flags.filter(Boolean).join(''))].sort().join('')
}
