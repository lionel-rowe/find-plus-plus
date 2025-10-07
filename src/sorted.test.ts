import './types.d.ts'
import { assertEquals } from '@std/assert'
import { findSorted, type Sorted } from './sorted.ts'

Deno.test(findSorted.name, async (t) => {
	await t.step('ascending', async (t) => {
		const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as Sorted

		await t.step('single match', async (t) => {
			await t.step('start', () => {
				const sorted = findSorted(arr, 0)
				assertEquals(sorted, [0, 0])
			})
			await t.step('middle', () => {
				const sorted = findSorted(arr, 3)
				assertEquals(sorted, [3, 3])
			})
			await t.step('end', () => {
				const sorted = findSorted(arr, 9)
				assertEquals(sorted, [9, 9])
			})
		})
		await t.step('multiple matches', async (t) => {
			await t.step('start', () => {
				const arr = [0, 0, 0, 1, 2, 3] as Sorted
				const sorted = findSorted(arr, 0)
				assertEquals(sorted, [0, 2])
			})
			await t.step('middle', () => {
				const arr = [0, 1, 2, 2, 2, 3] as Sorted
				const sorted = findSorted(arr, 2)
				assertEquals(sorted, [2, 4])
			})
			await t.step('end', () => {
				const arr = [0, 1, 2, 3, 3, 3] as Sorted
				const sorted = findSorted(arr, 3)
				assertEquals(sorted, [3, 5])
			})
		})

		await t.step('no match', async (t) => {
			await t.step('start', () => {
				const sorted = findSorted(arr, 3.5)
				assertEquals(sorted, [~4, ~4])
			})
			await t.step('middle', () => {
				const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as Sorted
				const sorted = findSorted(arr, -999)
				assertEquals(sorted, [~0, ~0])
			})
			await t.step('end', () => {
				const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as Sorted
				const sorted = findSorted(arr, 999)
				assertEquals(sorted, [~10, ~10])
			})
		})
	})
})
