import { assertEquals } from '@std/assert/equals'
import { delay } from '@std/async/delay'
import type { Resources } from './getResources.ts'
import type { Flag } from '../src/types.ts'
import { keyChord } from './puppeteerUtils.ts'

type Match = { text: string; parent: string }

type SuccessResult = {
	kind: 'success'
	matches: [Match, ...Match[]]
}
type EmptyResult = {
	kind: 'empty'
}
type ErrorResult = {
	kind: 'error'
	error: string
}
type Result = SuccessResult | EmptyResult | ErrorResult
export type TestCase = {
	input: string | RegExp
	flags: Flag[]
	expect: Result
}

export function runTestCase(resources: Resources) {
	const { page, options, config } = resources
	return async (testCase: TestCase) => {
		const { input, flags, expect } = testCase

		await using stack = new AsyncDisposableStack()
		stack.defer(async () => {
			// reset flags
			for (const flag of flags) {
				await keyChord(page, options.flags[flag].shortkey)
				await delay(100)
			}
			// clear input
			await keyChord(page, 'Ctrl+A')
			await keyChord(page, 'Backspace')
		})

		for (const flag of flags) {
			await keyChord(page, options.flags[flag].shortkey)
			await delay(100)
		}

		await page.keyboard.type(input.toString(), { delay: 100 })

		await delay(500)

		const result = await page.evaluate((config) => {
			try {
				const all = CSS.highlights.get(config.HIGHLIGHT_ALL_ID)
				const current = CSS.highlights.get(config.HIGHLIGHT_CURRENT_ID)

				if (all == null || current == null) return { kind: 'empty' as const }

				const serialize = (x: AbstractRange) => {
					if (!(x instanceof Range)) throw new Error('Not a Range')
					const { commonAncestorContainer } = x
					const container = commonAncestorContainer instanceof Element
						? commonAncestorContainer
						: commonAncestorContainer.parentElement
					if (!(container instanceof HTMLElement)) throw new Error('Not an HTMLElement')
					return {
						text: x.toString(),
						parent: container.dataset.testId ?? '',
					}
				}

				const result = {
					kind: 'success' as const,
					all: [...all].map(serialize),
					current: [...current].map(serialize),
				}

				return result
			} catch (e) {
				return {
					kind: 'error' as const,
					error: (e instanceof Error) ? e.message : String(e),
				}
			}
		}, config)

		function assertKind<
			R extends {
				kind: Result['kind']
			},
			E extends Result['kind'],
		>(result: R, expected: E): asserts result is R & { kind: E } {
			assertEquals(result.kind, expected, `Expected kind ${expected}, but ${result.kind} found`)
		}

		if (result.kind === 'error' && expect.kind !== 'error') {
			throw new Error(`Error in page evaluation: ${result.error}`)
		}

		switch (expect.kind) {
			case 'empty': {
				assertKind(result, expect.kind)
				break
			}
			case 'success': {
				assertKind(result, expect.kind)
				const { all, current } = result

				assertEquals(all, expect.matches, '`all` highlights do not match expected')
				assertEquals(current, [expect.matches[0]], '`current` highlight does not match expected')
				break
			}
			case 'error': {
				assertKind(result, expect.kind)
				break
			}
		}

		if (result.kind === 'error') {
			throw new Error(`Error in page evaluation: ${result.error}`)
		}
	}
}
