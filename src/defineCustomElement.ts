import { CUSTOM_ELEMENT_NAME, TEMPLATE_ID } from './config.ts'
import { assert } from '@std/assert/assert'

customElements.define(
	CUSTOM_ELEMENT_NAME,
	class extends HTMLElement {
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
