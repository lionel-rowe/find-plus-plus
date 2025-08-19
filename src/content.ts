import * as CONFIG from './config.ts'
import { CloseEvent, CommandEvent, NotifyReadyEvent, UpdateOptionsEvent } from './events.ts'
import { optionsStorage } from './storage.ts'
import type { Message } from './types.ts'
import { getHtml } from './populateTemplate.ts'
import { waitForElement } from './waitForElement.ts'

const { defaultOptions, ...ids } = CONFIG
const { CUSTOM_ELEMENT_NAME } = ids

const ready = Object.assign(Promise.withResolvers<void>(), { initialized: false })

chrome.runtime.onMessage.addListener(async (message: Message) => {
	if (!ready.initialized && message.command === 'open') {
		// set true before awaiting anything to ensure `initialize` only run once
		ready.initialized = true

		// On legacy sites, `document.body` can also be a `<frameset>` 😲
		// https://stackoverflow.com/questions/35297274/why-is-document-body-not-a-htmlbodyelement
		const [root, html] = await Promise.all([waitForElement('body, frameset'), getHtml()])
		await initialize(root, html)
		ready.resolve()
	}

	await ready.promise

	document.dispatchEvent(new CommandEvent(message))
})

// plain `Escape` can't be handled by `chrome.commands` as commands must include Ctrl or Alt
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		document.dispatchEvent(new CloseEvent())
	}
})

async function initialize(root: Element, html: string) {
	root.insertAdjacentHTML('beforeend', html)
	const el = document.createElement(CUSTOM_ELEMENT_NAME)
	el.hidden = true
	root.append(el)

	const script = document.createElement('script')
	script.type = 'module'
	script.src = chrome.runtime.getURL('/main.js')
	root.append(script)

	await new Promise((res) => document.addEventListener(NotifyReadyEvent.TYPE, res, { once: true }))

	const options = await optionsStorage.get(defaultOptions)
	document.dispatchEvent(new UpdateOptionsEvent({ options }))
}
