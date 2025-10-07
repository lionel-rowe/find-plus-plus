import { unimplemented } from '@std/assert/unimplemented'
import { unreachable } from '@std/assert/unreachable'

export type Sortable = number | bigint | string
/** NOTE: `desc` is currently unsupported by `findSorted` */
export type Direction = 'asc' | 'desc'

const BRAND = Symbol('BRAND')
export type Sorted<T extends Sortable = number, D extends Direction = 'asc'> = T[] & { readonly [BRAND]: D }

export function sort<T extends Sortable = number, D extends Direction = 'asc'>(arr: T[], direction: D): Sorted<T, D> {
	return [...arr].sort(direction === 'desc' as never ? sortDesc : sortAsc) as Sorted<T, D>
}

function sortAsc<T extends Sortable>(a: T, b: T) {
	return a > b ? 1 : a < b ? -1 : 0
}

function sortDesc<T extends Sortable>(a: T, b: T) {
	return a < b ? 1 : a > b ? -1 : 0
}

/** Options for {@linkcode findSorted} */
export type FindSortedOptions = {
	/** Index to start searching from (inclusive). Default is `0`. */
	start: number
	/** Index to end searching (inclusive). Default is `arr.length - 1`. */
	end: number
	/** Direction in which the array is sorted. Default is 'asc' (from start to end). */
	direction: 'asc'
}

/**
 * @param haystack The sorted array to search.
 * @param needle The value to search for.
 * @param options Options for the search.
 * @returns
 * - If found, returns a tuple of the first and last index that satisfy the condition.
 * - If not found, returns a tuple containing the two's complement of the index where such an item could be inserted to
 *   maintain sorted order.
 */
export function findSorted<T extends Sortable = number, D extends 'asc' = 'asc'>(
	haystack: Sorted<T, D>,
	needle: T,
	options?: Partial<FindSortedOptions>,
): [first: number, last: number] {
	const { start = 0, end = haystack.length - 1, direction = 'asc' } = options ?? {}
	return direction === 'desc' as never
		? findSortedDesc(haystack as unknown as Sorted<T, 'desc'>, needle, start, end)
		: findSortedAsc(haystack as Sorted<T, 'asc'>, needle, start, end)
}

function findSortedAsc<T extends Sortable = number>(
	haystack: Sorted<T, 'asc'>,
	needle: T,
	start = 0,
	end = haystack.length - 1,
): [first: number, last: number] {
	let first = -1
	let last = -1

	for (let i = start; i <= end; ++i) {
		if (haystack[i]! === needle) {
			if (first === -1) first = i
			last = i
		} else if (haystack[i]! > needle) {
			return first === -1 ? [~i, ~i] : [first, last]
		}
	}

	return first === -1 ? [~haystack.length, ~haystack.length] : [first, last]
}

function findSortedDesc<T extends Sortable = number>(
	_haystack: Sorted<T, 'desc'>,
	_needle: T,
	_start = 0,
	_end = _haystack.length - 1,
): [first: number, last: number] {
	unimplemented()
}
