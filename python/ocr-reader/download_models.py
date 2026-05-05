"""
NEXUS — Pre-download all MinerU / PaddleX OCR models for installer bundling.
Usage: python python/ocr-reader/download_models.py [output_dir]

Sets HF_HOME and PADDLE_PDX_MODEL_HOME to <output_dir>/hf and <output_dir>/paddlex,
then runs a warmup parse so MinerU downloads all required model weights there.

Called by CI before electron-builder so models land in extraResources/models/mineru/.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import sys, os, json, tempfile
from pathlib import Path


# Minimal valid single-page PDF — enough for MinerU's layout + OCR pipeline
_WARMUP_PDF = (
    b'%PDF-1.4\n'
    b'1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n'
    b'2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n'
    b'3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]'
    b'/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n'
    b'4 0 obj\n<</Length 44>>\nstream\n'
    b'BT /F1 12 Tf 72 720 Td (Hello World 123) Tj ET\n'
    b'endstream\nendobj\n'
    b'5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n'
    b'xref\n0 6\n'
    b'0000000000 65535 f \n'
    b'0000000009 00000 n \n'
    b'0000000058 00000 n \n'
    b'0000000115 00000 n \n'
    b'0000000274 00000 n \n'
    b'0000000370 00000 n \n'
    b'trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n441\n%%EOF'
)


def download(target_dir: Path) -> None:
    hf_home  = target_dir / 'hf'
    pdx_home = target_dir / 'paddlex'

    hf_home.mkdir(parents=True, exist_ok=True)
    pdx_home.mkdir(parents=True, exist_ok=True)

    # Set env vars BEFORE any mineru/paddle imports so they read the right paths
    os.environ['HF_HOME']               = str(hf_home)
    os.environ['PADDLE_PDX_MODEL_HOME'] = str(pdx_home)
    os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

    print(f'[OCR] Downloading models to: {target_dir}')
    print(f'      HF cache  : {hf_home}')
    print(f'      PaddleX   : {pdx_home}')

    # Write magic_pdf.json so MinerU uses CPU pipeline
    cfg_path = Path.home() / '.mineru' / 'magic_pdf.json'
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    if not cfg_path.exists():
        cfg_path.write_text(json.dumps({
            'device-mode':    'cpu',
            'layout-config':  {'model': 'doclayout_yolo'},
            'formula-config': {'mfd_model': 'yolo_v8_mfd', 'mfr_model': 'unimernet_small'},
            'table-config':   {'model': 'rapid_table', 'is_table_recog_enable': True, 'max_time': 400},
        }, indent=2))
        print('[OCR] Wrote default magic_pdf.json')

    # First try: use mineru-download CLI (MinerU 3.x)
    try:
        import subprocess
        print('[OCR] Running mineru-download (downloads all required models)...')
        result = subprocess.run(
            [sys.executable, '-m', 'mineru.tools.download_models',
             '--source', 'huggingface', '--ocr_langs', 'ch,en'],
            env=os.environ.copy(),
            check=False,
        )
        if result.returncode == 0:
            print('[OCR] mineru-download complete.')
            _print_size(target_dir)
            return
        print(f'[OCR] mineru-download exited {result.returncode} — falling back to warmup parse.')
    except Exception as e:
        print(f'[OCR] mineru-download not available ({e}) — using warmup parse.')

    # Fallback: run a warmup parse to trigger all model downloads
    print('[OCR] Running warmup parse to trigger model downloads...')
    try:
        from mineru.cli.common import do_parse
        with tempfile.TemporaryDirectory() as tmpdir:
            do_parse(
                output_dir=tmpdir,
                pdf_file_names=['warmup.pdf'],
                pdf_bytes_list=[_WARMUP_PDF],
                p_lang_list=['ch'],
                backend='pipeline',
                parse_method='auto',
                formula_enable=True,
                table_enable=True,
                f_draw_layout_bbox=False,
                f_draw_span_bbox=False,
                f_dump_md=False,
                f_dump_middle_json=False,
                f_dump_model_output=False,
                f_dump_orig_pdf=False,
                f_dump_content_list=True,
            )
        print('[OCR] Warmup parse complete — all models downloaded.')
    except Exception as e:
        print(f'[OCR] Warmup parse error: {e}')
        print('[OCR] Some models may download on first user request instead.')

    _print_size(target_dir)


def _print_size(target_dir: Path) -> None:
    total = sum(f.stat().st_size for f in target_dir.rglob('*') if f.is_file())
    print(f'[OCR] Total model size: {total / 1_048_576:.0f} MB at {target_dir}')


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('python/dist/models/mineru')
    download(target)
