import * as CONFIG from './config.ts'
import { CloseEvent, CommandEvent, NotifyReadyEvent, OpenOptionsPageEvent, UpdateOptionsEvent } from './events.ts'
import { optionsStorage } from './storage.ts'
import type { Message } from './types.ts'
import { getHtml } from './populateTemplate.ts'
import { waitForElement } from './waitForElement.ts'
import { WORKER_RUNNER_ID } from './config.ts'
import { assert } from '@std/assert/assert'

const { defaultOptions, ...ids } = CONFIG
const { CUSTOM_ELEMENT_NAME } = ids

const ready = Object.assign(Promise.withResolvers<void>(), { initialized: false, finalized: false })

chrome.runtime.onMessage.addListener(handle)

async function handle(message: Message) {
	if (!ready.finalized && message.command !== 'open') return

	if (!ready.initialized && message.command === 'open') {
		// set true before awaiting anything to ensure `initialize` only run once
		ready.initialized = true

		// On legacy sites, `document.body` can also be a `<frameset>` 😲
		// https://stackoverflow.com/questions/35297274/why-is-document-body-not-a-htmlbodyelement
		const [root, html] = await Promise.all([waitForElement('body, frameset'), getHtml()])
		await initialize(root, html)
		ready.resolve()
		ready.finalized = true
	}

	await ready.promise

	document.dispatchEvent(new CommandEvent(message))
}

// plain `Escape` can't be handled by `chrome.commands` as commands must include Ctrl or Alt
document.addEventListener('keydown', (e) => {
	if (!ready.finalized) return

	if (e.key === 'Escape') {
		document.dispatchEvent(new CloseEvent())
	}
})

async function initialize(root: Element, html: string) {
	root.insertAdjacentHTML('beforeend', html)
	const el = document.createElement(CUSTOM_ELEMENT_NAME)
	el.hidden = true
	root.append(el)

	const iframe = document.createElement('iframe')
	iframe.src = chrome.runtime.getURL('/worker-runner.html')
	iframe.id = WORKER_RUNNER_ID
	iframe.hidden = true
	const ac = new AbortController()
	await Promise.all([
		new Promise<void>((res) =>
			globalThis.addEventListener('message', (e) => {
				if (e.source === iframe.contentWindow && e.data.kind === NotifyReadyEvent.TYPE) {
					res()
					ac.abort()
				}
			}, { signal: ac.signal })
		),
		root.append(iframe),
	])

	const script = document.createElement('script')
	// script.type = 'module'
	script.src = chrome.runtime.getURL('/main.js')
	root.append(script)
	await new Promise<void>((res) =>
		document.addEventListener(NotifyReadyEvent.TYPE, (e) => {
			assert(e instanceof NotifyReadyEvent)
			assert(e.detail.source === 'main')
			res()
		}, { once: true })
	)

	const options = await optionsStorage.get(defaultOptions)
	// TODO: update options every time they're changed, not just on init
	document.dispatchEvent(new UpdateOptionsEvent({ options }))
}

document.addEventListener(OpenOptionsPageEvent.TYPE, (e) => {
	assert(e instanceof OpenOptionsPageEvent)
	chrome.runtime.sendMessage('showOptions')
})
