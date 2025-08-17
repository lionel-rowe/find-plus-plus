import { assert } from '@std/assert/assert'
import * as CONFIG from './config.ts'
import { CommandEvent, InitEvent, ReadyEvent } from './events.ts'
import { optionsStorage } from './storage.ts'
import type { Message } from './types.ts'
import { html } from './populateTemplate.ts'

const { defaultOptions, ...ids } = CONFIG
const { CUSTOM_ELEMENT_NAME } = ids

document.body.insertAdjacentHTML('beforeend', html)
const el = document.createElement(CUSTOM_ELEMENT_NAME)
el.hidden = true
document.body.append(el)

const script = document.createElement('script')
script.type = 'module'
script.src = chrome.runtime.getURL('/main.js')
document.body.append(script)

const options = await optionsStorage.get(defaultOptions)

document.addEventListener(ReadyEvent.TYPE, (e) => {
	assert(e instanceof ReadyEvent)
	document.dispatchEvent(new InitEvent({ options }))
}, { once: true })

chrome.runtime.onMessage.addListener((message: Message) => {
	document.dispatchEvent(new CommandEvent(message))
})

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		document.dispatchEvent(new CommandEvent({ command: 'close' }))
	}
})
