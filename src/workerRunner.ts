import { assert } from '@std/assert/assert'
import { GET_MATCHES_REQUEST, WORKER_READY } from './config.ts'
import { CheckReadyEvent, NotifyReadyEvent } from './events.ts'

// TODO: scope to `globalThis.parent.origin` somehow if possible (not directly readable from this frame)
const targetOrigin = '*'

function notifyReady() {
	globalThis.parent.postMessage({ kind: NotifyReadyEvent.TYPE }, { targetOrigin })
}

notifyReady()

const workerUrl = '/worker.js'

async function getWorker() {
	const worker = new Worker(workerUrl, { type: 'module' })

	return await new Promise<Worker>((res) => {
		worker.addEventListener('message', (e) => {
			assert(e.data.kind === WORKER_READY)
			// forward all messages from worker
			worker.addEventListener('message', (e) => {
				globalThis.parent.postMessage(e.data, { targetOrigin })
			})
			res(worker)
		}, { once: true })
	})
}

let worker: Worker
let workerPromise = getWorker()

// forward all messages to worker
globalThis.addEventListener('message', async (e) => {
	switch (e.data.kind) {
		case 'restart': {
			worker?.terminate()
			workerPromise = getWorker()
			break
		}
		case CheckReadyEvent.TYPE: {
			notifyReady()
			break
		}
		case GET_MATCHES_REQUEST: {
			worker = await workerPromise
			worker.postMessage(e.data)
			break
		}
		default: {
			// deno-lint-ignore no-console
			console.error('Unknown message in workerRunner:', e.data)
		}
	}
})
