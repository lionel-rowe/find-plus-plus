import { serveDir } from '@std/http/file-server'

export function serveDemo() {
	return Deno.serve(async (req) => {
		const res = await serveDir(req, { fsRoot: './demo', quiet: true })

		// modified from default logging of `serveDir`
		const d = new Date().toISOString()
		const dateFmt = `[${d.slice(0, 10)} ${d.slice(11, 19)}]`
		const s = `${dateFmt} [${req.method}] ${req.url} ${res.status}`

		// deno-lint-ignore no-console
		console.info(s)
		return res
	})
}
