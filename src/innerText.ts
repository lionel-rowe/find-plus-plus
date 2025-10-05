import { checkVisibility, type VisibilityChecker } from './checkVisibility.ts'

type InnerTextResult = {
	/** All text nodes */
	nodes: Text[]
	/** Offsets corresponding to the start of each of `nodes` within `text` (in UTF-16 code units) */
	offsets: number[]
	// /** The resolved innerTexts of each of the `nodes` */
	// texts: string[]
	/** The resolved innerText (may differ somewhat from native `Element#innerText`) */
	text: string
}

type WhiteSpaceCollapseMode = { space: 'preserve' | 'collapse'; breaks: 'preserve' | 'collapse' }
const defaultMode: WhiteSpaceCollapseMode = { space: 'collapse', breaks: 'collapse' }
const modes = new Map<string, WhiteSpaceCollapseMode>([
	['collapse', defaultMode],
	['preserve-breaks', { space: 'collapse', breaks: 'preserve' }],
	['preserve', { space: 'preserve', breaks: 'preserve' }],
	['preserve-spaces', { space: 'preserve', breaks: 'collapse' }],
])

const IGNORED_ELEMENTS = [
	'script',
	'style',
	// TODO: Support `textarea` somehow? Currently doesn't work properly due to text node data not updateing when
	// `textarea`'s content is changed; additionally, `Range` objects don't work properly within `textarea`s, so
	// impossible to highlight.
	'textarea',
	// TODO: Support `input` somehow? Same issues as `textarea`
	'input',
].map((s) => s.toUpperCase())

function debug(...data: [string]) {
	// @ts-ignore globalThis
	if (globalThis.DEBUG_MODE) {
		// deno-lint-ignore no-console
		console.debug(...data)
	}
}

class TagStart {
	element: Element
	constructor(element: Element) {
		this.element = element
	}
}
class TagEnd {
	element: Element
	constructor(element: Element) {
		this.element = element
	}
}

