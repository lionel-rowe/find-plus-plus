import './defineCustomElement.ts'
import { HIGHLIGHT_ALL_ID, HIGHLIGHT_ONE_ID } from './config.ts'
import { modulo } from './utils.ts'
import { assert } from '@std/assert/assert'
import { elements } from './elements.ts'
import { TextNodeOffsetWalker } from './textNodeOffset.ts'
import { throttle } from '@std/async/unstable-throttle'
import { CommandEvent, NotifyReadyEvent, UpdateOptionsEvent } from './events.ts'
import { searchTermToRegexResult } from './regex.ts'
import type { Command } from './types.ts'
import { type FlagName, getFlags, setFlagDefaults } from './flagForm.ts'

const commandMap: Record<Command, () => void> = {
	open,
	close,
	matchCase: toggleFlag('match-case'),
	wholeWord: toggleFlag('whole-word'),
	useRegex: toggleFlag('use-regex'),
}

document.addEventListener(CommandEvent.TYPE, (e) => {
	assert(e instanceof CommandEvent)
	commandMap[e.detail.command]()
})

document.addEventListener(UpdateOptionsEvent.TYPE, (e) => {
	assert(e instanceof UpdateOptionsEvent)
	const { options } = e.detail
	setFlagDefaults(elements.flags, options)
})

document.dispatchEvent(new NotifyReadyEvent())

let isOpen = false

// limit for perf reasons. limit number might need tweaking
const MAX_MATCHES = 5000

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
				if (++i === MAX_MATCHES) break
			}
		}
	} catch (e) {
		console.error(e)
	}

	return ranges
}

function filter(range: Range, text: string) {
	const element = getElementAncestor(range)
	if (!/\S/.test(text)) return false
	return !element.matches('script, style') && element.checkVisibility()
}

function getElementAncestor(range: Range) {
	const container = range.commonAncestorContainer
	return container instanceof HTMLElement ? container : container.parentElement ?? document.documentElement
}

let ranges: Range[] = []
let rangeIndex = 0

const cssLoaded = new Promise<void>((res) => {
	const { style } = elements
	if (style.sheet) return res()
	else style.addEventListener('load', () => res(), { once: true })
})

async function open() {
	await cssLoaded

	elements.container.hidden = false
	elements.textarea.focus()
	elements.textarea.dispatchEvent(new Event('input'))
	isOpen = true
}

function close() {
	elements.container.hidden = true
	CSS.highlights.delete(HIGHLIGHT_ALL_ID)
	CSS.highlights.delete(HIGHLIGHT_ONE_ID)
	isOpen = false
}

elements.textarea.addEventListener('keydown', (e) => {
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
		CSS.highlights.delete(HIGHLIGHT_ONE_ID)
		return
	}

	elements.info.classList.remove('empty')

	rangeIndex = modulo(typeof value === 'function' ? value(rangeIndex) : value, ranges.length)
	const range = ranges[rangeIndex]!

	CSS.highlights.set(HIGHLIGHT_ONE_ID, new Highlight(range))

	scrollToRange(range)

	elements.infoMessage.textContent = `${rangeIndex + 1} of ${ranges.length}`
}

function scrollToRange(range: Range) {
	// make sure the parent element is in view (including child scroll containers)
	const element = getElementAncestor(range)
	element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' })

	// target the range's bounding box more acurately (ignores child scroll containers)
	const rect = range.getBoundingClientRect()

	const totalHeight = document.documentElement.clientHeight
	const totalWidth = document.documentElement.clientWidth

	const options = {
		behavior: 'instant',
		top: rect.top + window.scrollY - totalHeight / 2 - rect.height / 2,
		left: rect.left + window.scrollY - totalWidth / 2 - rect.width / 2,
	} as const
	document.documentElement.scrollTo(options)
}

const updateSearch = throttle(_updateSearch, (n) => n, { ensureLast: true })

elements.textarea.addEventListener('input', updateSearch)
elements.flags.addEventListener('change', updateSearch)

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
	const source = elements.textarea.value
	const result = searchTermToRegexResult(source, getFlags(elements.flags))

	elements.textarea.style.fontFamily = result.kind === 'full' || result.kind === 'error' || result.usesRegexSyntax
		? 'var(--code-font)'
		: 'var(--prose-font)'

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
