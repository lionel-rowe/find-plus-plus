import { flatten } from '@li/flatten-unflatten'
import { defaultOptions, TEMPLATE_ID } from './config.ts'
import { getFlags, setFlagDefaults } from './flagForm.ts'
import { getHtml } from './populateTemplate.ts'
import { optionsStorage } from './storage.ts'
import { escapeHtml, roundTo } from './utils.ts'
import { comboToPrettyHtml, eventToCombo } from './shortkeys.ts'
import manifest from '../dist/manifest.json' with { type: 'json' }

let dirty = false

const [html, commands] = await Promise.all([
	getHtml(),
	chrome.commands.getAll(),
])

function getElements() {
	const form = document.getElementById('form') as HTMLFormElement
	const elements = {
		status: document.getElementById('status') as HTMLElement,
		maxTimeout: document.querySelector('[name="max-timeout"]') as HTMLInputElement,
		maxMatches: document.querySelector('[name="max-matches"]') as HTMLInputElement,
		colors: {
			all: form.querySelector('[name="colors.all"]') as HTMLInputElement,
			current: form.querySelector('[name="colors.current"]') as HTMLInputElement,
			text: form.querySelector('[name="colors.text"]') as HTMLInputElement,
		},
		shortkeys: {
			_execute_action: form.querySelector('[name="shortkeys._execute_action"]') as HTMLInputElement,
			matchCase: form.querySelector('[name="shortkeys.matchCase"]') as HTMLInputElement,
			wholeWord: form.querySelector('[name="shortkeys.wholeWord"]') as HTMLInputElement,
			useRegex: form.querySelector('[name="shortkeys.useRegex"]') as HTMLInputElement,
			normalizeDiacritics: form.querySelector('[name="shortkeys.normalizeDiacritics"]') as HTMLInputElement,
			close: form.querySelector('[name="shortkeys.close"]') as HTMLInputElement,
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

	const options = structuredClone(defaultOptions)
	options.maxTimeout = Math.max((elements.maxTimeout.valueAsNumber * 1000) | 0, 100)
	options.maxMatches = Math.max(elements.maxMatches.valueAsNumber | 0, 1)
	options.flags = Object.fromEntries(
		Object.entries(options.flags).map(([_key, value]) => {
			const key = _key as keyof typeof options.flags
			return [key, { ...value, shortkey: elements.shortkeys[key].value, default: flags[key] }]
		}),
	) as typeof options.flags
	options.actions = Object.fromEntries(
		Object.entries(options.actions).map(([_key, value]) => {
			const key = _key as keyof typeof options.actions
			return [key, { ...value, shortkey: elements.shortkeys[key].value }]
		}),
	) as typeof options.actions

	options.colors.all = elements.colors.all.value
	options.colors.current = elements.colors.current.value
	options.colors.text = elements.colors.text.value

	await optionsStorage.set(flatten(options))

	elements.status.textContent = '✅ Options saved!'
	setTimeout(() => elements.status.textContent = '', 3000)
}

async function restoreOptions() {
	const options = await optionsStorage.get(structuredClone(defaultOptions))
	setFlagDefaults(elements.form, options)
	elements.maxTimeout.valueAsNumber = roundTo(options.maxTimeout / 1000, 1)
	elements.maxMatches.valueAsNumber = options.maxMatches

	elements.colors.all.value = options.colors.all
	elements.colors.current.value = options.colors.current
	elements.colors.text.value = options.colors.text

	const command = commands.find((c) => c.name === '_execute_action')!

	for (const [_key, el] of Object.entries(elements.shortkeys)) {
		const key = _key as keyof typeof elements.shortkeys

		const o = {
			...options.flags,
			...options.actions,
		}

		const _shortkey = Object.entries(o).find(([k]) => key === k)
		const shortkey: Parameters<typeof renderShortkeyField>[0] = key === '_execute_action'
			? {
				name: 'Open',
				description: manifest.commands._execute_action.description,
				id: el.id,
				combo: command.shortcut ?? '',
				isCommand: true,
			}
			: {
				name: _shortkey![1].name,
				description: _shortkey![1].description,
				id: el.id,
				combo: o[key].shortkey,
			}

		renderShortkeyField(shortkey, el)
	}
}

restoreOptions()

elements.form.addEventListener('change', () => dirty = true)

elements.form.addEventListener('submit', async (e) => {
	e.preventDefault()
	await saveOptions()
	await chrome.runtime.sendMessage('optionsUpdated')
	dirty = false
})

elements.form.addEventListener('reset', async (e) => {
	e.preventDefault()

	if (confirm('Are you sure you want to reset all options to the defaults?')) {
		await optionsStorage.clear()
		await chrome.runtime.sendMessage('optionsUpdated')
		dirty = false
		location.reload()
	}
})

globalThis.addEventListener('beforeunload', (e) => {
	if (dirty) {
		e.preventDefault()
	}
})

// https://stackoverflow.com/questions/45348255/assign-command-keyboard-shortcut-from-popup-or-options
// > `chrome://` URLs can be opened only via `chrome/WebExtensions` API methods,
// > but not via `<a href="...">` links directly.
document.body.addEventListener('click', (e) => {
	const { target } = e
	if (target instanceof HTMLAnchorElement && target.href) {
		const url = new URL(target.href)
		if (url.protocol === 'chrome:') {
			chrome.tabs.create({ url: target.href })
			e.preventDefault()
		}
	}
})

function renderComboHtml(combo: string) {
	return combo ? comboToPrettyHtml(combo) : `<span class="shortkey__unset">[${escapeHtml('Not set')}]</span>`
}

function renderShortkeyField(
	shortkey: { id: string; combo: string; name: string; description: string; isCommand?: boolean },
	input: HTMLInputElement,
) {
	const parent = input.closest('div')!
	parent.classList.add('shortkey')
	parent.innerHTML = `
		<div class="field shortkey__control" data-shortkey-item="${shortkey.id}">
			<label class="label" for="${shortkey.id}">${escapeHtml(shortkey.name)}
				<span class="shortkey__input">
					<span aria-hidden="true" class="shortkey__display">${renderComboHtml(shortkey.combo)}</span>
				</span>
			</label>
			<div class="details"><small>${escapeHtml(shortkey.description)}</small></div>
		</div>
	`

	const inputParent = parent.querySelector('.shortkey__input')!
	inputParent.insertAdjacentElement(
		'afterbegin',
		Object.assign(input, {
			spellcheck: false,
			autocomplete: 'off',
			value: shortkey.combo,
			id: shortkey.id,
			name: shortkey.id,
		}),
	)

	if (shortkey.isCommand) {
		input.disabled = true
		inputParent.insertAdjacentHTML(
			'beforeend',
			`<a href="chrome://extensions/shortcuts" target="_blank">${escapeHtml('Configure')}</a>`,
		)
	} else {
		const display = parent.querySelector('.shortkey__display')!

		input.addEventListener('click', () => {
			input.select()
		})

		input.addEventListener('keydown', (e) => {
			const combo = eventToCombo(e)

			// don't prevent normal keyboard navigation, page refresh, form submit, etc.
			if (/^(?:(?:Shift\+)?Tab|Enter|F5|Arrow(?:Up|Down|Left|Right)|Page(?:Up|Down)|Home|End)$/i.test(combo)) {
				return
			}

			e.preventDefault()
			if (combo.includes('+')) {
				input.value = combo
				display.innerHTML = renderComboHtml(combo)
			}
		})

		return parent
	}
}
