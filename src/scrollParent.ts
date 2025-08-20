// Modified from https://github.com/jquery/jquery-ui/blob/main/ui/scroll-parent.js

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll'])
const SCROLLABLE_OVERFLOW_INCLUDING_HIDDEN = new Set([...SCROLLABLE_OVERFLOW, 'hidden'])

/** @returns The element's scroll parent, or `null` if the scroll parent is the document root. */
export function getScrollParent(element: Element, options: { includeHidden?: boolean } = {}): Element | null {
	const includeHidden = options.includeHidden ?? false
	const { position } = getComputedStyle(element)

	if (position === 'fixed') return null

	const excludeStaticParent = position === 'absolute'
	const scrollableOverflowStyles = includeHidden ? SCROLLABLE_OVERFLOW_INCLUDING_HIDDEN : SCROLLABLE_OVERFLOW

	let parent: Element | null = element
	while ((parent = parent.parentElement)) {
		const { overflow, position } = getComputedStyle(parent)
		if (excludeStaticParent && position === 'static') continue
		if (scrollableOverflowStyles.has(overflow)) return parent
	}

	return null
}

export function getElementAncestor(node: Node) {
	return node instanceof Element ? node : node.parentElement ?? document.documentElement
}
