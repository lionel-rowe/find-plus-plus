import { CUSTOM_ELEMENT_NAME, TEMPLATE_ID } from './config.ts'
import { assert } from '@std/assert/assert'

/**
 * This nonsense is necessary to avoid conflicts with polyfills bundled with
 * [Polymer](https://github.com/Polymer/polymer),
 * e.g. on youtube.com.
 */
const HTMLElement = globalThis.HTMLElement.prototype.constructor as typeof globalThis.HTMLElement
const customElements = {
	define: (globalThis.customElements.constructor.prototype.define as typeof globalThis.customElements.define).bind(
		globalThis.customElements,
	),
}

customElements.define(
	CUSTOM_ELEMENT_NAME,
	class FindPlusPlus extends HTMLElement {
		constructor() {
			super()
			const template = document.getElementById(TEMPLATE_ID)
			assert(template instanceof HTMLTemplateElement)
			const templateContent = template.content

			const shadowRoot = this.attachShadow({ mode: 'open' })
			shadowRoot.appendChild(templateContent.cloneNode(true))
		}
	},
)
