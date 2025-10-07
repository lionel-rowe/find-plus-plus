import { innerText } from './innerText.ts'
// @ts-types="@types/jsdom"
import { JSDOM } from 'jsdom'
import { stubProperty } from '@std/testing/unstable-stub-property'
import { assertEquals } from '@std/assert/equals'
import dedent from 'string-dedent'

function getJsDom(html?: ConstructorParameters<typeof JSDOM>[0]): JSDOM & Disposable {
	const jsdom = new JSDOM(html)
	const stack = new DisposableStack()
	const stubbed: (string | symbol)[] = []
	const skipped: (string | symbol)[] = []

	const { getComputedStyle } = jsdom.window
	jsdom.window.getComputedStyle = (el) => {
		const computed = getComputedStyle(el)
		if (!(el instanceof HTMLElement)) {
			return computed
		}
		return Object.assign(
			getComputedStyle(el),
			{
				whiteSpaceCollapse: el.style.whiteSpace.includes('pre') ? 'preserve' : 'collapse',
			},
		)
	}

	for (const k of Reflect.ownKeys(jsdom.window) as (keyof typeof jsdom.window & keyof typeof globalThis)[]) {
		try {
			const v = jsdom.window[k]
			if (globalThis[k] === v) {
				skipped.push(k)
				continue
			}
			stack.use(stubProperty(globalThis, k, jsdom.window[k]))
			stubbed.push(k)
		} catch {
			skipped.push(k)
		}
	}

	Element.prototype.checkVisibility = () => true
	Element.prototype.getBoundingClientRect = () => {
		return new DOMRect(0, 0, 10, 10)
	}
	HTMLHtmlElement.prototype.getBoundingClientRect = () => {
		return new DOMRect(0, 0, 20, 20)
	}

	return Object.assign(jsdom, {
		// can't use `stack[Symbol.dispose].bind(stack)` due to V8 bug https://issues.chromium.org/issues/437612640
		[Symbol.dispose]: () => stack[Symbol.dispose](),
	})
}

Deno.test(innerText.name, async () => {
	const html = await Deno.readTextFile('./demo/index.html')
	using _jsdom = getJsDom(html)
	void (document.querySelector('[data-test-id="split-text"]')!.firstChild as Text).splitText(5)
	const result = innerText(document.getElementById('white-space')!)
	assertEquals(
		result.text,
		dedent`
			White space

			one two three
			four\x20

			flex item\tflex item 2\t
			table cell 1\ttable cell 2\t

			split text data
			a b
			a
			b
			a b c\x20


		`,
	)
})
