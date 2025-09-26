import puppeteer from 'puppeteer'
import { comboToParts, shortkeyConfigs } from '../src/shortkeys.ts'
import { assert } from '@std/assert/assert'
import { delay } from '@std/async/delay'

export async function keyChord(page: puppeteer.Page, combo: string | readonly string[]) {
	const keys = typeof combo === 'string' ? comboToParts(combo) : combo
	const stack: puppeteer.KeyInput[] = keys.map((x) => {
		assert(isKeyInput(x))
		return x
	})

	for (const key of stack) await page.keyboard.down(key)
	while (stack.length) await page.keyboard.up(stack.pop()!)
	await delay(100)
}

const asciis = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
const keys = new Set([...shortkeyConfigs.map((x) => x.key), ...asciis])

export function isKeyInput(x: string): x is puppeteer.KeyInput {
	return keys.has(x)
}
