const IS_DEV_MODE = !Object.hasOwn(chrome.runtime.getManifest(), 'update_url')

if (IS_DEV_MODE) {
	chrome.tabs.onUpdated.addListener(() => chrome.runtime.reload())
}
