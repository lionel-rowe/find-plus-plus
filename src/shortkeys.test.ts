import './types.d.ts'
import { assert, assertEquals, assertThrows } from '@std/assert'
import {
	comboToEventLike,
	comboToPretty,
	eventMatchesCombo,
	eventToCombo,
	type KbdEvent,
	platform,
} from './shortkeys.ts'
import { stubProperty } from '@std/testing/unstable-stub-property'

type Test = {
	combo: string
	event: Partial<KbdEvent>
	apple?: string
	windows?: string
	variants?: string[]
	isSoloModifier?: boolean
}

const tests: Test[] = [
	{
		event: { key: 'z' },
		combo: 'z',
		apple: 'Z',
		windows: 'Z',
		variants: ['Z'],
	},
	{
		event: { key: 'Tab' },
		combo: 'Tab',
		variants: ['tab', 'TAB'],
	},
	{
		event: { key: ' ' },
		combo: 'Space',
	},
	{
		event: { key: '+' },
		combo: 'Plus',
		apple: '"+"',
		windows: '"+"',
	},
	{
		event: { key: 'ArrowRight' },
		combo: 'ArrowRight',
		apple: '→',
		windows: '→',
		variants: ['arrowright', 'ARROWRIGHT'],
	},
	{
		event: { key: '-', shiftKey: true },
		combo: 'Shift+-',
		apple: 'Shift+"-"',
		windows: 'Shift+"-"',
	},
	{
		event: { key: 'z', ctrlKey: true },
		combo: 'Control+z',
		apple: 'Control+Z',
		windows: 'Ctrl+Z',
		variants: ['Ctrl+z', 'Ctrl+Z', 'Control+Z'],
	},
	{
		event: { key: ' ', ctrlKey: true },
		combo: 'Control+Space',
		apple: 'Control+Space',
		windows: 'Ctrl+Space',
		variants: ['space+ctrl'],
	},
	{
		event: { key: 'Z', ctrlKey: true, shiftKey: true },
		combo: 'Control+Shift+Z',
		apple: 'Control+Shift+Z',
		windows: 'Ctrl+Shift+Z',
		variants: ['Shift+Control+Z', 'Shift+Ctrl+Z', 'Ctrl+Shift+Z'],
	},
	{
		event: { key: 'Z', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true },
		combo: 'Control+Alt+Shift+Meta+Z',
		apple: 'Control+⌥+Shift+⌘+Z',
		windows: 'Ctrl+Alt+Shift+⊞+Z',
		variants: ['z+meta+shift+alt+control'],
	},
	{
		event: { key: 'Control', ctrlKey: true },
		combo: 'Control',
		windows: 'Ctrl',
		variants: ['ctrl'],
		isSoloModifier: true,
	},
	{
		event: { key: 'Control', ctrlKey: true, shiftKey: true },
		combo: 'Control+Shift',
		windows: 'Ctrl+Shift',
		variants: ['shift+CONTROL'],
		isSoloModifier: true,
	},
]

Deno.test(comboToPretty.name, async (t) => {
	for (const isApple of [true, false]) {
		using _ = stubProperty(platform, 'isApple', isApple)
		const platformName = isApple ? 'apple' : 'windows'

		await t.step(platformName, async (t) => {
			for (const test of tests) {
				const { combo } = test
				if (combo == null) continue
				const pretty = test[platformName] ?? combo
				await t.step(pretty, () => {
					assertEquals(comboToPretty(combo), pretty)
				})
			}
		})
	}
})

Deno.test(eventToCombo.name, async (t) => {
	for (const test of tests) {
		await t.step(test.combo ?? 'null', () => {
			assertEquals(eventToCombo(hydrateEvent(test.event)), test.combo)
		})
	}
})

Deno.test(eventMatchesCombo.name, async (t) => {
	for (const test of tests) {
		const event = hydrateEvent(test.event)
		await t.step(test.combo ?? 'null', () => {
			const { combo } = test
			assert(eventMatchesCombo(event, combo))
			assert(!eventMatchesCombo(event, 'Alt+Z'))
			if (test.isSoloModifier) {
				assertThrows(() => comboToEventLike(combo))
			} else {
				assertEquals(comboToEventLike(combo), event)
			}
		})
		for (const combo of test.variants ?? []) {
			await t.step(`${test.combo} ~= ${combo}`, () => {
				assert(eventMatchesCombo(event, combo))
				if (test.isSoloModifier) {
					assertThrows(() => comboToEventLike(combo))
				} else {
					assertEquals(comboToEventLike(combo), event)
				}
			})
		}
	}
})

function hydrateEvent(partial: Partial<KbdEvent>): KbdEvent {
	return {
		key: '',
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		...partial,
	}
}
