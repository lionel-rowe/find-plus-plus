import type { Command, Message, ShortkeyConfig } from './types.ts'

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

chrome.commands.onCommand.addListener(async (_command, tab) => {
	const command = _command as Command
	if (tab?.id == null) return
	openTabIds.add(tab.id)
	const shortkeys = await getShortkeys()
	const message: Message = { kind: 'command', command, shortkeys }

	chrome.tabs.sendMessage(tab.id, message)
})

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

chrome.action.onClicked.addListener(async (tab) => {
	if (tab?.id == null) return
	const shortkeys = await getShortkeys()
	const message: Message = { kind: 'command', command: 'open', shortkeys }
	chrome.tabs.sendMessage(tab.id, message)
})

async function getShortkeys() {
	const commands = await chrome.commands.getAll()
	return Object.fromEntries(
		commands.map(({ name, shortcut, description }) => [name, { combo: shortcut, description }]),
	) as ShortkeyConfig
}
