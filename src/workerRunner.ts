import { assert } from '@std/assert/assert'
import { WORKER_READY } from './config.ts'
import { NotifyReadyEvent } from './events.ts'

// TODO: scope to `globalThis.parent.origin` somehow if possible (not directly readable from this frame)
const targetOrigin = '*'

globalThis.parent.postMessage({ kind: NotifyReadyEvent.TYPE }, { targetOrigin })

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
	if (e.data.kind === 'restart') {
		worker?.terminate()
		workerPromise = getWorker()
		return
	}

	worker = await workerPromise
	worker.postMessage(e.data)
})
