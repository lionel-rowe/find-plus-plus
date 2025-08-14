import { defaultOptions } from './config.ts'
import { comboToPretty, eventToCombo } from './shortkeys.ts'
import { optionsStorage } from './storage.ts'

const elements = {
	shortkeyPretty: document.getElementById('shortkey-pretty') as HTMLInputElement,
	shortkey: document.getElementById('shortkey') as HTMLInputElement,
	status: document.getElementById('status') as HTMLElement,
	form: document.getElementById('form') as HTMLFormElement,
}

elements.shortkeyPretty.addEventListener('keydown', function (e) {
	const combo = eventToCombo(e)
	if (combo == null) return
	if (['Tab', 'Shift+Tab'].includes(combo)) return

	e.preventDefault()

	const pretty = comboToPretty(combo)
	this.value = pretty
	elements.shortkey.value = combo
})

async function saveOptions() {
	const shortkey = elements.shortkey.value

	await optionsStorage.set({ shortkey })

	elements.status.textContent = 'Options saved!'
	setTimeout(() => {
		elements.status.textContent = ''
	}, 2000)
}

async function restoreOptions() {
	const items = await optionsStorage.get(defaultOptions)

	elements.shortkey.value = items.shortkey
	elements.shortkeyPretty.value = comboToPretty(items.shortkey)
}

restoreOptions()

elements.form.addEventListener('submit', (e) => {
	e.preventDefault()
	saveOptions()
})
