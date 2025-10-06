import { HIGHLIGHT_ALL_ID, HIGHLIGHT_CURRENT_ID } from './config.ts'
import { elements } from './elements.ts'
import { scrollIntoView } from './scrollToRange.ts'
import { modulo } from './utils.ts'

export type IndexSetter = number | ((n: number) => number)

type OkState = { kind: 'ok'; ranges: Range[]; currentIndex: number }
type ErrorState = { kind: 'error'; message: string }
type LoadingState = { kind: 'loading' }
type VoidState = { kind: 'void' }
export type ViewState = OkState | LoadingState | ErrorState | VoidState
export type ViewStateUpdate = ViewState | ((state: ViewState) => ViewState)

class State {
	#state: ViewState = { kind: 'void' }

	updateView(update: ViewStateUpdate) {
		const state = this.#state = typeof update === 'function' ? update(this.#state) : update

		for (const s of ['ok', 'error', 'loading', 'empty'] as const) {
			elements.info.classList.toggle(s, s === state.kind)
		}

		switch (state.kind) {
			case 'loading': {
				break
			}
			case 'error': {
				CSS.highlights.delete(HIGHLIGHT_ALL_ID)
				CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
				elements.infoMessage.textContent = state.message
				break
			}
			case 'ok': {
				state.currentIndex = modulo(
					state.currentIndex,
					state.ranges.length,
				) || 0

				switch (state.ranges.length) {
					case 0: {
						CSS.highlights.delete(HIGHLIGHT_ALL_ID)
						CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
						elements.info.classList.remove('ok')
						elements.info.classList.add('empty')
						elements.infoMessage.textContent = 'No results'

						break
					}
					default: {
						const range = state.ranges[state.currentIndex]!
						CSS.highlights.set(HIGHLIGHT_ALL_ID, new Highlight(...state.ranges))
						CSS.highlights.set(HIGHLIGHT_CURRENT_ID, new Highlight(range))
						scrollIntoView(range)
						elements.infoMessage.textContent = `${state.currentIndex + 1} of ${state.ranges.length}`

						break
					}
				}

				break
			}
			case 'void': {
				CSS.highlights.delete(HIGHLIGHT_ALL_ID)
				CSS.highlights.delete(HIGHLIGHT_CURRENT_ID)
				elements.info.classList.add('empty')
				elements.infoMessage.textContent = ''

				break
			}
		}
	}

	updateRangeIndex(value: IndexSetter) {
		this.updateView((state) => {
			if (state.kind === 'ok') {
				return {
					...state,
					currentIndex: typeof value === 'function' ? value(state.currentIndex) : value,
				}
			}
			return state
		})
	}
}

export const state = new State()
