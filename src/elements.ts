import { CUSTOM_ELEMENT_NAME, WORKER_RUNNER_ID } from './config.ts'
import { assert } from '@std/assert/assert'

export function getElements() {
	const container = window.document.querySelector(CUSTOM_ELEMENT_NAME)
	assert(container instanceof HTMLElement)
	const document = container.shadowRoot
	assert(document != null)
	const textareaOuter = document.querySelector('.textarea')
	assert(textareaOuter instanceof HTMLElement)
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

	const closeButton = document.querySelector('.close-button')
	assert(closeButton instanceof HTMLElement)

	const optionsButton = document.querySelector('.options-button')
	assert(optionsButton instanceof HTMLElement)

	const workerRunner = window.document.getElementById(WORKER_RUNNER_ID)
	assert(workerRunner instanceof HTMLIFrameElement)

	return { container, workerRunner, textarea, textareaOuter, info, infoMessage, flags, optionsButton, closeButton }
}

export const elements = getElements()
