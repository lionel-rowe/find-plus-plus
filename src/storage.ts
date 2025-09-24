import { type Flat, flatten, unflatten } from '@li/flatten-unflatten'
import { AppOptions } from './types.ts'

export const optionsStorage = storage<AppOptions>('sync')

function storage<T extends Record<string, unknown>>(storageType: chrome.storage.AreaName) {
	return {
		async get(x: T) {
			return unflatten(await chrome.storage[storageType].get<Flat<T>>(flatten(x)) as Record<string, unknown>) as T
		},
		async set(x: Partial<T>) {
			return await chrome.storage[storageType].set(flatten(x) as Record<string, unknown>)
		},
		async clear() {
			return await chrome.storage[storageType].clear()
		},
	}
}
