import { assert } from '@std/assert/assert'
import * as CONFIG from './config.ts'
const { defaultOptions: _, ...ids } = CONFIG

const template = await (await fetch(chrome.runtime.getURL('/template.html'))).text()
const config = {
	...ids,
	STYLES_URL: chrome.runtime.getURL('/styles.css'),
}
export const html = template.replaceAll(/__(\w+)__/g, (_, key) => {
	const val = config[key as keyof typeof config]
	assert(typeof val === 'string', `${key} not found in CONFIG`)
	return val
})
