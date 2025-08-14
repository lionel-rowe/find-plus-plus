import { template } from './_template.ts'
import { CUSTOM_ELEMENT_NAME } from './config.ts'
import { assert } from '@std/assert/assert'

void (document.head ?? document.documentElement).insertAdjacentHTML(
	'beforeend',
	template,
)

void (document.body ?? document.documentElement).insertAdjacentHTML(
	'beforeend',
	`<${CUSTOM_ELEMENT_NAME} hidden></${CUSTOM_ELEMENT_NAME}>`,
)

export function getElements() {
	const container = window.document.querySelector(CUSTOM_ELEMENT_NAME)
	assert(container instanceof HTMLElement)
	const document = container.shadowRoot
	assert(document != null)
	const ce = document.querySelector('[contenteditable]')
	assert(ce instanceof HTMLElement)
	const textarea = Object.defineProperty(
		Object.assign(ce, { value: '' }),
		'value',
		{
			get() {
				return this.innerText.replace(/\n$/, '')
			},
			set(value) {
				this.innerText = value
			},
		},
	)
	const info = document.querySelector('.info')
	assert(info instanceof HTMLElement)
	const infoMessage = document.querySelector('.info-message')
	assert(infoMessage instanceof HTMLElement)
	const flags = document.querySelector('.flags')
	assert(flags instanceof HTMLFormElement)

	return { container, textarea, info, infoMessage, flags }
}

export const elements = getElements()
