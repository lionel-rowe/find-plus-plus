import { assert } from '@std/assert/assert'
import { GET_MATCHES_REQUEST, GET_MATCHES_RESPONSE, WORKER_READY } from './config.ts'
import { NotifyReadyEvent } from './events.ts'
import { workerFn, type WorkerMessageIds } from './worker.ts'

// TODO: scope to `globalThis.parent.origin` somehow if possible (not directly readable from this frame)
const targetOrigin = '*'

globalThis.parent.postMessage({ kind: NotifyReadyEvent.TYPE }, { targetOrigin })

const workerMessageIds: WorkerMessageIds = {
	WORKER_READY,
	GET_MATCHES_REQUEST,
	GET_MATCHES_RESPONSE,
}

const workerUrl = URL.createObjectURL(
	new Blob([`(${workerFn.toString()})(${JSON.stringify(workerMessageIds)})`], {
		type: 'application/javascript',
	}),
)

async function getWorker() {
	const worker = new Worker(workerUrl, { type: 'module' })

	await new Promise<void>((res) => {
		worker.addEventListener('message', (e) => {
			assert(e.data.kind === WORKER_READY)
			res()
		}, { once: true })
	})

	// forward all messages from worker
	worker.addEventListener('message', (e) => {
		globalThis.parent.postMessage(e.data, { targetOrigin })
	})

	return worker
}

let worker: Worker
let workerPromise = getWorker()

// forward all messages to worker
globalThis.addEventListener('message', async (e) => {
	if (e.data.kind === 'terminate') {
		worker?.terminate()
		workerPromise = getWorker()
		return
	}

	worker = await workerPromise
	worker.postMessage(e.data)
})
