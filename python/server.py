"""
NEXUS — BiRefNet background removal server
Runs on 127.0.0.1:7862 (configurable via NEXUS_BIREFNET_PORT).
ONNX Runtime (CPU) + guided-filter postprocessing for production-grade edges.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import os
import io
import sys
import base64
import threading
import urllib.request
from pathlib import Path
from typing import Tuple, Optional

import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ── Config ────────────────────────────────────────────────────────────────────

MODEL_URL  = ('https://huggingface.co/onnx-community/BiRefNet-ONNX'
              '/resolve/main/onnx/model.onnx')
MODEL_DIR  = Path(os.environ.get(
    'NEXUS_MODEL_DIR',
    str(Path.home() / '.nexus' / 'models')
))
MODEL_PATH = MODEL_DIR / 'birefnet.onnx'
INPUT_SIZE = 1024
MEAN       = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD        = np.array([0.229, 0.224, 0.225], dtype=np.float32)

SUPPORTED  = {'.jpg', '.jpeg', '.png', '.webp'}

# ── Model (lazy singleton, thread-safe) ───────────────────────────────────────

_session: Optional[ort.InferenceSession] = None
_lock     = threading.Lock()


def _download_model() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    tmp = str(MODEL_PATH) + '.tmp'
    print('[BiRefNet] downloading model (~224 MB)…', flush=True)

    def _hook(count, block, total):
        if total > 0:
            pct = min(100, count * block * 100 // total)
            print(f'\r[BiRefNet] {pct:3d}%', end='', flush=True)

    urllib.request.urlretrieve(MODEL_URL, tmp, _hook)
    print(flush=True)
    os.replace(tmp, str(MODEL_PATH))
    print('[BiRefNet] download complete.', flush=True)


def get_session() -> ort.InferenceSession:
    global _session
    if _session is not None:
        return _session
    with _lock:
        if _session is not None:
            return _session
        if not MODEL_PATH.exists():
            _download_model()

        print('[BiRefNet] loading ONNX session…', flush=True)
        opts = ort.SessionOptions()
        n    = min(os.cpu_count() or 4, 8)
        opts.intra_op_num_threads     = n
        opts.inter_op_num_threads     = n
        opts.execution_mode           = ort.ExecutionMode.ORT_PARALLEL
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        _session = ort.InferenceSession(
            str(MODEL_PATH),
            sess_options=opts,
            providers=['CPUExecutionProvider'],
        )
        print('[BiRefNet] model ready.', flush=True)
        return _session


# ── Pre-processing ────────────────────────────────────────────────────────────

def letterbox(img: Image.Image) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """
    Scale the image to fit inside INPUT_SIZE × INPUT_SIZE while preserving
    aspect ratio, then center-pad with neutral gray (114, 114, 114).
    Returns (padded_image, (pad_left, pad_top, fit_w, fit_h)).
    """
    w, h   = img.size
    scale  = INPUT_SIZE / max(w, h)
    fit_w  = round(w * scale)
    fit_h  = round(h * scale)
    pad_l  = (INPUT_SIZE - fit_w) // 2
    pad_t  = (INPUT_SIZE - fit_h) // 2

    resized = img.resize((fit_w, fit_h), Image.LANCZOS)
    canvas  = Image.new('RGB', (INPUT_SIZE, INPUT_SIZE), (114, 114, 114))
    canvas.paste(resized, (pad_l, pad_t))
    return canvas, (pad_l, pad_t, fit_w, fit_h)


def preprocess(img: Image.Image) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    """Returns NCHW float32 tensor + letterbox padding info."""
    padded, pad_info = letterbox(img)
    arr = np.array(padded, dtype=np.float32) / 255.0   # HWC [0, 1]
    arr = (arr - MEAN) / STD                            # ImageNet normalise
    arr = arr.transpose(2, 0, 1)[np.newaxis]            # → NCHW
    return arr.astype(np.float32), pad_info


# ── Post-processing ───────────────────────────────────────────────────────────

def _guided_filter(guide: np.ndarray, mask: np.ndarray,
                   radius: int = 8, eps: float = 1e-3) -> np.ndarray:
    """
    Fast guided filter (box-filter approximation, He et al. 2013).
    Aligns soft mask edges to luminance boundaries in the original image,
    recovering fine detail (hair, fur, feathers) lost in the coarse 1024-px mask.

    guide:  HxW float64 luminance [0, 1]
    mask:   HxW float64 alpha     [0, 1]
    Returns refined HxW float64 [0, 1].
    """
    sz = 2 * radius + 1
    I  = guide.astype(np.float64)
    p  = mask.astype(np.float64)

    mI   = uniform_filter(I,     sz)
    mp   = uniform_filter(p,     sz)
    mIp  = uniform_filter(I * p, sz)
    mII  = uniform_filter(I * I, sz)

    a = (mIp - mI * mp) / (mII - mI * mI + eps)
    b = mp - a * mI

    return np.clip(uniform_filter(a, sz) * I + uniform_filter(b, sz), 0.0, 1.0)


def postprocess(
    logits:   np.ndarray,
    orig:     Image.Image,
    pad_info: Tuple[int, int, int, int],
) -> Image.Image:
    """
    logits:   (1, 1, 1024, 1024) float32 — raw model output (logits, not probs)
    orig:     original PIL RGB image
    pad_info: (pad_left, pad_top, fit_w, fit_h) from letterbox()
    Returns:  RGBA PIL image at original resolution.
    """
    pad_l, pad_t, fit_w, fit_h = pad_info
    orig_w, orig_h = orig.size

    # 1. Sigmoid: logits → probability [0, 1]
    prob = (1.0 / (1.0 + np.exp(-logits[0, 0].astype(np.float64))))

    # 2. Crop the letterbox padding to recover original aspect ratio
    prob = prob[pad_t : pad_t + fit_h, pad_l : pad_l + fit_w]

    # 3. Upsample to original resolution (LANCZOS for sub-pixel accuracy)
    coarse = Image.fromarray((prob * 255).clip(0, 255).astype(np.uint8), 'L')
    coarse = coarse.resize((orig_w, orig_h), Image.LANCZOS)
    mask   = np.array(coarse, dtype=np.float64) / 255.0

    # 4. Guided filter: snap mask edges to luminance boundaries of original image
    rgb      = np.array(orig, dtype=np.float32) / 255.0
    lum      = (0.2126 * rgb[:, :, 0]
               + 0.7152 * rgb[:, :, 1]
               + 0.0722 * rgb[:, :, 2]).astype(np.float64)
    refined  = _guided_filter(lum, mask, radius=8, eps=1e-3)

    # 5. Trimap blend: keep model's confident hard decisions, use guided filter
    #    only for the uncertain transition zone (avoids background bleed-in).
    coarse_f = mask  # already float64
    alpha = np.where(coarse_f > 0.90, 1.0,
            np.where(coarse_f < 0.10, 0.0,
                     refined))

    # 6. Compose RGBA at original resolution
    alpha_u8 = (alpha * 255).clip(0, 255).astype(np.uint8)
    rgba     = np.dstack([np.array(orig, dtype=np.uint8), alpha_u8])
    return Image.fromarray(rgba, 'RGBA')


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title='NEXUS BiRefNet Server', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['POST', 'GET'],
    allow_headers=['*'],
)


class RemoveBgRequest(BaseModel):
    image_path: str


class RemoveBgResponse(BaseModel):
    base64_png: str


@app.get('/health')
def health():
    return {'ok': True, 'model_ready': _session is not None}


@app.post('/remove-bg', response_model=RemoveBgResponse)
def remove_bg(req: RemoveBgRequest):
    p = Path(req.image_path)

    if not p.exists():
        raise HTTPException(400, f'File not found: {p}')
    if p.suffix.lower() not in SUPPORTED:
        raise HTTPException(400, f'Unsupported format: {p.suffix}')

    try:
        orig = Image.open(p).convert('RGB')
    except Exception as exc:
        raise HTTPException(400, f'Cannot open image: {exc}')

    tensor, pad_info = preprocess(orig)

    session = get_session()
    outputs = session.run(None, {'input_image': tensor})

    result = postprocess(outputs[0], orig, pad_info)

    buf = io.BytesIO()
    result.save(buf, 'PNG', optimize=False)
    return RemoveBgResponse(base64_png=base64.b64encode(buf.getvalue()).decode())


@app.on_event('startup')
def _warmup():
    """Load model in background so the first request doesn't stall."""
    threading.Thread(target=get_session, daemon=True).start()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('NEXUS_BIREFNET_PORT', '7862'))
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='warning')
