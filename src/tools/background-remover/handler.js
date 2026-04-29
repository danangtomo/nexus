/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers'

export const INPUT_EXTS = ['jpg', 'jpeg', 'png', 'webp']

const MIME_MAP = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export function extOf(filePath) {
  return filePath.split('.').pop().toLowerCase()
}

// ── Model singleton ───────────────────────────────────────────────────────────
// RMBG-1.4 by BRIA AI — publicly accessible (non-gated), much better than ISNet.
// RMBG-2.0 is gated (requires HF login) so we use 1.4 which is open.
// ~176 MB first-time download, cached permanently by Chromium.
const MODEL_ID = 'briaai/RMBG-1.4'
const DTYPE    = 'fp32'

// RMBG-1.4 normalization: mean=0.5, std=1.0 (maps pixels to [-0.5, 0.5])
const PROCESSOR_CFG = {
  do_normalize:   true,
  do_pad:         false,
  do_rescale:     true,
  do_resize:      true,
  image_mean:     [0.5, 0.5, 0.5],
  image_std:      [1.0, 1.0, 1.0],
  resample:       2,
  rescale_factor: 1 / 255,
  size:           { width: 1024, height: 1024 },
}

let _model     = null
let _processor = null

async function loadModel(onProgress) {
  if (_model && _processor) return

  _model = await AutoModel.from_pretrained(MODEL_ID, {
    config:            { model_type: 'custom' },
    dtype:             DTYPE,
    progress_callback: (p) => {
      // p.status is 'initiate' | 'download' | 'progress' | 'done'
      if (onProgress && p.status === 'progress' && p.progress != null) {
        onProgress({ key: 'download', pct: Math.round(p.progress) })
      }
    },
  })

  _processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    config: PROCESSOR_CFG,
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function stripBackground(filePath, onProgress) {
  // Load model (cached after first run; progress fires only on first download)
  await loadModel(onProgress)

  const ext  = extOf(filePath)
  const mime = MIME_MAP[ext] ?? 'image/jpeg'

  // Read file as base64 via IPC → blob (avoids file:// COEP issues)
  const b64  = await window.nexus.readFile(filePath, 'base64')
  const raw  = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const blob = new Blob([raw], { type: mime })

  onProgress?.({ key: 'inference', pct: 0 })

  // Load into RawImage for the processor
  const blobUrl = URL.createObjectURL(blob)
  let image
  try {
    image = await RawImage.fromURL(blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }

  // Preprocess → 1024×1024 normalised tensor
  const { pixel_values } = await _processor(image)
  onProgress?.({ key: 'inference', pct: 30 })

  // Run inference
  const outputs = await _model({ input: pixel_values })
  onProgress?.({ key: 'inference', pct: 80 })

  // Grab the first output tensor regardless of what the ONNX graph named it
  const rawTensor = outputs.output ?? outputs.logits ?? Object.values(outputs)[0]
  if (!rawTensor) throw new Error('Model returned no output tensor.')

  // Shape is [1, 1, H, W] — read flat Float32Array directly to avoid squeeze() issues
  const tensorData = rawTensor.data                           // Float32Array, values 0–1
  const dims       = rawTensor.dims ?? rawTensor.shape ?? []
  const maskH      = dims[dims.length - 2] ?? 1024
  const maskW      = dims[dims.length - 1] ?? 1024

  // Write mask values into an OffscreenCanvas (grayscale → red channel used as alpha)
  // Sigmoid contrast boost (steepness=12) sharpens ambiguous mid-value edges on noisy images
  // while preserving soft transitions for hair/fur without hard-clipping them.
  const maskCanvas  = new OffscreenCanvas(maskW, maskH)
  const maskCtx     = maskCanvas.getContext('2d', { willReadFrequently: true })
  const maskImgData = maskCtx.createImageData(maskW, maskH)
  for (let i = 0; i < maskW * maskH; i++) {
    const raw = tensorData[i]
    // Hard-clip extremes; sigmoid centered at 0.55 (biased toward cutting bg)
    let sharpened
    if (raw < 0.15)      sharpened = 0
    else if (raw > 0.85) sharpened = 1
    else                 sharpened = 1 / (1 + Math.exp(-18 * (raw - 0.55)))
    const v = Math.round(sharpened * 255)
    maskImgData.data[i * 4]     = v
    maskImgData.data[i * 4 + 1] = v
    maskImgData.data[i * 4 + 2] = v
    maskImgData.data[i * 4 + 3] = 255
  }
  maskCtx.putImageData(maskImgData, 0, 0)

  // Scale mask to original image dimensions using bilinear interpolation via drawImage
  const scaledCanvas = new OffscreenCanvas(image.width, image.height)
  const scaledCtx    = scaledCanvas.getContext('2d', { willReadFrequently: true })
  scaledCtx.drawImage(maskCanvas, 0, 0, image.width, image.height)
  const scaledMask = scaledCtx.getImageData(0, 0, image.width, image.height)

  // Compose: draw original image then apply scaled mask as alpha channel
  const oc  = new OffscreenCanvas(image.width, image.height)
  const ctx = oc.getContext('2d', { willReadFrequently: true })
  const bmp = await createImageBitmap(blob)
  ctx.drawImage(bmp, 0, 0)
  bmp.close()

  const imgData = ctx.getImageData(0, 0, image.width, image.height)
  const pixels  = imgData.data
  for (let i = 0; i < image.width * image.height; i++) {
    pixels[i * 4 + 3] = scaledMask.data[i * 4]   // red channel = mask intensity
  }
  ctx.putImageData(imgData, 0, 0)

  onProgress?.({ key: 'inference', pct: 100 })

  const resultBlob = await oc.convertToBlob({ type: 'image/png' })
  return URL.createObjectURL(resultBlob)
}
