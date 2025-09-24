import type { Message } from './types.ts'

// const IS_DEV_MODE = !Object.hasOwn(chrome.runtime.getManifest(), 'update_url')
// if (IS_DEV_MODE) {
// 	chrome.tabs.onUpdated.addListener(async (id) => {
// 		const tab = await chrome.tabs.get(id)
// 		if (tab.url?.startsWith('http://localhost')) {
// 			chrome.runtime.reload()
// 		}
// 	})
// }

const openTabIds = new Set<number>()

chrome.runtime.onMessage.addListener(async (request) => {
	switch (request) {
		case 'showOptions': {
			chrome.runtime.openOptionsPage()
			break
		}
		case 'optionsUpdated': {
			await Promise.all([...openTabIds].map(async (tabId) => {
				const message: Message = { kind: 'optionsUpdated' }
				try {
					await chrome.tabs.sendMessage(tabId, message)
				} catch {
					openTabIds.delete(tabId)
				}
			}))
			break
		}
	}
})

// `onClicked` also fires when `_execute_action` shortcut key (default Ctrl+Shift+F) is pressed
chrome.action.onClicked.addListener((tab) => {
	if (tab?.id == null) return
	openTabIds.add(tab.id)
	const message: Message = { kind: 'command', command: '_execute_action' }
	chrome.tabs.sendMessage(tab.id, message)
})
