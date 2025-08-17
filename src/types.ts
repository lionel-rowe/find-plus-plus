import '@types/chrome'

export type AppOptions = {
	'defaults.matchCase': boolean
	'defaults.wholeWord': boolean
	'defaults.useRegex': boolean
}

export type Command = keyof typeof import('../dist/manifest.json', { with: { type: 'json' }})['commands'] | 'close'
export type Message = { command: Command }