/**
 * Values yielded from {@linkcode walk}
 *
 * ```text
 * ~~~;;;;;;;;;;_^_\!;;\^;>;>:TiuH+\v++.;2xT=+J\;^``.:)r^::::::^;;~~~~^^^^^""__,
 * ~~~~;;;;;;;;;^;T)?\\Z??~?+::!)F???>\<;!^_+:+^L`.``:??+~_.!::,_^~^^^^^^^^^__,,
 * ~~~~;;;;;;!>;?JY|2)2Eo)>~<`.;^;?__;~:?;+::.::_````:!^?.*J^:._::~^^^^^^^^^^_,,
 * ~~~~;;;;;;~L?ITL?J]u3I?;:.:_raL;,::,~:!^~:,.`.````:::`.[I|~=::.~^^^^^^^^^"_,:
 * ~~~~;;;;;+!+T);^:!:;+;;=:!28@@&b9H2h9WDWHKf[v+??\=;:.`,>\|5:,^:^^^^^^^^^"__::
 * ;;;;;;;;;;>)\;!^...:_?\I6g@@@@@@@@@@@@@@@&&g$WDqKIxz?;,!Ir?|;":^^^^^^^^""_,::
 * ~~~~~~;;;;L+?T)\;;+;vyR@@@@@@@@@@@@@@@@@&&&&g0W#951Ii+^;?+;;::_"^^^^^^^___,::
 * ~~~~~;;;;;!?3q#9X#HWg@@@@@@@@@@@@@@@@@@@@@&&@&0DmCYII?~?+?;^^._^^^^^^^^__,,::
 * ~~~~~;;;;~\JL?v|h0&@@@@@@@@@@@@@@@@@@@@@@@@@ggW#h#jF7!,^?!;"^:`^^^^""""__,,::
 * ^~~~~~;;~;+7r+!)xW0@&@@@@@@@@@@@@@@@@@@@@@@@@gW%qK2Ii?:::,::..`^^^"_____,,:::
 * ^^^^^~;~~;^;=?\?JjRW&@@@@@@@@@@@@@&@@&gQ@@@@g$gWWH2[}\^:.`.````__^"____,,::::
 * ^^^^^~~~~~~;~+TTL|#g&@@@@@@@@@@@@@&&@Q0@@@@@MWWWW921?=<_```````^_"",_,,,,::::
 * ^^^^^~~~^^^>=v?+?+HgQ&&@@@&@@@@@@@@&&WgW8&@0NWWWHu4yu?".````.``:"__,,,,,:::::
 * ^^^^^^^^^^^;;!!~'LYMg0g@@gW2Y??;;+i5K%W@I&j?:..::,::^_,.````````_,,,,::::::::
 * ^^^^^^^^^^^~><+^:?WWW$$W%H#Qg&WWS29kd%@@K\`;I!%@biT=;:::```````':::,:::::::::
 * ^^^^^^^^^^;?>;^;?1mW%WWy%NhTovTvH?Jy&0@@#:`^>F@FlLT^^;:^:`````:::,,::::::::::
 * ^^^^^^^^^^^^~?;\=|G&gQ&&W&Qg@gWDhY8@@@@@g?`+KWWW9oJ\??:,,.```^,:,::::::::::::
 * ^^^^^^^^^^_~;!;^^?+Mg&@@@@@@gWwWdg@@@@@@W1.+oyZbRHpJ+Lj]:```:,,,:::::::::::::
 * ^^^^^^^^^^^^^^^~<):E%&@@@@@@@@@@@@@@@@&@@W;:)hWWbPho9a2;.``_:::::::::::::::::
 * ^^^^^^^^^^^^^^^^";W4WgQQ@@@&@@@@@@@@OQ@@@W1.`THAHWw??\~.``._,,,::::::::::::::
 * ~~^^^^^^^^^^^^^""""+9WW0g&@@@@@@@g!W@@@@@Mj.~^;HHKi\:.````,___,,,::::::::::::
 * ;;~~^~~~^^^^^^^^"^^^#W$WgW#&@@@@W+W0;.i2z<.````)HV?:`.:.``:_____,,,::::::::::
 * ;;;;~~~~~^^^^^^^^^^^\H0g@@@@@@g%)&@@@@@WPw|!!?)FyUv:...``.______,,:::::::::::
 * ;;;;;;;;;~~~~^^^^^^^^yHWg@@@@@gm&@@@@@@%&@0myhoy2o2^.:.``___"___,,:::::::::::
 * ;;;;;;;;;;;;;~^^^^^^^;zEWg@@@&Wg&g&&gH2ua\!)F1IEK[T>^.``:^^"""__,,:::::::::::
 * ;;;;;;;;;;;;;~~~^^^^^^;`IW&@@gQW]!&g8GWDHHI)\=?;;fET:.```^^^^"__,,:::::::::::
 * ;;;;;;;;;;;;~~~~^^;^````;2M$g&W$&@@@@@ggWw96ziIFz1h3'```````.:_"_,,::::::::::
 * ;;;;;;;;;;;;~~~~````````?HamHmy0ggggWWWNNEu2|JrvL)~:.````````````` `:::::::::
 * ;;;;;;;;~:.`````````````:bW9o%g@@@@@@@@@@@&&WHWa[;:.``````````````````````.::
 * ;;:`````````````...``````9bWWo?,|N@@@@@@@@&RWbn+,````````````````````````````
 * `````````````````````````:9#6bHc;::HWRH9WZozT!:``````````````````````````````
 * ```````````````````..:..``WqWWHW99v?I^```::``````````````````````````````````
 * ```.``````````.:.`````````;86UW0%h59;`+?!"?``````````````````````````````````
 * ```````````````.....`.`:````;0#W0DWZ`.~^_:??`:.``````````````````````````````
 * ``````.``````.`.::.....```````:WRW&E:r2aH8g9~<```````````````````````````````
 * `.```.`````..``...`.`...````````\WW)W#D&gy:``````````````````````````````````
 * ```
 */
type Walken = Text | TagStart | TagEnd

/**
 * Walk the subtree of `el` in document order, yielding `Text` nodes and `TagStart`/`TagEnd` tokens.
 *
 * This differs from `TreeWalker` in that it includes the end of tags as well as the start.
 */
function* walk(el: Element, filter?: NodeFilter): Generator<Walken, undefined, undefined> {
	filter ??= () => NodeFilter.FILTER_ACCEPT
	if (typeof filter !== 'function') filter = filter.acceptNode.bind(filter)

	if (filter(el) === NodeFilter.FILTER_REJECT) return
	yield new TagStart(el)
	if (filter(el) === NodeFilter.FILTER_ACCEPT) {
		for (const child of el.childNodes) {
			if (child instanceof Element) {
				yield* walk(child, filter)
			} else if (child instanceof Text) {
				yield child
			}
		}
	}
	yield new TagEnd(el)
}

