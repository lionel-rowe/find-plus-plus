import { assert } from '@std/assert/assert'
import type { AppOptions, Command, ShortkeyConfig } from './types.ts'

type AppEventType = `${typeof APP_ID}_${string}`
const registeredTypes = new Set<string>()
function makeAppEventType<T extends string>(t: T): AppEventType {
	assert(!registeredTypes.has(t))
	registeredTypes.add(t)
	return `${APP_ID}_${t}`
}

abstract class AppEvent<D = undefined> extends CustomEvent<D> {
	constructor(...[detail]: D extends undefined ? [] : [D]) {
		super(new.target.TYPE, { detail })
	}

	static override [Symbol.hasInstance](x: unknown) {
		return x instanceof CustomEvent && x.type === this.TYPE
	}

	static get TYPE(): AppEventType {
		// runtime workaround for lack of `static abstract` properties
		// https://github.com/microsoft/TypeScript/issues/34516
		throw new Error('abstract `TYPE` must be overridden in subclass')
	}
}

export class NotifyReadyEvent extends AppEvent {
	static override readonly TYPE = makeAppEventType('notifyReady')
}

export class UpdateOptionsEvent extends AppEvent<{ options: AppOptions }> {
	static override readonly TYPE = makeAppEventType('updateOptions')
}

export class CommandEvent extends AppEvent<{ command: Command; shortkeys: ShortkeyConfig }> {
	static override readonly TYPE = makeAppEventType('command')
}

export class CloseEvent extends AppEvent {
	static override readonly TYPE = makeAppEventType('close')
}
