import type { AppOptions, Command } from './types.ts'
import { namespaced } from './config.ts'

abstract class AppEvent<D = undefined> extends CustomEvent<D> {
	constructor(...[detail]: D extends undefined ? [] : [D]) {
		super(new.target.TYPE, { detail })
	}

	static override [Symbol.hasInstance](x: unknown) {
		return x instanceof CustomEvent && x.type === this.TYPE
	}

	static get TYPE(): `${typeof APP_NS}_${string}` {
		// runtime workaround for lack of `static abstract` properties
		// https://github.com/microsoft/TypeScript/issues/34516
		throw new Error('abstract `TYPE` must be overridden in subclass')
	}
}

export class CheckReadyEvent extends AppEvent {
	static override readonly TYPE = namespaced('check-ready')
}

type NotifyReadySource = 'main' | 'worker-runner'
export class NotifyReadyEvent extends AppEvent<{ source: NotifyReadySource }> {
	static override readonly TYPE = namespaced('notify-ready')
}

export class UpdateOptionsEvent extends AppEvent<{ options: AppOptions }> {
	static override readonly TYPE = namespaced('update-options')
}

export class OpenOptionsPageEvent extends AppEvent {
	static override readonly TYPE = namespaced('open-options-page')
}

export class CommandEvent extends AppEvent<{ command: Command }> {
	static override readonly TYPE = namespaced('command')
}

export class CloseEvent extends AppEvent {
	static override readonly TYPE = namespaced('close')
}

export class PuppeteerTestEvent extends AppEvent {
	static override readonly TYPE = namespaced('puppeteer-test')
}
