import '../src/types.d.ts'
import { getResources } from './getResources.ts'
import { delay } from '@std/async/delay'
import { keyChord } from './puppeteerUtils.ts'
import { runTestCase } from './runTestCase.ts'
import dedent from 'string-dedent'

Deno.test('e2e', async (t) => {
	await using resources = await getResources()
	const { page, manifest, options } = resources
	const runCase = runTestCase(resources)

	await delay(100)

	await keyChord(page, manifest.commands._execute_action.suggested_key.default)
	await delay(100)
	for (const flag of Object.values(options.flags)) {
		// reset all flags to false
		if (flag.default) await keyChord(page, flag.shortkey)
		await delay(100)
	}

	await delay(1000)

	await t.step('basic', async () => {
		await runCase({
			input: 'sample paragraph',
			flags: [],
			expect: {
				kind: 'success',
				matches: [
					{ text: 'sample paragraph', parent: 'sample' },
				],
			},
		})
	})

	await t.step('white space handling', async () => {
		const text = dedent`
			one two three
			four

			flex item\\tflex item 2
			table cell 1\\ttable cell 2
			split text data
			a b
			a
			b
			end
		`
		await runCase({
			input: text,
			flags: ['useRegex'],
			expect: {
				kind: 'success',
				matches: [
					{ text, parent: 'white-space' },
				],
			},
		})
	})

	await t.step('multiline ^$ handling', async () => {
		const input = /^one two three$/.source
		await runCase({
			input,
			flags: ['useRegex'],
			expect: {
				kind: 'success',
				matches: [
					{ text: 'one two three', parent: 'white-space' },
				],
			},
		})
	})

	// ^one two three$

	await t.step('match across element boundaries', async () => {
		await runCase({
			input: 'foobar',
			flags: [],
			expect: {
				kind: 'success',
				matches: [
					{ text: 'foobar', parent: 'element-boundary' },
				],
			},
		})
	})

	await t.step('flags', async (t) => {
		await t.step('matchCase', async (t) => {
			const input = 'Sensitive'
			await t.step('true', async () => {
				await runCase({
					input,
					flags: ['matchCase'],
					expect: {
						kind: 'success',
						matches: [
							{ text: 'Sensitive', parent: 'case-sensitive' },
						],
					},
				})
			})
			await t.step('false', async () => {
				await runCase({
					input,
					flags: [],
					expect: {
						kind: 'success',
						matches: [
							{ text: 'Sensitive', parent: 'case-sensitive' },
							{ text: 'SENSITIVE', parent: 'case-sensitive' },
							{ text: 'sensitive', parent: 'case-sensitive' },
						],
					},
				})
			})
		})

		await t.step('wholeWord', async (t) => {
			const input = 'function'
			await t.step('true', async () => {
				await runCase({
					input,
					flags: ['wholeWord'],
					expect: {
						kind: 'empty',
					},
				})
			})
			await t.step('false', async () => {
				await runCase({
					input,
					flags: [],
					expect: {
						kind: 'success',
						matches: [
							// "functionality"
							{ text: 'function', parent: 'sample' },
						],
					},
				})
			})
		})

		await t.step('useRegex', async (t) => {
			const input = 'foo.bar'
			await t.step('true', async () => {
				await runCase({
					input,
					flags: ['useRegex'],
					expect: {
						kind: 'success',
						matches: [
							{ text: 'foo bar', parent: 'regex-syntax' },
							{ text: 'foo.bar', parent: 'regex-syntax' },
						],
					},
				})
			})
			await t.step('false', async () => {
				await runCase({
					input,
					flags: [],
					expect: {
						kind: 'success',
						matches: [
							{ text: 'foo.bar', parent: 'regex-syntax' },
						],
					},
				})
			})
		})

		await t.step('normalizeDiacritics', async (t) => {
			const input = 'chuong'
			await t.step('true', async () => {
				await runCase({
					input,
					flags: ['normalizeDiacritics'],
					expect: {
						kind: 'success',
						matches: [
							{ text: 'chương'.normalize('NFC'), parent: 'nfc' },
							{ text: 'chương'.normalize('NFD'), parent: 'nfd' },
						],
					},
				})
			})
			await t.step('false', async () => {
				await runCase({
					input,
					flags: [],
					expect: {
						kind: 'empty',
					},
				})
			})
		})
	})

	await t.step('hidden', async () => {
		await runCase({
			input: /searchable\d/.source,
			flags: ['useRegex'],
			expect: {
				kind: 'success',
				matches: [
					{ text: 'searchable0', parent: 'searchable0' },
				],
			},
		})
	})
})
