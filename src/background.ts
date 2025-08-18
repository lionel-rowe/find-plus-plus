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

chrome.commands.onCommand.addListener(async (_command, tab) => {
	const command = _command as Command
	if (tab?.id == null) return
	const commands = await chrome.commands.getAll()
	const shortkeys = Object.fromEntries(
		commands.map(({ name, shortcut, description }) => [name, { combo: shortcut, description }]),
	) as ShortkeyConfig

	const message: Message = { command, shortkeys }

	chrome.tabs.sendMessage(tab.id, message)
})
