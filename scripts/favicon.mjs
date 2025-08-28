// @ts-check
// https://stackoverflow.com/questions/74026755/convert-svg-to-image-jpeg-png-etc-in-the-browser

const $container = /** @type {HTMLElement} */ (document.getElementById('svg-container'))
const $src = /** @type {HTMLImageElement} */ ($container.querySelector('img'))
const $holder = /** @type {HTMLElement} */ (document.getElementById('img-container'))
const $label = /** @type {HTMLElement} */ (document.getElementById('img-format'))

/** @this {HTMLButtonElement} */
async function convertSVGtoImg() {
	const format = this.dataset.format ?? 'png'
	$label.textContent = format

	$holder.textContent = ''

	if (!$src.complete) {
		await new Promise((res, rej) => {
			$src.onload = res
			$src.onerror = rej
		})
	}

	const $canvas = document.createElement('canvas')
	$canvas.width = $src.naturalWidth
	$canvas.height = $src.naturalHeight
	const ctx = /** @type {CanvasRenderingContext2D} */ ($canvas.getContext('2d'))
	ctx.drawImage($src, 0, 0, $src.naturalWidth, $src.naturalHeight)

	const dataURL = $canvas.toDataURL(`image/${format}`, 1.0)

	const $trg = document.createElement('img')
	$trg.src = dataURL
	$holder.appendChild($trg)
}

for (const $btn of /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-format]')])) {
	$btn.addEventListener('click', convertSVGtoImg)
}
