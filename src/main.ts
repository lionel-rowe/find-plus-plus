import './defineCustomElement.ts'
import {
	defaultOptions,
	GET_MATCHES_REQUEST,
	GET_MATCHES_RESPONSE,
	HIGHLIGHT_ALL_ID,
	HIGHLIGHT_CURRENT_ID,
	HIGHLIGHT_TEXT_ID,
	namespacedIds,
} from './config.ts'
import { modulo } from './utils.ts'
import { assert } from '@std/assert/assert'
import { elements } from './elements.ts'
import { TextNodeOffsetWalker } from './textNodeOffset.ts'
import { throttle } from '@std/async/unstable-throttle'
import { CloseEvent, CommandEvent, NotifyReadyEvent, OpenOptionsPageEvent, UpdateOptionsEvent } from './events.ts'
import { searchTermToRegexResult } from './regex.ts'
import type { AppOptions, Command } from './types.ts'
import { type FlagName, getFlags, setFlagDefaults, updateShortkeyHints } from './flagForm.ts'
import { RegexSyntaxHighlights, regexSyntaxHighlightTypes } from './syntaxHighlighting.ts'
import { trimBy } from '@std/text/unstable-trim-by'
import { scrollIntoView } from './scrollToRange.ts'
import { getElementAncestor } from './scrollParent.ts'
import type { GetMatchesRequestData } from './worker.ts'
import { GetMatchesResponseData } from './worker.ts'
import { isDomException } from '@li/is-dom-exception'

let options = defaultOptions

const commandMap: Record<Command, (e: CommandEvent) => void> = {
	open,
	matchCase: toggleFlag('match-case'),
	wholeWord: toggleFlag('whole-word'),
	useRegex: toggleFlag('use-regex'),
}

document.addEventListener(CommandEvent.TYPE, (e) => {
	assert(e instanceof CommandEvent)
	commandMap[e.detail.command](e)
})

document.addEventListener(UpdateOptionsEvent.TYPE, (e) => {
	assert(e instanceof UpdateOptionsEvent)
	// only on first load (i.e. if options still reference-equal to defaultOptions)
	if (options === defaultOptions) setFlagDefaults(elements.flags, e.detail.options)
	options = e.detail.options
	setColors(e.detail.options)
})

function setColors(options: AppOptions) {
	document.documentElement.style.setProperty(`--${HIGHLIGHT_ALL_ID}`, options['colors.all'])
	document.documentElement.style.setProperty(`--${HIGHLIGHT_CURRENT_ID}`, options['colors.current'])
	document.documentElement.style.setProperty(`--${HIGHLIGHT_TEXT_ID}`, options['colors.text'])
}

document.addEventListener(CloseEvent.TYPE, close)
elements.closeButton.addEventListener('click', close)

document.dispatchEvent(new NotifyReadyEvent({ source: 'main' }))

let isOpen = false

let currentAc = new AbortController()
let _reqNo = 0

async function* getMatches({ source, flags, text }: Pick<GetMatchesRequestData, 'source' | 'flags' | 'text'>) {
	const reqNo = ++_reqNo
	currentAc.abort()
	currentAc = new AbortController()

	const { contentWindow, src } = elements.workerRunner
	assert(contentWindow != null)
	contentWindow.postMessage({ kind: 'restart', reqNo }, src)

	const PAGE_SIZE = 500
	let i = 0

	const signal = AbortSignal.any([currentAc.signal, AbortSignal.timeout(options.maxTimeout)])

	while (true) {
		const message: GetMatchesRequestData = {
			kind: GET_MATCHES_REQUEST,
			source,
			flags,
			text,
			start: i++ * PAGE_SIZE,
			num: PAGE_SIZE,
			reqNo,
		}

		const [{ results }] = await Promise.all([
			Promise.race([
				new Promise<GetMatchesResponseData>((res) =>
					globalThis.addEventListener('message', (e) => {
						if (e.data.kind === GET_MATCHES_RESPONSE && e.data.reqNo === reqNo) {
							res(e.data)
						}
					}, { signal })
				),
				new Promise<never>((_, rej) => {
					globalThis.addEventListener(
						'error',
						(e) => rej(Error.isError(e.error) ? e.error : new Error(e.error)),
						{ once: true, signal },
					)
					signal.addEventListener('abort', () => rej(signal.reason))
				}),
			]),
			contentWindow.postMessage(message, src),
		])

		yield* results
		if (results.length === 0) break
	}
}

class MismatchError extends Error {}

