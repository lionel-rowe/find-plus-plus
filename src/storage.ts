import { AppOptions } from './types.ts'

export const optionsStorage = storage<AppOptions>()

function storage<T extends Record<string, unknown>>() {
	return {
		async get(x: T) {
			return await chrome.storage.sync.get(x) as T
		},
		async set(x: T) {
			return await chrome.storage.sync.set(x)
		},
	}
}
