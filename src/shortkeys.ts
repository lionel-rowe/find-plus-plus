import { assert } from '@std/assert/assert'
import { escapeHtml, Expand } from './utils.ts'

export type KbdEvent = Expand<Pick<KeyboardEvent, 'key' | EventModifier>>

// https://superuser.com/questions/1238062/key-combination-order
const eventModifierKeys = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'] as const
type EventModifier = typeof eventModifierKeys[number]

type LooseShortkeyConfig = string | {
	normalized: string
	key?: string
	pretty?: string | { apple: string; windows: string }
	modifierKey?: EventModifier
}
type ShortkeyConfig = {
	normalized: string
	key: string
	pretty: { apple: string; windows: string }
	modifierKey: EventModifier | null
}

function hydrateShortkeyConfig(c: LooseShortkeyConfig): ShortkeyConfig {
	if (typeof c === 'string') {
		if (c.length === 1 && c === c.toLowerCase()) {
			c = c.toUpperCase()
		}
		return { normalized: c, key: c, pretty: { apple: c, windows: c }, modifierKey: null }
	}
	return {
		normalized: c.normalized,
		key: c.key ?? c.normalized,
		pretty: typeof c.pretty === 'string'
			? { apple: c.pretty, windows: c.pretty }
			: (c.pretty ?? { apple: c.normalized, windows: c.normalized }),
		modifierKey: c.modifierKey ?? null,
	}
}

export const shortkeyConfigs: ShortkeyConfig[] = ([
	{ normalized: 'Control', pretty: { apple: 'Control', windows: 'Ctrl' }, modifierKey: 'ctrlKey' },
	// "Option" key on Mac and "Alt" key on Windows
	{ normalized: 'Alt', pretty: { apple: '⌥', windows: 'Alt' }, modifierKey: 'altKey' },
	{ normalized: 'Shift', pretty: 'Shift', modifierKey: 'shiftKey' },
	// "Meta" is the standard name for the "Windows" key on Windows and "Command" key on Mac
	{ normalized: 'Meta', pretty: { apple: '⌘', windows: '⊞' }, modifierKey: 'metaKey' },

	{ normalized: 'Space', key: ' ', pretty: 'Space' },
	{ normalized: 'Plus', key: '+', pretty: '+' },

	{ normalized: 'ArrowRight', pretty: '→' },
	{ normalized: 'ArrowLeft', pretty: '←' },
	{ normalized: 'ArrowUp', pretty: '↑' },
	{ normalized: 'ArrowDown', pretty: '↓' },

	'PageUp',
	'PageDown',
	'CapsLock',
	'NumLock',
	'ScrollLock',
	'PrintScreen',

	'Backspace',
	'Tab',
	'Enter',
	'Pause',
	'Escape',
	'End',
	'Home',
	'Insert',
	'Delete',

	'AltGraph',

	...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
] as const).map(hydrateShortkeyConfig)

for (const x of eventModifierKeys) {
	assert(shortkeyConfigs.some((c) => c.modifierKey === x), `missing shortkey config for event modifier key: ${x}`)
}

class KeyNormalizedMap<V> extends Map<string, V> {
	#normalizer: (key: string) => string
	constructor(normalizer: (key: string) => string, entries: readonly (readonly [string, V])[]) {
		super()
		this.#normalizer = normalizer
		for (const [k, v] of entries) this.set(k, v)
	}
	override get(key: string) {
		return super.get(this.#normalizer(key))
	}
	override has(key: string) {
		return super.has(this.#normalizer(key))
	}
	override set(key: string, value: V) {
		return super.set(this.#normalizer(key), value)
	}
}

const mapping = new KeyNormalizedMap(
	(key) => key.toLowerCase(),
	shortkeyConfigs.flatMap((x) => {
		return [
			x.normalized,
			x.key,
			x.modifierKey,
			x.pretty.apple,
			x.pretty.windows,
		].filter((v) => v != null)
			.map((k) => [k, x])
	}),
)

const normalizedEventModifiers = eventModifierKeys.map((x) => mapping.get(x)!.normalized)

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

function normalizeKey(key: string) {
	const cased = mapping.get(key)?.normalized
	if (cased != null) return cased
	return recapitalizeSingleKey(key, true) ?? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
}

function recapitalizeSingleKey(key: string, shift: boolean) {
	return key.length > 1 ? null : shift ? key.toUpperCase() : key.toLowerCase()
}

function indexOrMax(arr: string[], val: string) {
	const idx = arr.indexOf(val)
	return idx === -1 ? arr.length : idx
}

const PLUS_SPLITTER = /(?<!\+)\+|(?<=\+\+)\+/

export function comboToParts(combo: string) {
	if (!combo) return []

	const parts = [
		...new Set(
			combo.split(PLUS_SPLITTER).map((x) => {
				x = normalizeKey(x)
				return mapping.get(x)?.normalized ?? x
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

	return parts
}

export function eventMatchesCombo<T extends [string, ...string[]]>(e: KbdEvent, ...combos: T): T[number] | null {
	const eventCombo = eventToCombo(e)
	return combos.find((combo) => eventCombo === comboToParts(combo).join('+')) ?? null
}

function keyToPretty(key: string) {
	return mapping.get(key)?.pretty?.[platform.isApple ? 'apple' : 'windows'] ??
		normalizeKey(key)
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
	const modifierKeys = eventModifierKeys
		.filter((k) => e[k])
		.map((x) => mapping.get(x)!.normalized)

	return comboToParts([...modifierKeys, e.key].map((x) => mapping.get(x)?.normalized ?? x).join('+')).join('+')
}

/**
 * Convert a combo string (e.g. "Control+Shift+A") to an object that resembles a KeyboardEvent.
 * @param combo The combo string to convert.
 * @returns An object resembling a KeyboardEvent.
 * @throws {Error} If the combo is invalid (e.g., has duplicate keys or missing a non-modifier key).
 */
export function comboToEventLike(combo: string): KbdEvent {
	const parts = combo.split(PLUS_SPLITTER)
		.map((x) => mapping.get(x) ?? hydrateShortkeyConfig(normalizeKey(x)))
	assert(parts.length > 0, 'invalid combo')
	assert(new Set(parts).size === parts.length, 'duplicate keys in combo')
	const { modifier: _modifiers = [], normal = [] } = Object.groupBy(
		parts,
		(x) => x.modifierKey == null ? 'normal' : 'modifier',
	)
	assert(normal?.length === 1, 'combo must have exactly one non-modifier key')

	const modifiers = new Set(_modifiers.map((x) => x.modifierKey!))

	return {
		key: recapitalizeSingleKey(normal[0]!.key, modifiers.has('shiftKey')) ?? normal[0]!.key,
		...Object.fromEntries(eventModifierKeys.map((k) => [k, modifiers.has(k)])) as Record<EventModifier, boolean>,
	}
}
