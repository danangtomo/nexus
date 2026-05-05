import site, pathlib, re

p = None
for sp in site.getsitepackages():
    candidate = pathlib.Path(sp) / 'paddlex' / 'inference' / 'utils' / 'official_models.py'
    if candidate.exists():
        p = candidate
        break

if p is None:
    raise FileNotFoundError('official_models.py not found in any site-packages directory')

content = p.read_text(encoding='utf-8')
patched = re.sub(
    r'^import modelscope$',
    'try:\n    import modelscope\nexcept Exception:\n    modelscope = None',
    content,
    flags=re.MULTILINE,
)

if patched == content:
    print('No change needed (already patched or import not found)')
else:
    p.write_text(patched, encoding='utf-8')
    print('Patched:', p)
