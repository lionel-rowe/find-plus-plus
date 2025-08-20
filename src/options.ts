import { defaultOptions, TEMPLATE_ID } from './config.ts'
import { getFlags, setFlagDefaults, updateShortkeyHints } from './flagForm.ts'
import { getHtml } from './populateTemplate.ts'
import { optionsStorage } from './storage.ts'
import { clamp } from './utils.ts'

const html = await getHtml()

function getElements() {
	const form = document.getElementById('form') as HTMLFormElement
	const elements = {
		shortkey: document.getElementById('shortkey') as HTMLInputElement,
		status: document.getElementById('status') as HTMLElement,
		maxTimeout: document.querySelector('[name=max-timeout]') as HTMLInputElement,
		maxMatches: document.querySelector('[name=max-matches]') as HTMLInputElement,
		colors: {
			all: form.querySelector('[name="colors.all"]') as HTMLInputElement,
			current: form.querySelector('[name="colors.current"]') as HTMLInputElement,
			text: form.querySelector('[name="colors.text"]') as HTMLInputElement,
		},
	}

	return { form, ...elements }
}

const elements = getElements()

const template = new DOMParser().parseFromString(html, 'text/html').getElementById(TEMPLATE_ID) as HTMLTemplateElement

const flagsSource = template.content.querySelector('form.flags')!
const flagsTarget = document.getElementById('default-flags-container')!
for (const className of flagsSource.classList) flagsTarget.classList.add(className)
flagsTarget.append(...flagsSource.children)

async function saveOptions() {
	const flags = getFlags(elements.form)

	await optionsStorage.set({
		maxTimeout: Math.max(elements.maxTimeout.valueAsNumber | 0, 100),
		maxMatches: Math.max(elements.maxMatches.valueAsNumber | 0, 100),

		'defaults.useRegex': flags.regexSyntax,
		'defaults.matchCase': flags.matchCase,
		'defaults.wholeWord': flags.wholeWord,

		'colors.all': elements.colors.all.value,
		'colors.current': elements.colors.current.value,
		'colors.text': elements.colors.text.value,
	})

	elements.status.textContent = 'Options saved!'
	setTimeout(() => {
		elements.status.textContent = ''
	}, 2000)
}

async function restoreOptions() {
	const options = await optionsStorage.get(defaultOptions)
	setFlagDefaults(elements.form, options)
	elements.maxTimeout.valueAsNumber = options.maxTimeout
	elements.maxMatches.valueAsNumber = options.maxMatches

	elements.colors.all.value = options['colors.all']
	elements.colors.current.value = options['colors.current']
	elements.colors.text.value = options['colors.text']

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

elements.form.addEventListener('reset', async (e) => {
	e.preventDefault()

	if (confirm('Are you sure you want to reset all options to the defaults?')) {
		await optionsStorage.clear()
		location.reload()
	}
})
