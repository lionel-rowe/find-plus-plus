import * as CONFIG from '../src/config.ts'
import { debounce } from '@std/async/debounce'
import { extname } from '@std/path'
import { assert } from '@std/assert/assert'

const DEBOUNCE_MS = 200

const buildJs = debounce(async () => {
	const { stdout } = await new Deno.Command(Deno.execPath(), {
		args: ['bundle', './src/main.ts'],
		stdout: 'piped',
	}).spawn().output()

	await Deno.writeTextFile(
		'./dist/main.js',
		`(async () => {\n${new TextDecoder().decode(stdout)}\n})()`,
	)
}, DEBOUNCE_MS)

const buildHtml = debounce(async (path: string) => {
	const html = await Deno.readTextFile(path)

	const cooked = html.replaceAll(/__(\w+)__/g, (_, key) => {
		const val = CONFIG[key as keyof typeof CONFIG]
		assert(typeof val === 'string', `${key} not found in CONFIG`)
		return val
	})

	await Deno.writeTextFile(
		'./src/_template.ts',
		`// Generated file, do not edit directly\n\nexport const template = ${JSON.stringify(cooked)}\n`,
	)
}, DEBOUNCE_MS)

buildJs()
buildHtml('./src/template.html')

for await (const event of Deno.watchFs('./src')) {
	if (event.kind === 'modify') {
		for (const path of event.paths) {
			const ext = extname(path)

			if (/^\.m?[jt]s$/.test(ext)) {
				buildJs()
			} else if (/^\.html?$/.test(ext)) {
				buildHtml(path)
			}
		}
	}
}
