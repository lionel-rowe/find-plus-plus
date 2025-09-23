export function waitForElement<T extends Element>(getter: (m?: MutationRecord[]) => T | null): Promise<T> {
	return new Promise<T>((res) => {
		let el: T | null
		if ((el = getter()) != null) res(el)
		new MutationObserver((mutations, self) => {
			if ((el = getter(mutations)) != null) {
				res(el)
				self.disconnect()
			}
		}).observe(document.documentElement, { childList: true, subtree: true })
	})
}
