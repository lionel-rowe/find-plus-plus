// const IS_DEV_MODE = !Object.hasOwn(chrome.runtime.getManifest(), 'update_url')

// if (IS_DEV_MODE) {
// 	chrome.tabs.onUpdated.addListener(async (id) => {
// 		const tab = await chrome.tabs.get(id)
// 		if (tab.url?.startsWith('http://localhost')) {
// 			chrome.runtime.reload()
// 		}
// 	})
// }
