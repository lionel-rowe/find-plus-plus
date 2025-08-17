import { assert } from '@std/assert/assert'
import type { AppOptions, Command } from './types.ts'

type AppEventType = `${typeof APP_ID}-${string}`
const registeredTypes = new Set<string>()
function makeAppEventType<T extends string>(t: T) {
	assert(!registeredTypes.has(t))
	registeredTypes.add(t)

	return `${APP_ID}-${t}` as const
}

abstract class AppEvent<D = undefined> extends CustomEvent<D> {
	constructor(...[detail]: D extends undefined ? [] : [D]) {
		super(new.target.TYPE, { detail })
	}

	static override [Symbol.hasInstance](x: unknown) {
		return x instanceof CustomEvent && x.type === this.TYPE
	}

	static readonly TYPE: AppEventType
}

export class ReadyEvent extends AppEvent {
	static override readonly TYPE = makeAppEventType('ready')
}

export class InitEvent extends AppEvent<{ options: AppOptions }> {
	static override readonly TYPE = makeAppEventType('init')
}

export class CommandEvent extends AppEvent<{ command: Command }> {
	static override readonly TYPE = makeAppEventType('open')
}
