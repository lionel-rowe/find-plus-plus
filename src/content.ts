import { assert } from '@std/assert/assert'
import * as CONFIG from './config.ts'
import { InitEvent, ReadyEvent } from './events.ts'
import { optionsStorage } from './storage.ts'

const { defaultOptions, ...ids } = CONFIG
const { CUSTOM_ELEMENT_NAME } = ids

void (async () => {
	const res = await fetch(chrome.runtime.getURL('/template.html'))
	const template = await res.text()
	const config = {
		...ids,
		STYLES_URL: chrome.runtime.getURL('/styles.css'),
	}
	const html = template.replaceAll(/__(\w+)__/g, (_, key) => {
		const val = config[key as keyof typeof config]
		assert(typeof val === 'string', `${key} not found in CONFIG`)
		return val
	})

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
})()
