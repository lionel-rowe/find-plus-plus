import { escapeHtml } from './utils.ts'

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

export function eventMatchesCombo(e: KbdEvent, combo: string) {
	const eventCombo = eventToCombo(e)
	return eventCombo && (eventCombo === combo)
}

// https://superuser.com/questions/1238062/key-combination-order
const eventModifiers = Object.fromEntries((['ctrl', 'alt', 'shift', 'meta'] as const)
	.map((k) => [k, `${k}Key` as const]))

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

	return prettyFmtMap.get(key) ?? (key.length === 1 ? key.toUpperCase() : key)
}
export function comboToPretty(combo: string) {
	return combo.split('+').map((x) => {
		const pretty = keyToPretty(x)
		return /[+-]/.test(pretty) ? `"${pretty}"` : pretty
	}).join('+')
}

export function comboToPrettyHtml(combo: string) {
	return combo.split('+').map((x) => `<kbd>${escapeHtml(keyToPretty(x))}</kbd>`).join('<span>+</span>')
}

export function eventToCombo(e: KbdEvent) {
	const modifierKeys = Object.keys(eventModifiers)
		.filter((k) => e[eventModifiers[k]])
		.map((x) => x.charAt(0).toUpperCase() + x.slice(1))

	if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
	const key = e.key.length > 1 ? e.key : e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase()

	return [...modifierKeys, key].map((x) => normalized.has(x) ? normalized.get(x) : x).join('+')
}
