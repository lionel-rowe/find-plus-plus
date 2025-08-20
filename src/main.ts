import './defineCustomElement.ts'
import { defaultOptions, HIGHLIGHT_ALL_ID, HIGHLIGHT_CURRENT_ID, HIGHLIGHT_TEXT_ID, namespaced } from './config.ts'
import { modulo } from './utils.ts'
import { assert } from '@std/assert/assert'
import { elements } from './elements.ts'
import { TextNodeOffsetWalker } from './textNodeOffset.ts'
import { throttle } from '@std/async/unstable-throttle'
import { CloseEvent, CommandEvent, NotifyReadyEvent, UpdateOptionsEvent } from './events.ts'
import { searchTermToRegexResult } from './regex.ts'
import type { AppOptions, Command } from './types.ts'
import { type FlagName, getFlags, setFlagDefaults, updateShortkeyHints } from './flagForm.ts'
import { RegexSyntaxHighlights, regexSyntaxHighlightTypes } from './syntaxHighlighting.ts'
import { trimBy } from '@std/text/unstable-trim-by'
import { scrollIntoView } from './scrollToRange.ts'
import { getElementAncestor } from './scrollParent.ts'

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
	options = e.detail.options
	setFlagDefaults(elements.flags, options)
	setColors(options)
})

function setColors(options: AppOptions) {
	document.documentElement.style.setProperty(`--${HIGHLIGHT_ALL_ID}`, options['colors.all'])
	document.documentElement.style.setProperty(`--${HIGHLIGHT_CURRENT_ID}`, options['colors.current'])
	document.documentElement.style.setProperty(`--${HIGHLIGHT_TEXT_ID}`, options['colors.text'])
}

document.addEventListener(CloseEvent.TYPE, close)

document.dispatchEvent(new NotifyReadyEvent())

let isOpen = false

function getRanges(element: HTMLElement, regex: RegExp) {
	const text = element.textContent ?? ''

	const ranges: Range[] = []

	try {
		const walker = new TextNodeOffsetWalker(element)

		let i = 0
		for (const m of text.matchAll(regex)) {
			const start = walker.next(m.index)
			const end = walker.next(m.index + m[0].length)
			assert(start != null && end != null)
			const range = new Range()
			range.setStart(...start)
			range.setEnd(...end)

			if (filter(range, m[0])) {
				ranges.push(range)
				if (++i === options.maxMatches) break
			}
		}
	} catch (e) {
		console.error(e)
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

function setRangeIndex(value: IndexSetter) {
	elements.info.classList.remove('error')

	if (!ranges.length) {
		elements.info.classList.add('empty')
		elements.infoMessage.textContent = elements.textarea.value ? 'No results' : ''
		CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
		return
	}

	elements.info.classList.remove('empty')

	rangeIndex = modulo(typeof value === 'function' ? value(rangeIndex) : value, ranges.length)
	const range = ranges[rangeIndex]!

	CSS.highlights.set(HIGHLIGHT_CURRENT_ID, new Highlight(range))

	scrollIntoView(range)

	elements.infoMessage.textContent = `${rangeIndex + 1} of ${ranges.length}`
}

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

export function toggleFlag(name: FlagName) {
	const el = elements.flags.querySelector(`[name="${name}"]`)
	assert(el instanceof HTMLInputElement && el.type === 'checkbox')

	return () => {
		if (!isOpen) return
		el.checked = !el.checked
		elements.textarea.dispatchEvent(new Event('input'))
	}
}

function _updateSearch() {
	for (const name of regexSyntaxHighlightTypes) {
		CSS.highlights.get(namespaced(name))!.clear()
	}

	const source = elements.textarea.value
	const result = searchTermToRegexResult(source, getFlags(elements.flags))

	const isRegex = result.kind === 'full' || result.kind === 'error' || result.usesRegexSyntax

	elements.textarea.classList.toggle('code', isRegex)
	elements.textarea.classList.toggle('prose', !isRegex)

	if (result.kind === 'error') {
		removeAllHighlights()
		elements.infoMessage.textContent = result.error.message
		elements.info.classList.add('error')
		return
	}

	const { regex, kind } = result

	elements.flags.hidden = kind === 'full'

	if (regex == null) {
		removeAllHighlights()
		return
	}

	if (isRegex) {
		const highlights = new RegexSyntaxHighlights(elements.textarea, regex, result.kind === 'full')
		for (const [name, range] of highlights.result) {
			CSS.highlights.get(namespaced(name))!.add(range)
		}
	}

	ranges = getRanges(document.body, regex)
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