async function getRangesOrError(
	element: HTMLElement,
	regex: RegExp,
): Promise<Range[] | MismatchError | (DOMException & { name: 'AbortError' | 'TimeoutError' })> {
	const text = element.textContent ?? ''

	const ranges: Range[] = []

	const walker = new TextNodeOffsetWalker(element)

	try {
		let i = 0
		for await (const { index, arr: [m] } of getMatches({ text, source: regex.source, flags: regex.flags })) {
			const start = walker.next(index)
			const end = walker.next(index + m.length)
			// TODO: throw on other types of mismatch scenarios
			if (start == null || end == null) {
				throw new MismatchError('Text node offset mismatch')
			}
			const range = new Range()
			range.setStart(...start)
			range.setEnd(...end)

			if (filter(range, m)) {
				ranges.push(range)
				if (++i === options.maxMatches) break
			}
		}
	} catch (e) {
		if (isDomException(e, 'AbortError', 'TimeoutError') || e instanceof MismatchError) {
			return e
		}
		throw e
	}

	return ranges
}

function getRangesSync(
	element: HTMLElement,
	regex: RegExp,
): Range[] {
	const text = element.textContent ?? ''

	const ranges: Range[] = []

	const walker = new TextNodeOffsetWalker(element)

	let i = 0
	for (const { index, 0: m } of text.matchAll(regex)) {
		const start = walker.next(index)
		const end = walker.next(index + m.length)
		assert(start != null && end != null)
		const range = new Range()
		range.setStart(...start)
		range.setEnd(...end)

		if (filter(range, m)) {
			ranges.push(range)
			if (++i === options.maxMatches) break
		}
	}

	return ranges
}

function filter(range: Range, text: string) {
	const element = getElementAncestor(range.commonAncestorContainer)
	if (!/\S/.test(text)) return false
	return !element.matches('script, style') && element.checkVisibility()
}

let ranges: Range[] = []
let rangeIndex = 0

const cssLoaded = Promise.all(
	[...elements.container.shadowRoot!.querySelectorAll('link[rel=stylesheet]' as 'link')].map(async (style) => {
		if (style.sheet == null) {
			await new Promise<void>((res) => style.addEventListener('load', () => res(), { once: true }))
		}
	}),
)

// delegate focus to input
elements.textareaOuter.addEventListener('click', () => elements.textarea.focus())

async function open(e: CommandEvent) {
	updateShortkeyHints(elements.flags, e.detail.shortkeys, true)

	await cssLoaded

	elements.container.hidden = false
	elements.textarea.focus()
	elements.textarea.dispatchEvent(new Event('input'))
	isOpen = true
}

function close() {
	elements.container.hidden = true
	CSS.highlights.delete(HIGHLIGHT_ALL_ID)
	CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
	isOpen = false
}

elements.textarea.addEventListener('keydown', (e) => {
	// prevent simple inputs like `<kbd>e</kbd>` on sites like GitHub from acting as site shortcuts when typing normally
	if (/^.$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
		e.stopPropagation()
	}

	if (e.key === 'Enter') {
		e.preventDefault()

		if (e.ctrlKey) {
			document.execCommand('insertText', false, '\n')
		}

		if (ranges.length) {
			const inc = e.shiftKey ? -1 : 1
			setRangeIndex((n) => n + inc)
		}
	}
})

elements.info.addEventListener('click', (e) => {
	const button = e.target
	if (!(button instanceof HTMLButtonElement)) return
	const { setIndex } = button.dataset
	assert(setIndex != null)

	setRangeIndex(parseSetIndex(setIndex))
})

type IndexSetter = number | ((n: number) => number)

function parseSetIndex(str: string): IndexSetter {
	if (/^[+-]?\d+$/.test(str)) return parseInt(str)
	const m = str.trim().match(/^n\s*(?<sign>[+-])\s*(?<value>\d+)\s*$/)
	assert(m != null && m.groups != null && m.groups.sign != null && m.groups.value != null)
	const value = parseInt(m.groups.value)
	const inc = m.groups.sign === '-' ? -value : value

	return (n: number) => n + inc
}

type InfoDisplayState = typeof infoDisplayStates[number]
const infoDisplayStates = ['loading', 'error', 'empty', 'ok'] as const
function setInfoDisplayState(state: InfoDisplayState) {
	for (const s of infoDisplayStates) {
		elements.info.classList.toggle(s, s === state)
	}
}

function setRangeIndex(value: IndexSetter) {
	if (!ranges.length) {
		setInfoDisplayState('empty')
		elements.infoMessage.textContent = elements.textarea.value ? 'No results' : ''
		CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
		return
	}

	setInfoDisplayState('ok')

	rangeIndex = modulo(typeof value === 'function' ? value(rangeIndex) : value, ranges.length)
	const range = ranges[rangeIndex]!

	CSS.highlights.set(HIGHLIGHT_CURRENT_ID, new Highlight(range))

	scrollIntoView(range)

	elements.infoMessage.textContent = `${rangeIndex + 1} of ${ranges.length}`
}

