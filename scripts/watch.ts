import { debounce } from '@std/async/debounce'
import { extname, resolve } from '@std/path'

const DEBOUNCE_MS = 200

const ENTRY_POINTS = ['./src/main.ts', './src/init.ts', './src/background.ts', './src/options.ts'].map((x) =>
	resolve(x)
)

const buildJs = debounce(async () => {
	await new Deno.Command(Deno.execPath(), {
		args: ['bundle', /* '--minify',  */ '--outdir', './dist', ...ENTRY_POINTS],
	}).spawn().output()
}, DEBOUNCE_MS)

buildJs()

for await (const event of Deno.watchFs('./src')) {
	if (event.kind === 'modify') {
		const hasJsPaths = event.paths.some((path) => /^\.m?[jt]s$/.test(extname(path)))
		if (hasJsPaths) buildJs()
	}
}
