import { assert } from '@std/assert'

export class TextNodeOffsetWalker {
	#treeWalker
	#results

	constructor(element: Element) {
		this.#treeWalker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
		this.#results = this.#getResults()
		// discard empty yield
		this.#results.next()
	}

	next(offset: number) {
		return this.#results.next(offset).value
	}

	*#getResults(): Generator<[textNode: Text, offset: number], undefined, number> {
		// @ts-ignore yield nothing because no data yet (this is discarded on initial call to `next()` with no arg)
		let offset = yield
		let cursor = 0

		while (this.#treeWalker.nextNode()) {
			const { currentNode } = this.#treeWalker
			assert(currentNode instanceof Text)
			const text = currentNode.nodeValue ?? ''
			while (offset <= cursor + text.length) {
				offset = yield [currentNode, offset - cursor]
			}
			cursor += text.length
		}
	}
}
