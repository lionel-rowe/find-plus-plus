import '@types/chrome'

type ShortkeyConfig = {
	shortkey: string
	name: string
	description: string
}

type Flag = 'matchCase' | 'wholeWord' | 'useRegex' | 'normalizeDiacritics'
type Action = 'close'

type FlagConfig = {
	default: boolean
} & ShortkeyConfig

export type AppOptions = {
	maxTimeout: number
	maxMatches: number

	flags: Record<Flag, FlagConfig>

	actions: Record<Action, ShortkeyConfig>

	colors: {
		all: string
		current: string
		text: string
	}
}

export type Command = keyof typeof import('../dist/manifest.json', { with: { type: 'json' }})['commands']
export type ShortKey = Command | Flag

type CommandMessage = {
	kind: 'command'
	command: Command
}
type OptionsUpdatedMessage = {
	kind: 'optionsUpdated'
}

export type Message = CommandMessage | OptionsUpdatedMessage
export type ShortkeyConfigMapping = Record<Exclude<ShortKey, Command>, ShortkeyConfig>
