import '@types/chrome'

export type AppOptions = {
	'defaults.matchCase': boolean
	'defaults.wholeWord': boolean
	'defaults.useRegex': boolean
}

export type Command = keyof typeof import('../dist/manifest.json', { with: { type: 'json' }})['commands']
export type Message = {
	command: Command
	shortkeys: ShortkeyConfig
}
export type ShortkeyConfig = Record<Command, {
	combo: string
	description: string
}>
