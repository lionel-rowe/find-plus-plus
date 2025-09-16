// @ts-check
// https://stackoverflow.com/questions/74026755/convert-svg-to-image-jpeg-png-etc-in-the-browser

/** @this {HTMLButtonElement} */
async function convertSvgToImg() {
	const img = await ready(/** @type {HTMLImageElement} */ (document.querySelector('#svg-img')))

	const format = this.dataset.format ?? 'png'
	const canvas = document.createElement('canvas')
	canvas.width = img.naturalWidth
	canvas.height = img.naturalHeight
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
	ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight)

	/** @type {Promise<Blob>} */
	const blobPromise = new Promise((res) =>
		canvas.toBlob(
			(blob) => res(/** @type {Blob} */ (blob)),
			`image/${format}`,
		)
	)

	download(await blobPromise, `favicon.${format}`)
}

for (const btn of /** @type {Iterable<HTMLButtonElement>} */ (document.querySelectorAll('[data-format]'))) {
	btn.addEventListener('click', convertSvgToImg)
}

/**
 * @overload @param {Blob} file @param {string} name @return {void}
 * @overload @param {File} file @return {void}
 * @param {Blob} file @param {string} [name]
 */
function download(file, name) {
	const a = document.createElement('a')
	const href = URL.createObjectURL(file)
	try {
		a.href = href
		a.download = name ?? (file instanceof File ? file.name : '')
		a.hidden = true
		document.body.append(a)
		a.click()
	} finally {
		URL.revokeObjectURL(href)
		a.remove()
	}
}

/**
 * @param {HTMLImageElement} img
 * @returns {Promise<HTMLImageElement>}
 */
function ready(img) {
	return new Promise((res, rej) => {
		if (img.complete) return res(img)
		img.addEventListener('load', () => res(img))
		img.addEventListener('error', (e) => rej(e.error))
	})
}
