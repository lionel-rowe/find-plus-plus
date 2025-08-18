import * as CONFIG from './config.ts'
import { CommandEvent, NotifyReadyEvent, UpdateOptionsEvent } from './events.ts'
import { optionsStorage } from './storage.ts'
import type { Message } from './types.ts'
import { html } from './populateTemplate.ts'

const { defaultOptions, ...ids } = CONFIG
const { CUSTOM_ELEMENT_NAME } = ids

const ready = Object.assign(Promise.withResolvers<void>(), { initialized: false })

chrome.runtime.onMessage.addListener(async (message: Message) => {
	if (!ready.initialized && message.command === 'open') {
		// set true before awaiting to ensure `initialize` only run once
		ready.initialized = true
		await initialize()
		ready.resolve()
	}

	await ready.promise

	document.dispatchEvent(new CommandEvent(message))
})

// plain `Escape` can't be handled by `chrome.commands` as commands must include Ctrl or Alt
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		document.dispatchEvent(new CommandEvent({ command: 'close' }))
	}
})

async function initialize() {
	document.body.insertAdjacentHTML('beforeend', html)
	const el = document.createElement(CUSTOM_ELEMENT_NAME)
	el.hidden = true
	document.body.append(el)

	const script = document.createElement('script')
	script.type = 'module'
	script.src = chrome.runtime.getURL('/main.js')
	document.body.append(script)

	await new Promise((res) => document.addEventListener(NotifyReadyEvent.TYPE, res, { once: true }))

	const options = await optionsStorage.get(defaultOptions)
	document.dispatchEvent(new UpdateOptionsEvent({ options }))
}
