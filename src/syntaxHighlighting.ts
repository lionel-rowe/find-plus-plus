import type { AST } from '@eslint-community/regexpp'
import { RegExpParser } from '@eslint-community/regexpp'
import { TextNodeOffsetWalker } from './textNodeOffset.ts'
import { elements } from './elements.ts'
import { namespaced } from './config.ts'

const parser = new RegExpParser()

type HighlightType = AST.Node['type'] | 'EscapedCharacter' | 'Lookaround'

type HighlightResult = [HighlightType, Range][]

// keep in order of granularity (big->small) to ensure highlighting works properly
export const regexSyntaxHighlightTypes = [
	'RegExpLiteral',
	'Pattern',
	'Modifiers',
	'Flags',
	'ModifierFlags',

	'Alternative',
	'Quantifier',

	'Group',
	'CapturingGroup',
	'Backreference',
	'Lookaround',

	'ExpressionCharacterClass',

	'ClassIntersection',
	'ClassSubtraction',

	'CharacterClass',
	'CharacterClassRange',

	'ClassStringDisjunction',
	'StringAlternative',

	'Assertion',
	'CharacterSet',
	'EscapedCharacter',
	'Character',
] as const satisfies HighlightType[]

const sheet = new CSSStyleSheet()
elements.container.shadowRoot!.adoptedStyleSheets.push(sheet)
let priority = 0
for (const name of regexSyntaxHighlightTypes) {
	const hl = new Highlight()
	hl.priority = priority++
	const ns = namespaced(name)
	CSS.highlights.set(ns, hl)
	sheet.insertRule(`::highlight(${ns}) { color: var(--syntax-${name}); }`)
}

// keep types in sync
void (() => {
	let _!: Exclude<HighlightType, typeof regexSyntaxHighlightTypes[number]>
	// @ts-expect-error type should be never
	_.valueOf()
})

export class RegexSyntaxHighlights {
	readonly result: HighlightResult
	#source: string
	#isFullRegex: boolean
	#unicodeConfig: Partial<Record<'unicode' | 'unicodeSets', boolean>>
	#element: HTMLElement
	#walker: TextNodeOffsetWalker

	constructor(
		element: HTMLElement,
		unicodeConfig: Partial<Record<'unicode' | 'unicodeSets', boolean>>,
		isFullRegex: boolean,
	) {
		this.#unicodeConfig = unicodeConfig
		this.#isFullRegex = isFullRegex
		this.#source = element.textContent!
		this.result = []
		this.#element = element
		this.#walker = new TextNodeOffsetWalker(this.#element)

		try {
			this.#populateHighlights()
		} catch (e) {
			console.error(e)
		}
	}

	debug() {
		return this.result.map(([name, range]) => [name, range.toString(), range.startOffset, range.endOffset])
	}

	#populateHighlights() {
		if (this.#isFullRegex) this.#handleRegex()
		else this.#handlePattern()
	}

	#handlePattern() {
		this.#handleElement(parser.parsePattern(this.#source, ...[, ,], this.#unicodeConfig))
	}

	#handleRegex() {
		this.#handleElement(parser.parseLiteral(this.#source))
	}

	#handleElement(el: AST.Node) {
		const { result: highlights } = this
		const walker = this.#walker

		const kind = el.type === 'Character'
			? `${el.raw.startsWith('\\') ? 'Escaped' : ''}Character` as const
			: el.type === 'Assertion' && el.raw.startsWith('(')
			? 'Lookaround'
			: el.type

		const range = new Range()
		highlights.push([kind, range])

		range.setStart(...walker.next(el.start)!)

		switch (el.type) {
			case 'RegExpLiteral': {
				this.#handleElement(el.pattern)
				break
			}
			case 'Assertion': {
				switch (el.kind) {
					case 'lookahead':
					case 'lookbehind': {
						for (const child of el.alternatives) this.#handleElement(child)
						break
					}
					case 'end':
					case 'start':
					case 'word': {
						break
					}
					default: {
						// @ts-expect-error type should be never
						el.kind
					}
				}
				break
			}
			case 'Modifiers':
			case 'Flags':
			case 'ModifierFlags':
			case 'Character':
			case 'Backreference':
			case 'CharacterSet': {
				break
			}
			case 'CharacterClass':
			case 'StringAlternative':
			case 'Alternative': {
				for (const child of el.elements) this.#handleElement(child)
				break
			}
			case 'Group':
			case 'CapturingGroup':
			case 'ClassStringDisjunction':
			case 'Pattern': {
				for (const child of el.alternatives) this.#handleElement(child)
				break
			}
			case 'CharacterClassRange': {
				for (const child of [el.min, el.max]) this.#handleElement(child)
				break
			}
			case 'ExpressionCharacterClass': {
				this.#handleElement(el.expression)
				break
			}
			case 'Quantifier': {
				this.#handleElement(el.element)
				break
			}
			case 'ClassIntersection':
			case 'ClassSubtraction': {
				for (const child of [el.left, el.right]) this.#handleElement(child)
				break
			}
			default: {
				// @ts-expect-error type should be never
				el.type
			}
		}

		range.setEnd(...walker.next(el.end)!)
	}
}
