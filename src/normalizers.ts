import type { NormalizedMatcher } from '@li/irregex/matchers/normalized'
import type { Normalization } from './worker.ts'

type Normalizer = ConstructorParameters<typeof NormalizedMatcher>[0]['normalizers'][number]

const normalizers: Record<Normalization, Normalizer> = {
	diacritics: {
		selector: /(\p{L})\p{M}*/gu,
		replacer: (x) => x[1]!.normalize('NFD')[Symbol.iterator]().next().value!,
	},
}

export function normalizersFor(normalizations: Normalization[]): Normalizer[] {
	return Object.entries(normalizers)
		.filter((n) => normalizations.includes(n[0] as keyof typeof normalizers))
		.map(([, n]) => n)
}
