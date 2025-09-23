import '@types/chrome'

export type AppOptions = {
	maxTimeout: number
	maxMatches: number

	'defaults.matchCase': boolean
	'defaults.wholeWord': boolean
	'defaults.useRegex': boolean
	'defaults.normalizeDiacritics': boolean

	'shortkeys.matchCase': string
	'shortkeys.wholeWord': string
	'shortkeys.useRegex': string
	'shortkeys.normalizeDiacritics': string

	'colors.all': string
	'colors.current': string
	'colors.text': string
}

export type Command = keyof typeof import('../dist/manifest.json', { with: { type: 'json' }})['commands']
export type ShortKey = Command | 'matchCase' | 'wholeWord' | 'useRegex' | 'normalizeDiacritics'

type CommandMessage = {
	kind: 'command'
	command: Command
	shortkeys: ShortkeyConfig
}
type OptionsUpdatedMessage = {
	kind: 'optionsUpdated'
}

export type Message = CommandMessage | OptionsUpdatedMessage
export type ShortkeyConfig = Record<Exclude<ShortKey, Command>, {
	combo: string
	description: string
}>
