import { defaultOptions, TEMPLATE_ID } from './config.ts'
import { getFlags, setFlagDefaults, updateShortkeyHints } from './flagForm.ts'
import { html } from './populateTemplate.ts'
import { optionsStorage } from './storage.ts'

const elements = {
	shortkey: document.getElementById('shortkey') as HTMLInputElement,
	status: document.getElementById('status') as HTMLElement,
	form: document.getElementById('form') as HTMLFormElement,
}

const template = new DOMParser().parseFromString(html, 'text/html').getElementById(TEMPLATE_ID) as HTMLTemplateElement

const flagsSource = template.content.querySelector('form.flags')!
const flagsTarget = document.getElementById('default-flags-container')!
for (const className of flagsSource.classList) flagsTarget.classList.add(className)
flagsTarget.append(...flagsSource.children)

async function saveOptions() {
	const flags = getFlags(elements.form)

	await optionsStorage.set({
		'defaults.useRegex': flags.regexSyntax,
		'defaults.matchCase': flags.matchCase,
		'defaults.wholeWord': flags.wholeWord,
	})

	elements.status.textContent = 'Options saved!'
	setTimeout(() => {
		elements.status.textContent = ''
	}, 2000)
}

async function restoreOptions() {
	const options = await optionsStorage.get(defaultOptions)
	setFlagDefaults(elements.form, options)

	const commands = await chrome.commands.getAll()
	const shortkeys = Object.fromEntries(
		commands.map(({ name, shortcut, description }) => [name, { combo: shortcut, description }]),
	)
	updateShortkeyHints(elements.form, shortkeys, false)
}

restoreOptions()

elements.form.addEventListener('submit', (e) => {
	e.preventDefault()
	saveOptions()
})
