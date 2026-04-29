"""
NEXUS — BiRefNet background removal sidecar
Page-based lifecycle: spawned on page enter, killed after processing or page leave.
Prefers INT8-quantized ONNX model for ~3× faster CPU inference and ~60% less RAM.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import os, io, sys, gc, base64, signal, threading, urllib.request
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
MODEL_DIR  = Path(os.environ.get('NEXUS_MODEL_DIR',
                  str(Path.home() / '.nexus' / 'models')))
MODEL_FP32 = MODEL_DIR / 'birefnet.onnx'
MODEL_INT8 = MODEL_DIR / 'birefnet_int8.onnx'
INPUT_SIZE = 1024
MEAN       = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD        = np.array([0.229, 0.224, 0.225], dtype=np.float32)
PORT       = int(os.environ.get('NEXUS_BIREFNET_PORT', '7862'))
SUPPORTED  = {'.jpg', '.jpeg', '.png', '.webp'}

# ── Graceful shutdown ─────────────────────────────────────────────────────────
# Electron sends SIGTERM on page-leave or app quit.
# We explicitly free the ONNX session before exit so the OS sees memory freed
# immediately rather than waiting for the GC sweep.

_session: Optional[ort.InferenceSession] = None


def _shutdown(signum=None, frame=None):
    global _session
    print('[BiRefNet] shutdown -- releasing model memory', flush=True)
    if _session is not None:
        del _session
        _session = None
    gc.collect()
    # Temp files younger than 1 h in MODEL_DIR (e.g. aborted .tmp downloads)
    try:
        import time
        cutoff = time.time() - 3600
        for f in MODEL_DIR.glob('*.tmp'):
            if f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0)


signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT,  _shutdown)

# ── Model loading ─────────────────────────────────────────────────────────────

_lock = threading.Lock()


def _download_model() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    tmp = str(MODEL_FP32) + '.tmp'
    print('[BiRefNet] downloading FP32 model (~224 MB)...', flush=True)

    def _hook(count, block, total):
        if total > 0:
            pct = min(100, count * block * 100 // total)
            print(f'\r[BiRefNet] {pct:3d}%', end='', flush=True)

    urllib.request.urlretrieve(MODEL_URL, tmp, _hook)
    print(flush=True)
    os.replace(tmp, str(MODEL_FP32))
    print('[BiRefNet] download complete.', flush=True)


def _quantize_to_int8() -> bool:
    """
    One-time dynamic INT8 weight quantisation.
    FP32 (~224 MB, ~8–12 s load) → INT8 (~64 MB, ~2–4 s load, ~3× faster inference).
    Uses ONNX Runtime's quantize_dynamic (weight-only, no calibration data needed).
    Returns True on success; False keeps the FP32 model as fallback.
    """
    print('[BiRefNet] quantising FP32 -> INT8 (one-time, ~30 s)...', flush=True)
    tmp = str(MODEL_INT8) + '.tmp'
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        quantize_dynamic(
            str(MODEL_FP32),
            tmp,
            weight_type=QuantType.QUInt8,
        )
        os.replace(tmp, str(MODEL_INT8))
        mb_fp32 = MODEL_FP32.stat().st_size / 1_048_576
        mb_int8 = MODEL_INT8.stat().st_size / 1_048_576
        print(f'[BiRefNet] INT8 model saved  '
              f'({mb_fp32:.0f} MB -> {mb_int8:.0f} MB, '
              f'{100 - mb_int8 / mb_fp32 * 100:.0f}% smaller)', flush=True)
        return True
    except Exception as exc:
        print(f'[BiRefNet] quantisation failed ({exc}) -- falling back to FP32', flush=True)
        Path(tmp).unlink(missing_ok=True)
        return False


def _resolve_model() -> Path:
    """
    Return the best available model path.
    Priority: INT8 cached → quantise from FP32 → FP32 fallback.
    Downloads FP32 from HuggingFace if neither exists.
    All paths are relative to NEXUS_MODEL_DIR so the app is portable.
    """
    if MODEL_INT8.exists():
        return MODEL_INT8
    if not MODEL_FP32.exists():
        _download_model()
    return MODEL_INT8 if _quantize_to_int8() else MODEL_FP32


def get_session() -> ort.InferenceSession:
    global _session
    if _session is not None:
        return _session
    with _lock:
        if _session is not None:
            return _session

        model_path = _resolve_model()
        print(f'[BiRefNet] loading ONNX session ({model_path.name})...', flush=True)

        opts = ort.SessionOptions()
        n    = min(os.cpu_count() or 4, 8)
        opts.intra_op_num_threads     = n
        opts.inter_op_num_threads     = n
        opts.execution_mode           = ort.ExecutionMode.ORT_PARALLEL
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        _session = ort.InferenceSession(
            str(model_path),
            sess_options=opts,
            providers=['CPUExecutionProvider'],
        )
        print('[BiRefNet] model ready.', flush=True)
        # Sentinel parsed by the Electron main process to fire birefnet:engine-ready IPC
        print('NEXUS_READY', flush=True)
        return _session


# ── Pre-processing ────────────────────────────────────────────────────────────

def letterbox(img: Image.Image) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """
    Scale image to fit INPUT_SIZE × INPUT_SIZE preserving aspect ratio,
    then centre-pad with neutral gray (114, 114, 114).
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
    padded, pad_info = letterbox(img)
    arr = np.array(padded, dtype=np.float32) / 255.0
    arr = (arr - MEAN) / STD
    arr = arr.transpose(2, 0, 1)[np.newaxis]
    return arr.astype(np.float32), pad_info


