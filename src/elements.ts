import { CUSTOM_ELEMENT_NAME, WORKER_RUNNER_ID } from './config.ts'
import { assert } from '@std/assert/assert'

export function getElements() {
	const container = document.querySelector(CUSTOM_ELEMENT_NAME)
	assert(container instanceof HTMLElement)
	const workerRunner = document.getElementById(WORKER_RUNNER_ID)
	assert(workerRunner instanceof HTMLIFrameElement)

	const { shadowRoot } = container
	assert(shadowRoot != null)

	const textareaOuter = shadowRoot.querySelector('.textarea')
	assert(textareaOuter instanceof HTMLElement)
	const _textarea = shadowRoot.querySelector('[contenteditable]')
	assert(_textarea instanceof HTMLElement)
	const textarea = Object.defineProperty(
		Object.assign(_textarea, { value: '' }),
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
	const info = shadowRoot.querySelector('.info')
	assert(info instanceof HTMLElement)
	const infoMessage = shadowRoot.querySelector('.info-message')
	assert(infoMessage instanceof HTMLElement)
	const flags = shadowRoot.querySelector('.flags')
	assert(flags instanceof HTMLFormElement)

	const closeButton = shadowRoot.querySelector('.close-button')
	assert(closeButton instanceof HTMLElement)

	const optionsButton = shadowRoot.querySelector('.options-button')
	assert(optionsButton instanceof HTMLElement)

	return { container, workerRunner, textarea, textareaOuter, info, infoMessage, flags, optionsButton, closeButton }
}

export const elements = getElements()
