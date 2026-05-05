"""
NEXUS — OCR / document parsing sidecar (MinerU pipeline)
Spawned on OCR page enter, killed on page leave.
Powered by MinerU (Apache-2.0) — CPU/ONNX pipeline, no GPU needed.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import os, sys, gc, signal, threading, tempfile, asyncio, json, glob as _glob, re as _re
from pathlib import Path
from typing import List
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ── Bundled model configuration ───────────────────────────────────────────────
# Must run BEFORE any mineru/paddlepaddle imports so the libraries read the
# correct model paths from env vars at import time.

def _configure_bundled_models() -> None:
    bundled = os.environ.get('NEXUS_BUNDLED_MODELS_DIR', '')
    if not bundled:
        return
    hf_home  = Path(bundled) / 'hf'
    pdx_home = Path(bundled) / 'paddlex'
    if hf_home.exists():
        os.environ['HF_HOME'] = str(hf_home)
        print(f'[OCR] Bundled HF models: {hf_home}', flush=True)
    if pdx_home.exists():
        os.environ['PADDLE_PDX_MODEL_HOME'] = str(pdx_home)
        print(f'[OCR] Bundled PaddleX models: {pdx_home}', flush=True)

    # Write magic_pdf.json if missing (required by MinerU at startup)
    cfg_path = Path.home() / '.mineru' / 'magic_pdf.json'
    if not cfg_path.exists():
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        cfg_path.write_text(json.dumps({
            'device-mode':    'cpu',
            'layout-config':  {'model': 'doclayout_yolo'},
            'formula-config': {'mfd_model': 'yolo_v8_mfd', 'mfr_model': 'unimernet_small'},
            'table-config':   {'model': 'rapid_table', 'is_table_recog_enable': True, 'max_time': 400},
        }, indent=2))

_configure_bundled_models()

# ── Config ────────────────────────────────────────────────────────────────────

PORT = int(os.environ.get('NEXUS_OCR_PORT', '7863'))

SUPPORTED_EXTENSIONS = {
    '.pdf',
    '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif',
    '.docx', '.pptx', '.xlsx',
}

LANGUAGES = {
    'ch':          'Chinese Simplified + English',
    'ch_server':   'Chinese Server (higher accuracy)',
    'ch_lite':     'Chinese Lite (faster)',
    'chinese_cht': 'Chinese Traditional',
    'en':          'English',
    'latin':       'Latin scripts (French / Spanish / German / Italian / Portuguese)',
    'arabic':      'Arabic',
    'cyrillic':    'Cyrillic',
    'east_slavic': 'East Slavic (Russian / Ukrainian / Belarusian)',
    'devanagari':  'Devanagari (Hindi / Sanskrit)',
    'japan':       'Japanese',
    'korean':      'Korean',
    'th':          'Thai',
    'el':          'Greek',
    'ta':          'Tamil',
    'te':          'Telugu',
    'ka':          'Kannada',
}

# ── Graceful shutdown ─────────────────────────────────────────────────────────

_ready = threading.Event()

def _shutdown(signum=None, frame=None):
    print('[OCR] shutdown', flush=True)
    gc.collect()
    sys.exit(0)

signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT,  _shutdown)

# ── MinerU pipeline ───────────────────────────────────────────────────────────

_pipeline_lock   = threading.Lock()
_pipeline_inited = False


def _ensure_pipeline():
    global _pipeline_inited
    if _pipeline_inited:
        return
    with _pipeline_lock:
        if _pipeline_inited:
            return
        print('[OCR] importing MinerU pipeline...', flush=True)
        from mineru.cli.common import do_parse  # noqa: F401
        _pipeline_inited = True
        print('[OCR] MinerU ready.', flush=True)


def _html_to_rows(html: str) -> List[List[str]]:
    from html.parser import HTMLParser

    class _P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.rows, self._row, self._buf, self._in = [], [], [], False

        def handle_starttag(self, tag, attrs):
            if tag == 'tr':   self._row = []
            elif tag in ('td', 'th'): self._buf, self._in = [], True

        def handle_endtag(self, tag):
            if tag in ('td', 'th'):
                self._row.append(''.join(self._buf).strip()); self._in = False
            elif tag == 'tr' and self._row:
                self.rows.append(self._row); self._row = []

        def handle_data(self, data):
            if self._in: self._buf.append(data)

    p = _P()
    p.feed(html or '')
    return p.rows


def _unescape_md(text: str) -> str:
    return _re.sub(r'\\([\\`*_{}\[\]()#+\-.!$|])', r'\1', text)


def _parse_content_list(content_list: list) -> dict:
    blocks, text_parts = [], []
    for item in (content_list or []):
        btype    = item.get('type', '')
        page_idx = item.get('page_idx', 0)

        if btype in ('text', 'title', 'list', 'paragraph'):
            text = _unescape_md(item.get('text', item.get('content', '')).strip())
            bbox = item.get('bbox')
            if text:
                blocks.append({
                    'type':    'title' if btype == 'title' else 'text',
                    'content': text,
                    'page_idx': page_idx,
                    'bbox':    bbox,
                })
                text_parts.append(text)

        elif btype == 'table':
            html    = item.get('table_body', item.get('html', ''))
            rows    = _html_to_rows(html)
            caps    = item.get('table_caption', [])
            caption = (caps[0] if caps else '').strip()
            bbox    = item.get('bbox')
            blocks.append({
                'type':    'table',
                'html':    html,
                'rows':    rows,
                'caption': caption,
                'page_idx': page_idx,
                'bbox':    bbox,
            })
            if rows:
                text_parts.append('\n'.join('\t'.join(r) for r in rows))

        elif btype in ('image', 'figure'):
            img_data_url = item.get('img_data_url', '')
            if not img_data_url:
                continue
            caps    = item.get('image_caption', [])
            caption = (' '.join(caps) if isinstance(caps, list) else caps or '').strip()
            bbox    = item.get('bbox')
            blocks.append({
                'type':         'image',
                'img_data_url': img_data_url,
                'caption':      caption,
                'page_idx':     page_idx,
                'bbox':         bbox,
            })

        elif btype == 'equation':
            img_data_url = item.get('img_data_url', '')
            text         = _unescape_md(item.get('text', '').strip())
            bbox         = item.get('bbox')
            if img_data_url or text:
                blocks.append({
                    'type':         'equation',
                    'img_data_url': img_data_url,
                    'text':         text,
                    'page_idx':     page_idx,
                    'bbox':         bbox,
                })

    tables     = [b for b in blocks if b['type'] == 'table']
    page_count = max((b['page_idx'] for b in blocks), default=-1) + 1
    return {
        'blocks':      blocks,
        'full_text':   '\n\n'.join(text_parts),
        'table_count': len(tables),
        'page_count':  page_count,
    }


_IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif'}

def _image_to_pdf_bytes(file_path: str) -> bytes:
    import io
    from PIL import Image
    img = Image.open(file_path)
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='PDF', resolution=72)  # 72 DPI → 1 pt per px, bbox coords match pixel coords
    return buf.getvalue()


def _run_parse_sync(file_path: str, lang: str, start_page: int, end_page: int,
                    force_ocr: bool = False, table_enable: bool = True, formula_enable: bool = True) -> dict:
    from mineru.cli.common import do_parse

    p   = Path(file_path)
    ext = p.suffix.lower()

    if ext in _IMAGE_EXTS:
        file_bytes = _image_to_pdf_bytes(file_path)
        filename   = p.stem + '.pdf'
    else:
        file_bytes = open(file_path, 'rb').read()
        filename   = p.name
    mineru_lang = lang if lang in LANGUAGES else 'ch'

    with tempfile.TemporaryDirectory() as tmpdir:
        do_parse(
            output_dir=tmpdir,
            pdf_file_names=[filename],
            pdf_bytes_list=[file_bytes],
            p_lang_list=[mineru_lang],
            backend='pipeline',
            parse_method='ocr' if force_ocr else 'auto',
            formula_enable=formula_enable,
            table_enable=table_enable,
            f_draw_layout_bbox=False,
            f_draw_span_bbox=False,
            f_dump_md=False,
            f_dump_middle_json=False,
            f_dump_model_output=False,
            f_dump_orig_pdf=False,
            f_dump_content_list=True,
            start_page_id=start_page,
            end_page_id=None if end_page < 0 else end_page,
        )

        matches = _glob.glob(
            os.path.join(tmpdir, '**', '*_content_list.json'), recursive=True
        )
        if not matches:
            return {'blocks': [], 'full_text': '', 'table_count': 0, 'page_count': 0}

        v2     = [m for m in matches if m.endswith('_content_list_v2.json')]
        target = v2[0] if v2 else matches[0]

        with open(target, 'r', encoding='utf-8') as f:
            content_list = json.load(f)

        # Embed images as base64 before the temp dir is deleted
        import base64 as _b64, mimetypes as _mime
        doc_dir = os.path.dirname(target)
        for item in content_list:
            img_rel = item.get('img_path', '')
            if img_rel and item.get('type') in ('image', 'figure', 'equation'):
                full = os.path.join(doc_dir, img_rel)
                if os.path.exists(full):
                    with open(full, 'rb') as f:
                        raw = f.read()
                    mime = _mime.guess_type(full)[0] or 'image/jpeg'
                    item['img_data_url'] = f"data:{mime};base64,{_b64.b64encode(raw).decode()}"

    return _parse_content_list(content_list)


def _warmup():
    _ready.set()
    print('NEXUS_READY', flush=True)

# ── FastAPI ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def _lifespan(app):
    threading.Thread(target=_warmup, daemon=True).start()
    yield

fastapi_app = FastAPI(title='NEXUS OCR', version='3.0.0', lifespan=_lifespan)
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['POST', 'GET'],
    allow_headers=['*'],
)


class ParseRequest(BaseModel):
    file_path:      str
    lang:           str  = 'ch'
    start_page:     int  = 0
    end_page:       int  = -1    # -1 = all pages
    force_ocr:      bool = False
    table_enable:   bool = True
    formula_enable: bool = True


@fastapi_app.get('/health')
def health():
    return {'ok': True, 'engine': 'mineru', 'pipeline_ready': _pipeline_inited}


@fastapi_app.get('/ready')
def ready():
    if not _ready.is_set():
        raise HTTPException(503, 'Starting up')
    return {'ok': True}


@fastapi_app.get('/languages')
def languages():
    return LANGUAGES


@fastapi_app.post('/parse')
async def parse_doc(req: ParseRequest):
    p = Path(req.file_path)
    if not p.exists():
        raise HTTPException(400, f'File not found: {p}')
    if p.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f'Unsupported format: {p.suffix}')
    _ensure_pipeline()
    try:
        return await asyncio.to_thread(
            _run_parse_sync, str(p), req.lang, req.start_page, req.end_page,
            req.force_ocr, req.table_enable, req.formula_enable
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f'MinerU parse failed: {e}')


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    uvicorn.run(fastapi_app, host='127.0.0.1', port=PORT,
                log_level='warning', loop='asyncio')