// for debugging
function serialize(token: Walken): string {
	if (token instanceof TagStart) {
		return `<${token.element.tagName}>`
	} else if (token instanceof TagEnd) {
		return `</${token.element.tagName}>`
	}
	return token.data
}

export function innerText(el: Element): InnerTextResult {
	const document = el.ownerDocument

	const nodes: Text[] = []
	const offsets: number[] = []
	// const texts: string[] = []
	let text = ''
	// const elementStack: Element[] = []

	// const update = (str: string, node?: Text) => {
	// 	nodes.push(node ?? nodes.at(-1)!)
	// 	offsets.push(str.length + (offsets.at(-1) ?? 0))
	// 	texts.push(str)
	// }

	// const checkVisible = checkVisibility(document.documentElement.getBoundingClientRect())
	// const shouldIgnore = shouldIgnore_(checkVisible)
	// const filter: NodeFilter = (node) => {
	// 	if (!(node instanceof Element)) return NodeFilter.FILTER_ACCEPT
	// 	return shouldIgnore(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
	// }
	const filter = () => NodeFilter.FILTER_ACCEPT

	// const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter)

	let textNodeIndex = -1

	for (const node of walk(el, filter)) {
		debug(serialize(node))
		if (node instanceof Text) {
			nodes.push(node)
			// offsets.push(texts.length)
			// texts.push(node.data)
			offsets.push(text.length)
			text += node.data
		}
	}

	// do {
	// 	const node = walker.currentNode

	// 	if (node instanceof Element) {
	// 		textNodeIndex = -1

	// 		if (node.nodeName === 'BR') {
	// 			text += '\n'
	// 			debug('<BR>')
	// 			continue
	// 		}

	// 		elementStack.push(node)
	// 		debug(`<${node.tagName}>`)
	// 	} else if (node instanceof Text) {
	// 		++textNodeIndex

	// 		debug(JSON.stringify(node.data))

	// 		const collapseMode = getWhiteSpaceCollapseMode(parent)

	// 		const prevChar = text.at(-1) ?? ''
	// 		let nodeText = node.data

	// 		// we just exclude empty nodes from the result - no need to include
	// 		if (nodeText === '') continue

	// 		nodes.push(node)
	// 		offsets.push(text.length)

	// 		const getReplacement = (_s: string, i: number) => {
	// 			if (textNodeIndex === 0 && i === 0) return ''
	// 			return (nodeText === '' || (text === '' && i === 0)
	// 				? ''
	// 				: i === 0
	// 				? (/[ \t\r\n]/.test(prevChar) ? '' : ' ')
	// 				: ' ')
	// 		}
	// 		const replacer = (s: string, i: number) => {
	// 			const replacement = getReplacement(s, i)
	// 			if (s.length !== replacement.length) {
	// 				nodes.push(node)
	// 				offsets.push(text.length -s.length +replacement.length )
	// 			}
	// 			return replacement
	// 		}
	// 		if (collapseMode.space === 'collapse') {
	// 			nodeText = nodeText.replace(/[ \t]+/g, replacer)
	// 		}
	// 		if (collapseMode.breaks === 'collapse') {
	// 			nodeText = nodeText.replace(/[ \t]*[\r\n]+[ \t]*/g, replacer)
	// 		}

	// 		text += nodeText
	// 	}
	// } while (walker.nextNode())

	// const text = texts.join('')
	// return { nodes, offsets, text, texts }
	return { nodes, offsets, text }
}

function getTrailingSpace(el: Element) {
	const style = getComputedStyle(el)
	const parent = el.parentElement
	if (parent && getComputedStyle(parent).display === 'flex') {
		const { flexDirection } = style
		if (flexDirection.includes('column')) return '\n'
		return '\t'
	}
	const { display } = style
	if (['table-cell', 'table-header-group'].includes(display)) return '\t'
	if (['block', 'list-item', 'table', 'table-caption', 'table-row', 'flex'].includes(display)) {
		return el.tagName === 'P' ? '\n\n' : '\n'
	}
	return ''
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/white-space-collapse
function getWhiteSpaceCollapseMode(el: Element): WhiteSpaceCollapseMode {
	return modes.get(getComputedStyle(el).whiteSpaceCollapse) ?? defaultMode
}

function shouldIgnore_(checkVisible: VisibilityChecker) {
	return (el: Element) => {
		// invisible due to dimensions, but we still want to include it
		if (el.nodeName === 'BR') return false
		return IGNORED_ELEMENTS.includes(el.tagName) || !checkVisible(el)
	}
}
