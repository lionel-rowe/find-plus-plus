import { assert } from '@std/assert/assert'
import * as CONFIG from '../src/config.ts'
import { initEvent, readyEvent } from './events.ts'
import { optionsStorage } from './storage.ts'

const { defaultOptions, CUSTOM_ELEMENT_NAME } = CONFIG

void (async () => {
	const res = await fetch(chrome.runtime.getURL('/template.html'))
	const template = await res.text()
	const html = template.replaceAll(/__(\w+)__/g, (_, key) => {
		const val = CONFIG[key as keyof typeof CONFIG]
		assert(typeof val === 'string', `${key} not found in CONFIG`)
		return val
	})

	document.body.insertAdjacentHTML('beforeend', html)
	const el = document.createElement(CUSTOM_ELEMENT_NAME)
	el.hidden = true
	document.body.append(el)

	chrome.runtime.sendMessage({ action: 'INIT' })

	const options = await optionsStorage.get(defaultOptions)

	document.addEventListener(readyEvent.type, (e) => {
		assert(readyEvent.checkType(e))
		document.dispatchEvent(initEvent.create({ options }))
	}, { once: true })
})()
