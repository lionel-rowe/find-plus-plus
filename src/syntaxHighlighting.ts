import type { AST } from '@eslint-community/regexpp'
import { RegExpParser } from '@eslint-community/regexpp'
import { TextNodeOffsetWalker } from './textNodeOffset.ts'

const parser = new RegExpParser()

type HighlightType = AST.Node['type'] | 'EscapedCharacter'

type HighlightMap = Record<HighlightType, Highlight>

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

	'ClassStringDisjunction',
	'StringAlternative',

	'ExpressionCharacterClass',

	'ClassIntersection',
	'ClassSubtraction',

	'CharacterClass',

	'Assertion',
	'CharacterClassRange',
	'CharacterSet',
	'EscapedCharacter',
	'Character',
] as const satisfies HighlightType[]

// keep types in sync
void (() => {
	let _!: Exclude<HighlightType, typeof regexSyntaxHighlightTypes[number]>
	// @ts-expect-error type should be never
	_.valueOf()
})

export class RegexSyntaxHighlighter {
	readonly highlights: HighlightMap
	#source: string
	#isFullRegex: boolean
	#regex: RegExp
	#element: HTMLElement

	constructor(element: HTMLElement, regex: RegExp, isFullRegex: boolean) {
		this.#regex = regex
		this.#isFullRegex = isFullRegex
		this.#source = element.textContent!
		this.highlights = Object.fromEntries(
			regexSyntaxHighlightTypes.map((t) => [t, new Highlight()]),
		) as HighlightMap

		this.#element = element

		try {
			this.#populateHighlights()
		} catch (e) {
			console.error(e)
		}
	}

	debug() {
		return Object.fromEntries(
			Object.entries(this.highlights)
				.map(([name, highlight]) => [name, [...highlight.keys()].map((range) => range.toString())])
				.filter((x) => x[1].length),
		)
	}

	#populateHighlights() {
		if (this.#isFullRegex) this.#handleRegex()
		else this.#handlePattern()
	}

	#handlePattern() {
		const pattern = parser.parsePattern(this.#source, ...[, ,], this.#regex)
		this.#handleAstElement(pattern)
	}

	#handleRegex() {
		const regex = parser.parseLiteral(this.#source)
		this.#handleAstElement(regex)
	}

	#handleAstElement(el: AST.Node) {
		const highlightMap = this.highlights

		if (el.type === 'Character') {
			const kind = `${el.raw.startsWith('\\') ? 'Escaped' : ''}Character` as const
			highlightMap[kind].add(this.#getRange(el))
		} else {
			highlightMap[el.type].add(this.#getRange(el))
		}

		switch (el.type) {
			case 'RegExpLiteral': {
				this.#handleAstElement(el.pattern)
				break
			}
			case 'Modifiers':
			case 'Flags':
			case 'ModifierFlags':
			case 'Character':
			case 'Assertion':
			case 'Backreference':
			case 'CharacterSet': {
				break
			}
			case 'CharacterClass':
			case 'StringAlternative':
			case 'Alternative': {
				for (const child of el.elements) this.#handleAstElement(child)
				break
			}
			case 'Group':
			case 'CapturingGroup':
			case 'ClassStringDisjunction':
			case 'Pattern': {
				for (const child of el.alternatives) this.#handleAstElement(child)
				break
			}
			case 'CharacterClassRange': {
				for (const child of [el.min, el.max]) this.#handleAstElement(child)
				break
			}
			case 'ExpressionCharacterClass': {
				this.#handleAstElement(el.expression)
				break
			}
			case 'Quantifier': {
				this.#handleAstElement(el.element)
				break
			}
			case 'ClassIntersection':
			case 'ClassSubtraction': {
				for (const child of [el.left, el.right]) this.#handleAstElement(child)
				break
			}
			default: {
				// @ts-expect-error type should be never
				el.type
			}
		}
	}

	#getRange(x: { start: number; end: number }) {
		const walker = new TextNodeOffsetWalker(this.#element)
		const range = new Range()
		range.setStart(...walker.next(x.start)!)
		range.setEnd(...walker.next(x.end)!)
		return range
	}
}
