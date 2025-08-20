import '@types/chrome'

export type AppOptions = {
	maxTimeout: number
	maxMatches: number

	'defaults.matchCase': boolean
	'defaults.wholeWord': boolean
	'defaults.useRegex': boolean

	'colors.all': string
	'colors.current': string
	'colors.text': string
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
