"""
NEXUS — Download and quantize BiRefNet ONNX model for installer bundling.
Usage: python python/background-remover/download_models.py [output_dir]

Produces:  <output_dir>/birefnet_int8.onnx  (~64 MB)
Called by CI before electron-builder so the model lands in extraResources/models/birefnet/.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import sys, os, urllib.request
from pathlib import Path

MODEL_URL = (
    'https://huggingface.co/onnx-community/BiRefNet-ONNX'
    '/resolve/main/onnx/model.onnx'
)


def download(target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)

    fp32 = target_dir / 'birefnet.onnx'
    int8 = target_dir / 'birefnet_int8.onnx'

    if int8.exists():
        print(f'[BiRefNet] INT8 model already at {int8} — skipping download.')
        return

    print(f'[BiRefNet] Downloading FP32 model (~224 MB) from HuggingFace...')

    def _hook(n, bs, total):
        if total > 0:
            pct = min(100, n * bs * 100 // total)
            print(f'\r[BiRefNet] {pct:3d}%', end='', flush=True)

    tmp = fp32.with_suffix('.tmp')
    urllib.request.urlretrieve(MODEL_URL, str(tmp), _hook)
    print()
    tmp.rename(fp32)
    print(f'[BiRefNet] FP32 download complete ({fp32.stat().st_size / 1_048_576:.0f} MB).')

    print('[BiRefNet] Quantizing FP32 → INT8 (one-time, ~30 s)...')
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        int8_tmp = int8.with_suffix('.tmp')
        quantize_dynamic(str(fp32), str(int8_tmp), weight_type=QuantType.QUInt8)
        int8_tmp.rename(int8)
        int8_mb = int8.stat().st_size / 1_048_576
        print(f'[BiRefNet] INT8 model ready: {int8}  ({int8_mb:.0f} MB)')
        fp32.unlink()
        print(f'[BiRefNet] FP32 removed to save space.')
    except Exception as exc:
        print(f'[BiRefNet] Quantization failed ({exc}) — keeping FP32 as fallback.')
        fp32.rename(int8.with_name('birefnet.onnx'))


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('python/dist/models/birefnet')
    download(target)
