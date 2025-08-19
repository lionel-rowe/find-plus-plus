type ElementType<K extends string> = K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K]
	: Element

export function waitForElement<K extends string>(selector: K): Promise<ElementType<K>> {
	const el = document.querySelector(selector)
	return el != null
		? Promise.resolve(el as ElementType<K>)
		: new Promise<ElementType<K>>((res) =>
			new MutationObserver((mutations, self) => {
				for (const node of mutations.flatMap((m) => [...m.addedNodes])) {
					if (node instanceof Element && node.matches(selector)) {
						self.disconnect()
						res(node as ElementType<K>)
						return
					}
				}
			}).observe(document.documentElement, { childList: true, subtree: true })
		)
}
