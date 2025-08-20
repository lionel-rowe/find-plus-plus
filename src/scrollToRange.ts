import { getElementAncestor, getScrollParent } from './scrollParent.ts'

const RANGE_CONTAINER_TYPES = ['start', 'end', 'commonAncestor'] as const

export function scrollIntoView(range: Range, behavior: ScrollBehavior = 'instant') {
	const { x, y, width, height } = range.getBoundingClientRect()
	const containers = Object.fromEntries(
		RANGE_CONTAINER_TYPES.map((type) => [type, getElementAncestor(range[`${type}Container`])]),
	) as Record<typeof RANGE_CONTAINER_TYPES[number], Element>
	const containerList = Object.values(containers)

	const elementFromStart = document.elementFromPoint(x, y)
	const elementFromEnd = document.elementFromPoint(subtractPixelDelta(x + width), subtractPixelDelta(y + height))

	if (!containerList.includes(elementFromStart!) || !containerList.includes(elementFromEnd!)) {
		scrollToRange(range, containers.commonAncestor, behavior)
	}
}

function scrollToRange(range: Range, element: Element, behavior: ScrollBehavior = 'instant') {
	const scrollParent = getScrollParent(element)
	// `scrollIntoView` is an order of magnitude slower than `scrollTo`, so we avoid calling
	// it if the scroll parent is the document root
	if (scrollParent != null) {
		element.scrollIntoView({ behavior, block: 'center', inline: 'center' })
		// return
	}

	// target the range more accurately (`element` is typically larger surface area than `range`)
	const rect = range.getBoundingClientRect()

	const totalHeight = document.documentElement.clientHeight
	const totalWidth = document.documentElement.clientWidth

	const options = {
		behavior,
		top: rect.top + window.scrollY - totalHeight / 2 - rect.height / 2,
		left: rect.left + window.scrollY - totalWidth / 2 - rect.width / 2,
	}
	document.documentElement.scrollTo(options)
}

function subtractPixelDelta(n: number) {
	// TODO: Should this ideally be `Number.EPSILON`-based?
	// Currently we just subtract 1 pixel, logic fails when using `Number.EPSILON`.
	// return n * (1 - Number.EPSILON)
	return n - 1
}
