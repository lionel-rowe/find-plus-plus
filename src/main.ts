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
import { throttle } from '@std/async/unstable-throttle'
import {
	CheckReadyEvent,
	CloseEvent,
	CommandEvent,
	NotifyReadyEvent,
	OpenOptionsPageEvent,
	UpdateOptionsEvent,
} from './events.ts'
import { type RegexConfig, searchTermToRegexResult } from './regex.ts'
import type { AppOptions, Command } from './types.ts'
import { type FlagName, getFlags, setFlagDefaults, updateShortkeyHints } from './flagForm.ts'
import { RegexSyntaxHighlights, regexSyntaxHighlightTypes } from './syntaxHighlighting.ts'
import { trimBy } from '@std/text/unstable-trim-by'
import { scrollIntoView } from './scrollToRange.ts'
import { getElementAncestor } from './scrollParent.ts'
import type { GetMatchesRequestData, Normalization } from './worker.ts'
import { GetMatchesResponseData } from './worker.ts'
import { isDomException } from '@li/is-dom-exception'
import { eventMatchesCombo } from './shortkeys.ts'
// import { NormalizedMatcher } from '@li/irregex/matchers/normalized'
// import { normalizersFor } from './normalizers.ts'
import { innerText } from './innerText.ts'
import { checkVisibility, type VisibilityChecker } from './checkVisibility.ts'

let options = defaultOptions

const shortKeyMap: Record<Command, (e: CommandEvent) => void> = {
	_execute_action: open,
}

document.addEventListener(CommandEvent.TYPE, (e) => {
	assert(e instanceof CommandEvent)
	console.log(e.detail)
	if (e.detail.isTest) {
		// @ts-ignore globalThis
		globalThis.innerText = innerText
	}
	shortKeyMap[e.detail.command](e)
})

document.addEventListener(UpdateOptionsEvent.TYPE, (e) => {
	assert(e instanceof UpdateOptionsEvent)

	if (options === defaultOptions) {
		// only on first load (i.e. if options still reference-equal to defaultOptions)
		setFlagDefaults(elements.flags, e.detail.options)
	}

	options = e.detail.options
	updateShortkeyHints(elements.flags, options.flags, true)

	setColors(e.detail.options)
})

const highlightStyles = new CSSStyleSheet()
document.adoptedStyleSheets.push(highlightStyles)

function setColors(options: AppOptions) {
	const styleMapping = Object.entries({
		[HIGHLIGHT_ALL_ID]: options.colors.all,
		[HIGHLIGHT_CURRENT_ID]: options.colors.current,
		[HIGHLIGHT_TEXT_ID]: options.colors.text,
	})

	highlightStyles.replaceSync(`:root {${styleMapping.map(([id, color]) => `--${id}: ${color};`).join('')}}`)
}

document.addEventListener(CloseEvent.TYPE, close)
elements.closeButton.addEventListener('click', close)

document.dispatchEvent(new NotifyReadyEvent({ source: 'main' }))

const workerRunnerReady = (() => {
	const ac = new AbortController()
	return Promise.all([
		new Promise<void>((res) =>
			globalThis.addEventListener('message', (e) => {
				if (e.data.kind === NotifyReadyEvent.TYPE && e.source === elements.workerRunner.contentWindow) {
					res()
					ac.abort()
				}
			}, { signal: ac.signal })
		),
		elements.workerRunner.contentWindow?.postMessage({ kind: CheckReadyEvent.TYPE }, { targetOrigin: '*' }),
	])
})()

let isOpen = false

let currentAc = new AbortController()
let _reqNo = 0

async function* getMatches(
	{ source, flags, text, normalizations }: Pick<
		GetMatchesRequestData,
		'source' | 'flags' | 'text' | 'normalizations'
	>,
) {
	await workerRunnerReady
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
			normalizations,
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
	normalizations: Normalization[],
): Promise<Range[] | MismatchError | (DOMException & { name: 'AbortError' | 'TimeoutError' })> {
	const innerTextResult = innerText(element)
	const { text } = innerTextResult

	const ranges: Range[] = []

	const checkVisible = checkVisibility(document.documentElement.getBoundingClientRect())

	try {
		let i = 0
		let cursor = 0
		for await (
			const { index, arr: [m] } of getMatches({ text, source: regex.source, flags: regex.flags, normalizations })
		) {
			const startNodeOffsetIncrement = innerTextResult.offsets.slice(cursor).findIndex((x) => x > index)
			const startNodeOffsetIndex = Math.max(0, cursor + startNodeOffsetIncrement - 1)
			const endIndex = index + m.length
			const endNodeOffsetIncrement = innerTextResult.offsets.slice(startNodeOffsetIndex).findIndex((x) =>
				x > endIndex
			) - 1

			if (endNodeOffsetIncrement < 0 || endNodeOffsetIncrement < 0) {
				throw new MismatchError('Text node offset mismatch')
			}

			const endNodeOffsetIndex = startNodeOffsetIndex + endNodeOffsetIncrement
			cursor = endNodeOffsetIndex

			const range = new Range()

			const start: [Text, number] = [
				innerTextResult.nodes[startNodeOffsetIndex]!,
				index - innerTextResult.offsets[startNodeOffsetIndex]!,
			]
			const end: [Text, number] = [
				innerTextResult.nodes[endNodeOffsetIndex]!,
				endIndex - innerTextResult.offsets[endNodeOffsetIndex]!,
			]

			range.setStart(...start)
			range.setEnd(...end)

			// if (filter(range, m, checkVisible)) {
			ranges.push(range)
			if (++i === options.maxMatches) break
			// }
		}
	} catch (e) {
		if (isDomException(e, 'AbortError', 'TimeoutError') || e instanceof MismatchError) {
			return e
		}
		throw e
	}

	return ranges
}

