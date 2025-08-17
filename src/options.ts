import { defaultOptions } from './config.ts'
import { comboToPrettyHtml, eventToCombo } from './shortkeys.ts'
import { optionsStorage } from './storage.ts'

const elements = {
	shortkeyPretty: document.getElementById('shortkey-pretty') as HTMLElement,
	shortkey: document.getElementById('shortkey') as HTMLInputElement,
	status: document.getElementById('status') as HTMLElement,
	form: document.getElementById('form') as HTMLFormElement,
}

elements.shortkeyPretty.addEventListener('paste', (e) => e.preventDefault())
elements.shortkeyPretty.addEventListener('input', (e) => e.preventDefault())
elements.shortkeyPretty.addEventListener('keydown', function (e) {
	const combo = eventToCombo(e)
	if (combo == null) return
	if (['Tab', 'Shift+Tab'].includes(combo)) return

	e.preventDefault()

	elements.shortkey.value = combo
	this.innerHTML = comboToPrettyHtml(combo)
})

async function saveOptions() {
	// const shortkey = elements.shortkey.value

	// await optionsStorage.set({ 'shortkeys.open': shortkey })

	// elements.status.textContent = 'Options saved!'
	// setTimeout(() => {
	// 	elements.status.textContent = ''
	// }, 2000)
}

async function restoreOptions() {
	// const items = await optionsStorage.get(defaultOptions)

	// elements.shortkey.value = items['shortkeys.open']
	// elements.shortkeyPretty.innerHTML = comboToPrettyHtml(items['shortkeys.open'])
}

restoreOptions()

elements.form.addEventListener('submit', (e) => {
	e.preventDefault()
	saveOptions()
})
