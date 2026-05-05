"""
NEXUS — Download and quantize BiRefNet ONNX model for installer bundling.
Usage: python python/background-remover/download_models.py [output_dir]

Produces:  <output_dir>/birefnet_int8.onnx  (~64 MB)
Called by CI before electron-builder so the model lands in extraResources/models/birefnet/.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import sys, shutil
from pathlib import Path

REPO_ID  = 'onnx-community/BiRefNet-ONNX'
FILENAME = 'onnx/model.onnx'


def download(target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)

    fp32 = target_dir / 'birefnet.onnx'
    int8 = target_dir / 'birefnet_int8.onnx'

    if int8.exists():
        print(f'[BiRefNet] INT8 model already at {int8} — skipping.')
        return

    if not fp32.exists():
        print(f'[BiRefNet] Downloading FP32 model from {REPO_ID} ...')
        # huggingface_hub handles chunked transfer, retries, and resume automatically
        from huggingface_hub import hf_hub_download
        cache_dir = target_dir / '.hf_cache'
        dl_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=FILENAME,
            cache_dir=str(cache_dir),
        )
        shutil.copy2(dl_path, fp32)
        print(f'[BiRefNet] FP32 downloaded: {fp32.stat().st_size / 1_048_576:.0f} MB')
        if cache_dir.exists():
            shutil.rmtree(cache_dir)

    print('[BiRefNet] Quantizing FP32 → INT8 (one-time, ~30 s)...')
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        int8_tmp = int8.with_suffix('.tmp')
        quantize_dynamic(str(fp32), str(int8_tmp), weight_type=QuantType.QUInt8)
        int8_tmp.rename(int8)
        print(f'[BiRefNet] INT8 model ready: {int8.stat().st_size / 1_048_576:.0f} MB — {int8}')
        fp32.unlink(missing_ok=True)
    except Exception as exc:
        print(f'[BiRefNet] Quantization failed ({exc}) — keeping FP32 as fallback.')


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('python/dist/models/birefnet')
    download(target)
