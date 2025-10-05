import * as CONFIG from './config.ts'
import {
	CommandEvent,
	NotifyReadyEvent,
	OpenOptionsPageEvent,
	PuppeteerTestEvent,
	UpdateOptionsEvent,
} from './events.ts'
import { optionsStorage } from './storage.ts'
import type { Message } from './types.ts'
import { getHtml } from './populateTemplate.ts'
import { waitForElement } from './waitForElement.ts'
import { WORKER_RUNNER_ID } from './config.ts'
import { assert } from '@std/assert/assert'

const { defaultOptions, ...ids } = CONFIG
const { CUSTOM_ELEMENT_NAME } = ids

const ready = Object.assign(Promise.withResolvers<void>(), { initialized: false, finalized: false })

const isIframe = window !== window.top

if (isIframe) {
	setupIframe()
} else {
	setupMain()
}

document.addEventListener(PuppeteerTestEvent.TYPE, async () => {
	await handleMessage({
		kind: 'command',
		command: '_execute_action',
		isTest: true,
	})
})

function setupMain() {
	chrome.runtime.onMessage.addListener(handleMessage)
	document.addEventListener(OpenOptionsPageEvent.TYPE, (e) => {
		assert(e instanceof OpenOptionsPageEvent)
		chrome.runtime.sendMessage('showOptions')
	})
}

function setupIframe() {
	// TODO: setup iframe logic
}

async function handleMessage(message: Message) {
	if (!ready.finalized && (message.kind !== 'command' || message.command !== '_execute_action')) return

	switch (message.kind) {
		case 'command': {
			if (!ready.initialized && message.command === '_execute_action') {
				// set true before awaiting anything to ensure `initialize` only run once
				ready.initialized = true

				// On legacy sites, `document.body` can also be a `<frameset>` 😲
				// https://stackoverflow.com/questions/35297274/why-is-document-body-not-a-htmlbodyelement
				const [root, html] = await Promise.all([waitForElement(() => document.body), getHtml()])
				await initialize(root, html)
				ready.resolve()
				ready.finalized = true
			}

			document.dispatchEvent(new CommandEvent(message))

			break
		}
		case 'optionsUpdated': {
			const options = await optionsStorage.get(defaultOptions)
			document.dispatchEvent(new UpdateOptionsEvent({ options }))

			break
		}
	}
}

async function initialize(root: Element, html: string) {
	root.insertAdjacentHTML('beforeend', html)
	const el = document.createElement(CUSTOM_ELEMENT_NAME)
	el.hidden = true
	root.append(el)

	const iframe = document.createElement('iframe')
	iframe.src = chrome.runtime.getURL('/worker-runner.html')
	iframe.id = WORKER_RUNNER_ID
	iframe.hidden = true

	const script = document.createElement('script')
	// script.type = 'module'
	script.src = chrome.runtime.getURL('/main.js')

	const [options] = await Promise.all([
		optionsStorage.get(defaultOptions),
		new Promise<void>((res) =>
			document.addEventListener(NotifyReadyEvent.TYPE, (e) => {
				assert(e instanceof NotifyReadyEvent)
				assert(e.detail.source === 'main')
				res()
			}, { once: true })
		),
		root.append(script, iframe),
	])

	document.dispatchEvent(new UpdateOptionsEvent({ options }))
}
