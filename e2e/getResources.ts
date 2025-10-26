import { _prefix } from '../src/_prefix.ts'
import puppeteer from 'puppeteer'
import { serveDemo } from '../scripts/serveDemo.ts'
import { comboToEventLike } from '../src/shortkeys.ts'
import manifest from '../dist/manifest.json' with { type: 'json' }

export type Resources = Awaited<ReturnType<typeof getResources>>

export async function getResources() {
	const server = serveDemo()

	const demoUrl = new URL(`http://${server.addr.hostname}:${server.addr.port}`)
	demoUrl.searchParams.set('e2e', '1')

	const width = 1000
	const height = 600
	const browser = await puppeteer.launch({
		pipe: true,
		args: ['--no-sandbox', `--window-size=${width},${height}`, '--enable-unsafe-extension-debugging'],
		headless: false,
		defaultViewport: null,
		enableExtensions: true,
	})

	const cleanup = async () => {
		await Promise.all([
			browser.close(),
			server.shutdown(),
		])
	}

	browser.on('disconnected', cleanup)

	const extensionId = await browser.installExtension('./dist')
	// deno-lint-ignore no-explicit-any
	void ((globalThis as any).APP_NS = _prefix + extensionId)
	const { InitTestEvent } = await import('../src/events.ts')
	const config = await import('../src/config.ts')
	const { defaultOptions } = config

	const page = (await browser.pages())[0]!
	await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
	await Promise.all([
		page.waitForNavigation(),
		page.goto(demoUrl.href),
	])

	await page.bringToFront()

	const openCombo = manifest.commands._execute_action.suggested_key.default
	const openEvent = comboToEventLike(openCombo)

	await page.evaluate(
		(type, openEvent) => {
			// extension commands don't seem to work natively in puppeteer, so we simulate one
			window.addEventListener('keydown', (e) => {
				if (Object.entries(openEvent).every(([k, v]) => e[k as keyof typeof openEvent] === v)) {
					e.preventDefault()
					document.dispatchEvent(new CustomEvent(type))
				}
			})
		},
		InitTestEvent.TYPE,
		openEvent,
	)

	return {
		browser,
		page,
		server,
		extensionId,
		options: defaultOptions,
		config,
		manifest,

		[Symbol.asyncDispose]: cleanup,
	}
}
