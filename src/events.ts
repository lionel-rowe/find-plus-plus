import { APP_ID } from './config.ts'
import type { AppOptions } from './types.ts'

export const readyEvent = createCustomEventType(`${APP_ID}-ready`)
export const initEvent = createCustomEventType<{ options: AppOptions }>(`${APP_ID}-init`)

function createCustomEventType<T = undefined>(type: string) {
	return {
		type,
		create(...[detail]: T extends undefined ? [] : [T]) {
			return new CustomEvent(type, { detail })
		},
		checkType(x: unknown): x is CustomEvent<T> {
			return x instanceof CustomEvent && x.type === type
		},
	}
}
