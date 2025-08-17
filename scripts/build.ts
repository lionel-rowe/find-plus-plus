import { debounce } from '@std/async/debounce'
import { extname, join } from '@std/path'
import { format } from '@std/fmt/bytes'
import { cyan, gray } from '@std/fmt/colors'
import { concat } from '@std/bytes'
import { _prefix } from '../src/_prefix.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function concatAsBytes(t: TemplateStringsArray, ...args: (Uint8Array | string)[]) {
	const all = t.flatMap((str, i) => i === t.length - 1 ? str : [str, args[i]])
	return concat(all.map((arg) => typeof arg === 'string' ? encoder.encode(arg) : arg))
}

const IN_DIR = 'src'
const OUT_DIR = 'dist'

const DEBOUNCE_MS = 200

const MAIN_WORLD_ENTRY_POINTS = ['main.ts']
const ISOLATED_WORLD_ENTRY_POINTS = ['content.ts', 'background.ts', 'options.ts']
const ENTRY_POINTS = [...MAIN_WORLD_ENTRY_POINTS, ...ISOLATED_WORLD_ENTRY_POINTS]

const IS_PROD = Boolean(Deno.env.get('PROD'))

const buildJs = debounce(async () => {
	const infos: { outPath: string; size: number }[] = []
	for (const entry of ENTRY_POINTS) {
		const path = join(IN_DIR, entry)
		// ensure exists
		await Deno.stat(path)

		const args = ['bundle']
		if (IS_PROD) args.push('--minify')
		args.push('--platform', 'browser')
		args.push(path)

		const outPath = join(OUT_DIR, entry.replace(/\.ts$/, '.js'))

		const { stdout } = await new Deno.Command(Deno.execPath(), { args, stdout: 'piped' }).spawn().output()
		const isEsm = MAIN_WORLD_ENTRY_POINTS.includes(entry)

		const wrap: [string, string] = isEsm ? ['', ''] : ['void (async () => {\n', '})()\n']

		const id = isEsm ? 'new URL(import.meta.url).hostname' : 'chrome.runtime.id'
		const bytes = stdout.length
			? concatAsBytes`${wrap[0]}const APP_ID = ${JSON.stringify(_prefix)} + ${id};\n${stdout}${wrap[1]}`
			: stdout

		await Deno.writeTextFile(outPath, decoder.decode(bytes))

		infos.push({ outPath, size: bytes.length })
	}
	const filePathLen = Math.max(...infos.map(({ outPath }) => outPath.length))

	console.info(
		infos
			.map(({ outPath, size }) => `${cyan(outPath.padEnd(filePathLen))} ${gray(format(size))}`)
			.join('\n'),
	)
}, DEBOUNCE_MS)

buildJs()
if (!IS_PROD) await watch()

async function watch() {
	for await (const event of Deno.watchFs(IN_DIR)) {
		if (event.kind === 'modify') {
			const hasJsPaths = event.paths.some((path) => /^\.m?[jt]s$/.test(extname(path)))
			if (hasJsPaths) buildJs()
		}
	}
}
