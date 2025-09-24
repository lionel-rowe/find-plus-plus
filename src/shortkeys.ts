import { escapeHtml } from './utils.ts'

// TODO: collocate different forms of keys together and document properly ("normalized", "pretty", "combo", etc.)

declare global {
	interface Navigator {
		userAgentData?: {
			platform: string
		}
	}
}

export const platform = {
	isApple: /\b[Mm]ac|\biP/.test(navigator.userAgentData?.platform ?? navigator.platform),
}

export const defaultComboModifier = () => platform.isApple ? 'Meta' : 'Control'

const normalized = new Map([
	[' ', 'Space'],
	['+', 'Plus'],
	['Ctrl', 'Control'],
])

export type KbdEvent = {
	key: string
} & Partial<Record<typeof eventModifiers[keyof typeof eventModifiers], boolean>>

const capitalizations = new Map([
	'ArrowRight',
	'ArrowLeft',
	'ArrowUp',
	'ArrowDown',
	'PageUp',
	'PageDown',
	'CapsLock',
	'NumLock',
	'ScrollLock',
	'PrintScreen',
].map((x) => [x.toLowerCase(), x]))

function recapitalize(s: string) {
	const cased = capitalizations.get(s.toLowerCase())
	if (cased != null) return cased
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// https://superuser.com/questions/1238062/key-combination-order
const bareEventModifiers = ['ctrl', 'alt', 'shift', 'meta'] as const
const eventModifiers = Object.fromEntries(bareEventModifiers.map((k) => [k, `${k}Key` as const]))
const normalizedEventModifiers = bareEventModifiers.map((k) => {
	const x = recapitalize(k)
	return normalized.get(x) ?? x
})

function indexOrMax(arr: string[], val: string) {
	const idx = arr.indexOf(val)
	return idx === -1 ? arr.length : idx
}

const PLUS_SPLITTER = /(?<!\+)\+|(?<=\+\+)\+/

function normalizeCombo(combo: string) {
	if (!combo) return ''

	const parts = [
		...new Set(
			combo.split(PLUS_SPLITTER).map((x) => {
				x = recapitalize(x)
				return normalized.get(x) ?? x
			}),
		),
	]
		.sort((a, b) => {
			return (Number(a.length === 1) - Number(b.length === 1)) ||
				(indexOrMax(normalizedEventModifiers, a) - indexOrMax(normalizedEventModifiers, b)) ||
				(a > b ? 1 : -1)
		})

	const singleCharIdx = parts.findIndex((x) => x.length === 1)
	if (singleCharIdx !== -1) {
		parts[singleCharIdx] = parts[singleCharIdx][`to${parts.includes('Shift') ? 'Upper' : 'Lower'}Case`]()
	}

	return parts.join('+')
}

export function eventMatchesCombo<T extends [string, ...string[]]>(e: KbdEvent, ...combos: T): T[number] | null {
	const eventCombo = eventToCombo(e)
	return combos.find((combo) => eventCombo === normalizeCombo(combo)) ?? null
}

function keyToPretty(key: string) {
	const prettyFmtMap = new Map([
		['ArrowRight', '→'],
		['ArrowLeft', '←'],
		['ArrowUp', '↑'],
		['ArrowDown', '↓'],
		['Plus', '+'],
		['Control', platform.isApple ? 'Control' : 'Ctrl'],
		['Alt', platform.isApple ? '⌥' : 'Alt'], // mac = "option" key
		['Meta', platform.isApple ? '⌘' : '⊞'], // mac = "command" key; windows = "windows" key
	])

	return prettyFmtMap.get(recapitalize(key)) ?? (key.length === 1 ? key.toUpperCase() : key)
}

export function comboToPretty(combo: string) {
	return combo.split(PLUS_SPLITTER).map((x) => {
		const pretty = keyToPretty(x)
		return /[+-]/.test(pretty) ? `"${pretty}"` : pretty
	}).join('+')
}

export function comboToPrettyHtml(combo: string) {
	return `<kbd>${
		combo.split(PLUS_SPLITTER).map((x) => `<kbd>${escapeHtml(keyToPretty(x))}</kbd>`).join('<span>+</span>')
	}</kbd>`
}

export function eventToCombo(e: KbdEvent) {
	const modifierKeys = Object.keys(eventModifiers)
		.filter((k) => e[eventModifiers[k]])
		.map((x) => x.charAt(0).toUpperCase() + x.slice(1))

	const key = e.key.length > 1 ? e.key : e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase()

	return normalizeCombo([...modifierKeys, key].map((x) => normalized.has(x) ? normalized.get(x) : x).join('+'))
}
