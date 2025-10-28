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
import { searchTermToRegexResult } from './regex.ts'
import type { AppOptions, Command } from './types.ts'
import { type FlagName, getFlags, setFlagDefaults, updateShortkeyHints } from './flagForm.ts'
import { RegexSyntaxHighlights, regexSyntaxHighlightTypes } from './syntaxHighlighting.ts'
import { trimBy } from '@std/text/unstable-trim-by'
import type { GetMatchesRequestData, Normalization } from './worker.ts'
import { GetMatchesResponseData } from './worker.ts'
import { isDomException } from '@li/is-dom-exception'
import { eventMatchesCombo } from './shortkeys.ts'
import { InnerText, InnerTextRangeError, innerTextRegistry } from '@li/inner-text'
import { type IndexSetter, state } from './state.ts'
// import { findSorted, type Sorted } from './sorted.ts'

const getRoot = () => document.body ?? document.documentElement

function makeObserverConfig<T extends MutationObserver | ResizeObserver>(
	getEl: () => Element,
	observer: T,
	observe: (observer: T, el: Element) => void,
) {
	return {
		observe: () => observe(observer, getEl()),
		disconnect: () => observer.disconnect(),
	}
}

const observers = [
	makeObserverConfig(
		getRoot,
		new MutationObserver(() => innerTextRegistry.markStale(getRoot())),
		(x, root) => x.observe(root, { characterData: true, childList: true, subtree: true, attributes: true }),
	),
	makeObserverConfig(
		getRoot,
		new ResizeObserver(() => innerTextRegistry.markStale(getRoot())),
		(x, root) => x.observe(root),
	),
]

let options = defaultOptions

const shortKeyMap: Record<Command, (e: CommandEvent) => void> = {
	_execute_action: open,
}

document.addEventListener(CommandEvent.TYPE, (e) => {
	assert(e instanceof CommandEvent)
	if (e.detail.isTest) {
		// deno-lint-ignore no-explicit-any
		const global = globalThis as any
		global.InnerText = InnerText
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
	currentAc.abort()
	currentAc = new AbortController()
	const signal = AbortSignal.any([currentAc.signal, AbortSignal.timeout(options.maxTimeout)])
	const reqNo = ++_reqNo

	await workerRunnerReady

	const { contentWindow, src } = elements.workerRunner
	assert(contentWindow != null)
	contentWindow.postMessage({ kind: 'restart', reqNo }, src)

	const PAGE_SIZE = 500
	let i = 0

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
						if (e.data.kind === GET_MATCHES_RESPONSE) {
							if (e.data.reqNo === reqNo) {
								res(e.data)
							}
						}
					}, { signal })
				),
				new Promise<never>((_, rej) => {
					globalThis.addEventListener(
						'error',
						(e) => rej(Error.isError(e.error) ? e.error : new Error(e.error)),
						{ once: true, signal },
					)
					if (signal.aborted) rej(signal.reason)
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
	regex: RegExp,
	normalizations: Normalization[],
): Promise<Range[] | MismatchError | (DOMException & { name: 'AbortError' | 'TimeoutError' })> {
	const innerText = innerTextRegistry.get(getRoot())

	const ranges: Range[] = []

	try {
		let i = 0
		const matches = getMatches({
			text: innerText.toString(),
			source: regex.source,
			flags: regex.flags,
			normalizations,
		})

		for await (const { index, arr: [m] } of matches) {
			ranges.push(innerText.range(index, index + m.length))

			if (++i === options.maxMatches) break
		}
	} catch (e) {
		if (e instanceof InnerTextRangeError) return new MismatchError(e.message)
		if (isDomException(e, 'AbortError', 'TimeoutError')) return e

		throw e
	}

	return ranges
}

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
	for (const { observe } of observers) observe()

	await cssLoaded

	elements.container.hidden = false
	elements.textarea.focus()
	elements.textarea.dispatchEvent(new Event('input'))
	isOpen = true

	globalThis.addEventListener('keydown', keydownWhileOpenHandler)
}

function close() {
	for (const { disconnect } of observers) disconnect()

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
		} else {
			const inc = e.shiftKey ? -1 : 1
			state.updateRangeIndex((n) => n + inc)
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

	state.updateRangeIndex(parseSetIndex(setIndex))
})

function parseSetIndex(str: string): IndexSetter {
	if (/^[+-]?\d+$/.test(str)) return parseInt(str)
	const m = str.trim().match(/^n\s*(?<sign>[+-])\s*(?<value>\d+)\s*$/)
	assert(m != null && m.groups != null && m.groups.sign != null && m.groups.value != null)
	const value = parseInt(m.groups.value)
	const inc = m.groups.sign === '-' ? -value : value

	return (n: number) => n + inc
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
		if (val) return document.execCommand('insertText', false, trimBy(getText(val).replaceAll(/\r\n?/g, '\n'), '\n'))
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

// TODO: remove this hack, as stale updates ought to already be prevented by abort signals in `getMatches`
// however, current abort behavior is bugged so this is needed for now
let currentUpdate = -1
async function _updateSearch() {
	const thisUpdate = ++currentUpdate
	for (const name of regexSyntaxHighlightTypes) {
		CSS.highlights.get(namespacedIds.get(name))!.clear()
	}

	const source = elements.textarea.value
	const result = searchTermToRegexResult(source, getFlags(elements.flags))

	const isRegex = result.kind === 'full' || result.kind === 'error' || result.useRegex

	elements.textarea.classList.toggle('code', isRegex)
	elements.textarea.classList.toggle('prose', !isRegex)

	if (result.kind === 'error') {
		state.updateView({ kind: 'error', message: result.error.message })
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
		state.updateView({ kind: 'void' })
		return
	}

	const rangesPromise = getRangesOrError(regex, result.normalizations)
	// only remove existing highlight & show loading spinner if results not retrieved within `SHOW_SPINNER_TIMEOUT_MS`
	// to avoid unnecessary flicker
	const loadingTimeout = setTimeout(() => {
		state.updateView({ kind: 'loading' })
	}, SHOW_SPINNER_TIMEOUT_MS)
	rangesPromise.then(() => clearTimeout(loadingTimeout)).catch(() => clearTimeout(loadingTimeout))
	const ranges = await rangesPromise

	if (thisUpdate !== currentUpdate) return

	if (Error.isError(ranges)) {
		if (isDomException(ranges, 'AbortError')) {
			// no-op
			return
		}
		if (ranges instanceof MismatchError) {
			state.updateView({ kind: 'error', message: 'Unable to match text' })
			return
		}

		assert(isDomException(ranges, 'TimeoutError'))

		state.updateView({ kind: 'error', message: 'Timed out' })
		return
	}

	state.updateView({ kind: 'ok', ranges, currentIndex: 0 })
}

elements.optionsButton.addEventListener('click', () => {
	document.dispatchEvent(new OpenOptionsPageEvent())
})
