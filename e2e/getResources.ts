import { delay } from '@std/async/delay'
import puppeteer from 'puppeteer'
import { serveDemo } from '../scripts/serveDemo.ts'

async function keyChord(page: puppeteer.Page, keys: readonly puppeteer.KeyInput[]) {
	const stack: puppeteer.KeyInput[] = [...keys]
	for (const key of stack) {
		console.log('key down', key)
		await delay(100)
		await page.keyboard.down(key)
	}
	while (stack.length) {
		console.log('key up', stack[stack.length - 1])
		await delay(100)
		await page.keyboard.up(stack.pop()!)
	}
}

export async function getResources() {
	const server = serveDemo()
	// server.unref()
	const demoUrl = new URL(
		`http://${server.addr.hostname}:${server.addr.port}`,
	)

	const width = 1000
	const height = 600
	const browser = await puppeteer.launch({
		pipe: true,
		args: ['--no-sandbox', `--window-size=${width},${height}`, '--enable-unsafe-extension-debugging'],
		headless: false,
		defaultViewport: null,
		enableExtensions: true,
	})

	const extensionId = await browser.installExtension('./dist')

	const page = (await browser.pages())[0]!
	await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
	await Promise.all([
		page.waitForNavigation(),
		page.goto(demoUrl.href),
	])
	// await page.click('body') // focus page

	await page.bringToFront()

	return { browser, page, server, extensionId }
}
