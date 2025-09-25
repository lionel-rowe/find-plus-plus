import { delay } from '@std/async/delay'
import puppeteer from 'puppeteer'
import { getResources } from './getResources.ts'
import { _prefix } from '../src/_prefix.ts'

async function keyChord(page: puppeteer.Page, keys: readonly puppeteer.KeyInput[]) {
	const stack: puppeteer.KeyInput[] = [...keys]
	for (const key of stack) {
		await delay(100)
		await page.keyboard.down(key)
	}
	while (stack.length) {
		await delay(100)
		await page.keyboard.up(stack.pop()!)
	}
}

const { browser, page, server, extensionId } = await getResources()
// deno-lint-ignore no-explicit-any
void ((globalThis as any).APP_NS = _prefix + extensionId)
const { PuppeteerTestEvent } = await import('../src/events.ts')

await page.evaluate((type) => {
	// extension commands don't seem to work natively in puppeteer, so we simulate one
	window.addEventListener('keydown', (e) => {
		if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
			document.dispatchEvent(new CustomEvent(type))
		}
	})
}, PuppeteerTestEvent.TYPE)

const MS = 3000
await keyChord(page, ['Control', 'Shift', 'F'])
await delay(MS)
await keyChord(page, ['Alt', 'C'])
await delay(MS)
await keyChord(page, ['Escape'])
await delay(MS)
// console.log('keyChord done')
const disconnected = new Promise<void>((res) => {
	browser.on('disconnected', res)
})

await Promise.race([
	disconnected,
	delay(Infinity),
])

server.shutdown()
Deno.exit(0)

// Deno.test('a', () => {

// 	// await delay(Infinity)

// 	// await browser.close()
// })

// async function testPageLoad() {

// 	// await delay(Infinity)

// 	// await browser.close()
// }

// testPageLoad()