const SHOW_SPINNER_TIMEOUT_MS = 200
const updateSearch = throttle(_updateSearch, (n) => n, { ensureLast: true })

elements.textarea.addEventListener('input', updateSearch)
elements.flags.addEventListener('change', updateSearch)

const pastedTextConverters: Record<string, (s: string) => string> = {
	'text/plain': (x) => x,
	'text/html': (x) => new DOMParser().parseFromString(x, 'text/html').textContent ?? '',
}

elements.textarea.addEventListener('paste', (e) => {
	if (onPaste(e.clipboardData)) e.preventDefault()
})
elements.textarea.addEventListener('drop', (e) => {
	if (onPaste(e.dataTransfer)) e.preventDefault()
})
function onPaste(dt: DataTransfer | null): boolean {
	if (dt == null) return false

	for (const [mime, getText] of Object.entries(pastedTextConverters)) {
		const val = dt.getData(mime)
		if (val) return document.execCommand('insertText', false, trimBy(getText(val), /[\r\n]/))
	}

	return false
}

function toggleFlag(name: FlagName) {
	const el = elements.flags.querySelector(`[name="${name}"]`)
	assert(el instanceof HTMLInputElement && el.type === 'checkbox')

	return () => {
		if (!isOpen) return
		el.checked = !el.checked
		elements.textarea.dispatchEvent(new Event('input'))
	}
}

async function _updateSearch() {
	for (const name of regexSyntaxHighlightTypes) {
		CSS.highlights.get(namespacedIds.get(name))!.clear()
	}

	const source = elements.textarea.value
	const result = searchTermToRegexResult(source, getFlags(elements.flags))

	const isRegex = result.kind === 'full' || result.kind === 'error' || result.usesRegexSyntax

	elements.textarea.classList.toggle('code', isRegex)
	elements.textarea.classList.toggle('prose', !isRegex)

	if (result.kind === 'error') {
		removeAllHighlights()
		elements.infoMessage.textContent = result.error.message
		setInfoDisplayState('error')
		return
	}

	const { regex, kind, empty } = result

	elements.textarea.title = isRegex ? regex?.toString() ?? '' : ''

	elements.flags.hidden = kind === 'full'

	if (isRegex && elements.textarea.textContent) {
		const highlights = new RegexSyntaxHighlights(
			elements.textarea,
			regex ?? { unicodeSets: true },
			result.kind === 'full',
		)
		for (const [name, range] of highlights.result) {
			CSS.highlights.get(namespacedIds.get(name))!.add(range)
		}
	}

	if (empty) {
		removeAllHighlights()
		return
	}

	const rangesPromise = getRangesOrError(document.body, regex)
	// only remove existing highlight & show loading spinner if results not retrieved within `SHOW_SPINNER_TIMEOUT_MS`
	// to avoid unnecessary flicker
	const loadingTimeout = setTimeout(() => {
		removeAllHighlights()
		setInfoDisplayState('loading')
	}, SHOW_SPINNER_TIMEOUT_MS)
	rangesPromise.then(() => clearTimeout(loadingTimeout)).catch(() => clearTimeout(loadingTimeout))
	const start = Date.now()
	let r = await rangesPromise
	errorHandler: if (Error.isError(r)) {
		if (isDomException(r, 'AbortError')) {
			// no-op
			return
		}
		if (r instanceof MismatchError) {
			const elapsed = Date.now() - start
			if (elapsed > options.maxTimeout / 2) {
				// most likely can't finish within timeout
				r = new DOMException(undefined, 'TimeoutError')
			} else {
				// retry synchronously (error is likely due to DOM mutations during async operation)
				r = getRangesSync(document.body, regex)
				break errorHandler
			}
		}

		assert(isDomException(r, 'TimeoutError'))

		removeAllHighlights()
		elements.infoMessage.textContent = 'Timed out'
		setInfoDisplayState('error')
		return
	}

	ranges = r

	setInfoDisplayState(ranges.length ? 'ok' : 'empty')
	rangeIndex = 0

	CSS.highlights.set(HIGHLIGHT_ALL_ID, new Highlight(...ranges))
	setRangeIndex(0)
}

function removeAllHighlights() {
	CSS.highlights.delete(HIGHLIGHT_ALL_ID)
	ranges = []
	rangeIndex = 0
	setRangeIndex(0)
}

elements.optionsButton.addEventListener('click', () => {
	document.dispatchEvent(new OpenOptionsPageEvent())
})