// const IGNORED_ELEMENT_SELECTOR = [
// 	'script',
// 	'style',
// 	// TODO: Support `textarea` somehow? Currently doesn't work properly due to reading `textContent`/`innerText`,
// 	// which doesn't update when `textarea`'s content is changed; additionally, `Range` objects don't work properly
// 	// within `textarea`s, so impossible to highlight.
// 	'textarea',
// 	// TODO: Support `input` somehow? Same issues as `textarea`
// 	'input',
// ].join(', ')

// function filter(range: Range, text: string, checkVisible: VisibilityChecker): boolean {
// 	const el = getElementAncestor(range.commonAncestorContainer)
// 	if (!/\S/.test(text)) return false
// 	return !el.matches(IGNORED_ELEMENT_SELECTOR) && checkVisible(el)
// }

let ranges: Range[] = []
let rangeIndex = 0

const cssLoaded = Promise.all(
	[...elements.container.shadowRoot!.querySelectorAll('link[rel=stylesheet]' as 'link')]
		.map(async (style) => {
			if (style.sheet == null) {
				await new Promise((res) => style.addEventListener('load', res, { once: true }))
			}
		}),
)

// delegate focus to input
for (const eventName of ['click', 'mousedown'] as const) {
	elements.textareaOuter.addEventListener(eventName, () => elements.textarea.focus())
}

function keydownWhileOpenHandler(e: KeyboardEvent) {
	const shortkeyConfig = (['close', 'matchCase', 'wholeWord', 'useRegex', 'normalizeDiacritics'] as const)
		.map((name) => ({
			name,
			shortkey: name === 'close' ? options.actions.close.shortkey : options.flags[name].shortkey,
		}))

	const matched = eventMatchesCombo(e, ...shortkeyConfig.map(({ shortkey }) => shortkey) as [string])

	if (matched == null) return

	e.preventDefault()
	e.stopPropagation()

	const { name } = shortkeyConfig.find(({ shortkey }) => shortkey === matched)!

	if (name === 'close') {
		close()
	} else {
		toggleFlag(name)()
	}
}

async function open(_e: CommandEvent) {
	await cssLoaded

	elements.container.hidden = false
	elements.textarea.focus()
	elements.textarea.dispatchEvent(new Event('input'))
	isOpen = true

	globalThis.addEventListener('keydown', keydownWhileOpenHandler)
}

function close() {
	elements.container.hidden = true
	CSS.highlights.delete(HIGHLIGHT_ALL_ID)
	CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
	isOpen = false
	globalThis.removeEventListener('keydown', keydownWhileOpenHandler)
}

elements.textarea.addEventListener('keydown', (e) => {
	// prevent simple inputs like `<kbd>e</kbd>` on sites like GitHub from acting as site shortcuts when typing normally
	if (/^.$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
		e.stopPropagation()
	} else if (e.key === 'Enter') {
		e.preventDefault()

		if (e.ctrlKey) {
			document.execCommand('insertText', false, '\n')
		}

		if (ranges.length) {
			const inc = e.shiftKey ? -1 : 1
			setRangeIndex((n) => n + inc)
		}
	} else {
		const matched = eventMatchesCombo(e, 'Ctrl+A')

		if (matched != null) {
			switch (matched) {
				case 'Ctrl+A': {
					e.stopPropagation()
					// prevent "select all" from propagating to other page elements (e.g. on GitHub)
					break
				}
			}
			return
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
		elements.infoMessage.textContent = 'No results'
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

	const isRegex = result.kind === 'full' || result.kind === 'error' || result.useRegex

	elements.textarea.classList.toggle('code', isRegex)
	elements.textarea.classList.toggle('prose', !isRegex)

	if (result.kind === 'error') {
		removeAllHighlights()
		elements.infoMessage.textContent = result.error.message
		elements.infoMessage.hidden = false
		setInfoDisplayState('error')
		return
	}

	const { regex, kind, empty } = result

	elements.textarea.title = isRegex ? regex?.toString() ?? '' : ''
	elements.flags.hidden = kind === 'full'
	elements.infoMessage.hidden = empty

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

	const rangesPromise = getRangesOrError(document.body, regex, result.normalizations)
	// only remove existing highlight & show loading spinner if results not retrieved within `SHOW_SPINNER_TIMEOUT_MS`
	// to avoid unnecessary flicker
	const loadingTimeout = setTimeout(() => {
		removeAllHighlights()
		setInfoDisplayState('loading')
	}, SHOW_SPINNER_TIMEOUT_MS)
	rangesPromise.then(() => clearTimeout(loadingTimeout)).catch(() => clearTimeout(loadingTimeout))
	const r = await rangesPromise
	if (Error.isError(r)) {
		if (isDomException(r, 'AbortError')) {
			// no-op
			return
		}
		if (r instanceof MismatchError) {
			removeAllHighlights()
			elements.infoMessage.textContent = 'Unable to match text'
			setInfoDisplayState('error')
			return
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
