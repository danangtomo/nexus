"""
NEXUS — BiRefNet INT8 quantisation script
Run once before packaging or to pre-build the INT8 model on a dev machine.

Usage:
  python quantize.py
  python quantize.py --model-dir /path/to/models

The server.py already auto-quantises on first use, so this script is only
needed if you want to pre-build the INT8 model (e.g. for bundling into extraResources).
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import argparse
import os
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description='Quantise BiRefNet FP32 → INT8')
    parser.add_argument(
        '--model-dir',
        default=str(Path.home() / '.nexus' / 'models'),
        help='Directory containing birefnet.onnx (default: ~/.nexus/models)',
    )
    parser.add_argument(
        '--keep-fp32',
        action='store_true',
        help='Keep the FP32 model after quantisation (default: keep it)',
    )
    args = parser.parse_args()

    model_dir = Path(args.model_dir)
    fp32      = model_dir / 'birefnet.onnx'
    int8      = model_dir / 'birefnet_int8.onnx'

    if int8.exists():
        print(f'INT8 model already exists: {int8}')
        print(f'Size: {int8.stat().st_size / 1_048_576:.1f} MB')
        return

    if not fp32.exists():
        print(f'FP32 model not found: {fp32}')
        print('Run the app, navigate to Background Remover, and let it download the model first.')
        sys.exit(1)

    print(f'Source : {fp32}  ({fp32.stat().st_size / 1_048_576:.1f} MB)')
    print(f'Target : {int8}')
    print('Quantising (dynamic INT8 weight quantisation)…')

    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        print('onnxruntime not installed. Run: pip install onnxruntime')
        sys.exit(1)

    tmp = str(int8) + '.tmp'
    try:
        quantize_dynamic(
            str(fp32),
            tmp,
            weight_type=QuantType.QUInt8,
        )
        os.replace(tmp, str(int8))
    except Exception as exc:
        Path(tmp).unlink(missing_ok=True)
        print(f'Quantisation failed: {exc}')
        sys.exit(1)

    mb_fp32 = fp32.stat().st_size / 1_048_576
    mb_int8 = int8.stat().st_size / 1_048_576
    saving  = 100 - mb_int8 / mb_fp32 * 100
    print(f'\nDone!  {mb_fp32:.1f} MB → {mb_int8:.1f} MB  ({saving:.0f}% smaller)')
    print('Expected speed-up on CPU: ~2–3× faster inference, ~60% less RAM.')


if __name__ == '__main__':
    main()
