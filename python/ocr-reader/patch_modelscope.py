"""
Patch paddlex official_models.py to make `import modelscope` optional.
Non-fatal: exits 0 if the file is absent or already patched.
"""
import site, pathlib, re, sys

p = None
for sp in site.getsitepackages():
    candidate = pathlib.Path(sp) / 'paddlex' / 'inference' / 'utils' / 'official_models.py'
    if candidate.exists():
        p = candidate
        break

if p is None:
    print('official_models.py not found in site-packages — patch not needed, skipping.')
    sys.exit(0)

content = p.read_text(encoding='utf-8')
patched = re.sub(
    r'^import modelscope$',
    'try:\n    import modelscope\nexcept Exception:\n    modelscope = None',
    content,
    flags=re.MULTILINE,
)

if patched == content:
    print('No change needed (already patched or import not present).')
else:
    p.write_text(patched, encoding='utf-8')
    print('Patched:', p)
