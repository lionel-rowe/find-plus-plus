import { AppOptions } from './types.ts'

export const optionsStorage = storage<AppOptions>('sync')

function storage<T extends Record<string, unknown>>(storageType: chrome.storage.AreaName) {
	return {
		async get(x: T) {
			return await chrome.storage[storageType].get(x) as T
		},
		async set(x: Partial<T>) {
			return await chrome.storage[storageType].set(x)
		},
		async clear() {
			return await chrome.storage[storageType].clear()
		},
	}
}
