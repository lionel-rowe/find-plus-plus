import { escapeHtml } from './utils.ts'

declare global {
	interface Navigator {
		userAgentData?: {
			platform: string
		}
	}
}

const isMac = /^Mac/i.test(navigator.userAgentData?.platform ?? navigator.platform)

export const defaultComboModifier = isMac ? 'Meta' : 'Control'

const prettyFmtMap = new Map([
	['ArrowRight', '→'],
	['ArrowLeft', '←'],
	['ArrowUp', '↑'],
	['ArrowDown', '↓'],
	['Plus', '+'],
	['Control', isMac ? 'Control' : 'Ctrl'],
	['Alt', isMac ? '⌥' : 'Alt'], // mac = "option" key
	['Meta', isMac ? '⌘' : 'Meta'], // mac = "command" key
])
const normalized = new Map([
	[' ', 'Space'],
	['+', 'Plus'],
	['Ctrl', 'Control'],
])

export function eventMatchesCombo(e: KeyboardEvent, combo: string) {
	const eventCombo = eventToCombo(e)
	return eventCombo && (eventCombo === combo)
}

const eventModifiers = Object.fromEntries((['ctrl', 'alt', 'shift', 'meta'] as const)
	.map((k) => [k, `${k}Key` as const]))

export function comboToAriaKeyShortcut(combo: string) {
	return combo.replace('Ctrl', 'Control')
}

function keyToPretty(key: string) {
	return prettyFmtMap.get(key) ?? (key.length === 1 ? key.toUpperCase() : key)
}
export function comboToPretty(combo: string) {
	return combo.split('+').map(keyToPretty).join('+')
}

export function comboToPrettyHtml(combo: string) {
	return combo.split('+').map((x) => `<kbd>${escapeHtml(keyToPretty(x))}</kbd>`).join('<span>+</span>')
}

export function eventToCombo(e: Pick<KeyboardEvent, 'key' | typeof eventModifiers[keyof typeof eventModifiers]>) {
	const modifierKeys = Object.keys(eventModifiers)
		.filter((k) => e[eventModifiers[k]])
		.map((x) => x.charAt(0).toUpperCase() + x.slice(1))

	if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
	const key = e.key.length > 1 ? e.key : e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase()

	return [...modifierKeys, key].map((x) => normalized.has(x) ? normalized.get(x) : x).join('+')
}