# ── Post-processing ───────────────────────────────────────────────────────────

def _guided_filter(guide: np.ndarray, mask: np.ndarray,
                   radius: int = 8, eps: float = 1e-3) -> np.ndarray:
    """
    Fast guided filter — box-filter approximation (He et al. 2013).
    Snaps soft mask edges to luminance boundaries in the original image,
    recovering fine detail (hair, fur, glass) lost in the coarse 1024-px mask.

    Equivalent to cv2.ximgproc.guidedFilter without the OpenCV dependency.
    guide : H×W float64 luminance [0, 1]
    mask  : H×W float64 alpha     [0, 1]
    """
    sz  = 2 * radius + 1
    I   = guide.astype(np.float64)
    p   = mask.astype(np.float64)
    mI  = uniform_filter(I,     sz)
    mp  = uniform_filter(p,     sz)
    mIp = uniform_filter(I * p, sz)
    mII = uniform_filter(I * I, sz)
    a   = (mIp - mI * mp) / (mII - mI * mI + eps)
    b   = mp - a * mI
    return np.clip(uniform_filter(a, sz) * I + uniform_filter(b, sz), 0.0, 1.0)


def postprocess(logits: np.ndarray, orig: Image.Image,
                pad_info: Tuple[int, int, int, int]) -> Image.Image:
    """
    logits   : (1, 1, 1024, 1024) float32 raw model output
    orig     : original PIL RGB image at native resolution
    pad_info : (pad_left, pad_top, fit_w, fit_h) from letterbox()
    Returns  : RGBA PIL image at original resolution.
    """
    pad_l, pad_t, fit_w, fit_h = pad_info
    orig_w, orig_h = orig.size

    # Sigmoid → [0, 1] probability
    prob = 1.0 / (1.0 + np.exp(-logits[0, 0].astype(np.float64)))

    # Crop letterbox padding to recover original aspect ratio
    prob = prob[pad_t: pad_t + fit_h, pad_l: pad_l + fit_w]

    # Upsample to original resolution (LANCZOS for sub-pixel accuracy)
    coarse = Image.fromarray((prob * 255).clip(0, 255).astype(np.uint8), 'L')
    coarse = coarse.resize((orig_w, orig_h), Image.LANCZOS)
    mask   = np.array(coarse, dtype=np.float64) / 255.0

    # Guided filter: snap mask edges to luminance boundaries
    rgb     = np.array(orig, dtype=np.float32) / 255.0
    lum     = (0.2126 * rgb[:, :, 0]
               + 0.7152 * rgb[:, :, 1]
               + 0.0722 * rgb[:, :, 2]).astype(np.float64)
    refined = _guided_filter(lum, mask, radius=8, eps=1e-3)

    # Trimap blend: keep model's confident hard decisions; guided filter for
    # the uncertain transition zone only (avoids background colour bleed-in).
    alpha    = np.where(mask > 0.90, 1.0,
               np.where(mask < 0.10, 0.0, refined))
    alpha_u8 = (alpha * 255).clip(0, 255).astype(np.uint8)
    rgba     = np.dstack([np.array(orig, dtype=np.uint8), alpha_u8])
    return Image.fromarray(rgba, 'RGBA')


# ── FastAPI app ───────────────────────────────────────────────────────────────

fastapi_app = FastAPI(title='NEXUS BiRefNet', version='2.0.0')
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['POST', 'GET'],
    allow_headers=['*'],
)


class RemoveBgRequest(BaseModel):
    image_path: str


class RemoveBgResponse(BaseModel):
    base64_png: str


@fastapi_app.get('/health')
def health():
    return {'ok': True, 'model_ready': _session is not None}


@fastapi_app.post('/remove-bg', response_model=RemoveBgResponse)
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
    outputs          = get_session().run(None, {'input_image': tensor})
    result           = postprocess(outputs[0], orig, pad_info)

    buf = io.BytesIO()
    result.save(buf, 'PNG', optimize=False)
    return RemoveBgResponse(base64_png=base64.b64encode(buf.getvalue()).decode())


@fastapi_app.on_event('startup')
def _warmup():
    """Load model in a background thread so cold-start latency is hidden."""
    threading.Thread(target=get_session, daemon=True).start()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    uvicorn.run(fastapi_app, host='127.0.0.1', port=PORT,
                log_level='warning', loop='asyncio')
