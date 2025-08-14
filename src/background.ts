import { unreachable } from '@std/assert/unreachable'

// const IS_DEV_MODE = !Object.hasOwn(chrome.runtime.getManifest(), 'update_url')

// if (IS_DEV_MODE) {
// 	chrome.tabs.onUpdated.addListener(async (id) => {
// 		const tab = await chrome.tabs.get(id)
// 		if (tab.url?.startsWith('http://localhost')) {
// 			chrome.runtime.reload()
// 		}
// 	})
// }

chrome.runtime.onMessage.addListener(async (message, sender) => {
	switch (message.action) {
		case 'INIT': {
			const id = sender.tab?.id
			if (id == null) return

			await chrome.scripting.executeScript({
				target: { tabId: id },
				files: ['./main.js'],
				world: 'MAIN',
			})
			break
		}
		default:
			unreachable()
	}
})
