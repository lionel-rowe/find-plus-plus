import { debounce } from '@std/async/debounce'
import { extname, join } from '@std/path'
import { format } from '@std/fmt/bytes'
import { cyan, gray } from '@std/fmt/colors'
import { _prefix } from '../src/_prefix.ts'
import { serveDemo } from './serveDemo.ts'
import { delay } from '@std/async/delay'

const IN_DIR = 'src'
const OUT_DIR = 'dist'

const DEBOUNCE_MS = 200

const entryPoints: { fileName: string; context?: 'main' | 'isolated' | 'worker'; esm?: boolean }[] = [
	{ fileName: 'main.ts', context: 'main' },
	{ fileName: 'content.ts' },
	{ fileName: 'background.ts' },
	{ fileName: 'options.ts', esm: true },
	{ fileName: 'worker.ts', esm: true, context: 'worker' },
	{ fileName: 'workerRunner.ts', esm: true },
]

const IS_PROD = Boolean(Deno.env.get('PROD'))

const buildJs = debounce(async () => {
	const infos: { outPath: string; size: number }[] = []
	for (const { fileName, context = 'isolated', esm } of entryPoints) {
		const path = join(IN_DIR, fileName)
		// assert exists
		await Deno.stat(path)

		const args = ['bundle']
		args.push('--platform', 'browser')
		if (!esm) args.push('--format', 'iife')
		if (IS_PROD) args.push('--minify')

		// // TODO: maybe add?
		// args.push('--code-splitting')

		args.push(path)

		const outPath = join(OUT_DIR, fileName.replace(/\.ts$/, '.js'))

		const { stdout, stderr } = await new Deno.Command(
			Deno.execPath(),
			{ args, stdout: 'piped', stderr: 'piped' },
		).spawn().output()

		const wrap: [string, string] = esm ? ['', ''] : ['{\n', '}\n']

		const url = context === 'isolated'
			? 'chrome.runtime.getURL("")'
			: esm
			? 'import.meta.url'
			: context === 'worker'
			? 'location.origin'
			: 'document.currentScript.src'

		const blob = new Blob(
			stdout.length === 0 ? [] : [
				wrap[0],
				`const APP_BASE_URL = new URL("/", ${url});\n`,
				`const APP_NS = ${JSON.stringify(_prefix)} + APP_BASE_URL.hostname;\n`,
				stdout,
				wrap[1],
			],
		)

		await Deno.writeFile(outPath, blob.stream())

		if (stderr.length > 0) {
			const lines = new TextDecoder().decode(stderr).split('\n')
			for (const line of lines) {
				if (line.includes('experimental')) continue
				new Blob([line]).stream().pipeTo(
					Deno.stderr.writable,
					{ preventClose: true },
				)
			}
		}

		infos.push({ outPath, size: blob.size })
	}
	const filePathLen = Math.max(...infos.map(({ outPath }) => outPath.length))

	const total = infos.reduce((a, b) => a + b.size, 0)

	const outLines = [
		[],
		...infos.map(({ outPath, size }) => [cyan(outPath.padEnd(filePathLen)), gray(format(size))]),
		['Total size'.padEnd(filePathLen), format(total)],
	]
		.map((cols) => cols.join(' '.repeat(4)))

	for (const line of outLines) {
		await delay(10)
		// deno-lint-ignore no-console
		console.info(line)
	}
}, DEBOUNCE_MS)

buildJs()
if (!IS_PROD) {
	serveDemo()
	await watch()
}

async function watch() {
	for await (const event of Deno.watchFs(IN_DIR)) {
		if (event.kind === 'modify') {
			const hasJsPaths = event.paths.some((path) => /^\.m?[jt]s$/.test(extname(path)))
			if (hasJsPaths) buildJs()
		}
	}
}
