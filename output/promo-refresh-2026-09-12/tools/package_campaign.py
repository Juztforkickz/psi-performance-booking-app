"""Package verified deliverables only; preserve the earlier dated ZIP."""
from pathlib import Path
import hashlib, json, zipfile

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT / 'preview/media-validation.json').read_text(encoding='utf-8'))
if len(report) != 10:
    raise RuntimeError('Expected the complete ten-video verification report.')
for entry in report:
    path = ROOT / entry['file']
    if entry['full_decode'] != 'passed' or entry['audio'] != 'silent':
        raise RuntimeError(f'Incomplete verification: {path.name}')
    with path.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != entry['sha256']:
        raise RuntimeError(f'Video changed after verification: {path.name}')

lines = [
    '# Final media validation — 13 September 2026', '',
    'All ten MP4 files passed full FFmpeg decoding with -xerror, expected duration/dimensions and absence of an audio stream. Matching JPEG covers were freshly extracted and checked for nonempty output.', '',
    'Visual inspection of frames from all three completed cuts confirmed the approved launch opening, all ten partner names/logos together without clipping, the source dyno chart/results/car, and no stretching. The 4:5 dyno scene intentionally pans from the complete heading at the start through graph/results to the car at the end. The vertical versions show the complete poster with gentle motion.', '',
    'The restored lossless dyno master scored SSIM 1.000000 against the screenshot across the original chart, result panels, slogan and upper car region. The final standalone PNG is exported from that master. Reproduction and prompt details are in DYNO-RESTORATION.md.', '',
    'Video exports are silent for licensed music to be added within the social platform. These checks cover local media files, not public app-store or website availability.', '',
    '| File | Duration | Size | SHA-256 |',
    '| --- | --- | --- | --- |',
]
for item in report:
    lines.append(f"| {item['file']} | {item['duration']} | {item['width']} × {item['height']} | `{item['sha256']}` |")
(ROOT / 'MEDIA-VALIDATION.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

docs = ['START-HERE.md', 'MEDIA-VALIDATION.md', 'OPENING-REVISION.md',
        'PARTNER-REVISION.md', 'DYNO-RESTORATION.md', 'OPENING-ARTWORK-PROMPTS.md']
files = [ROOT / name for name in docs]
for folder in ['social', 'website']:
    files.extend(path for path in (ROOT / folder).rglob('*') if path.is_file())
archive = ROOT / 'PSI-App-Promo-Pack-2026-09-13-Martini-Black.zip'
if archive.exists():
    raise FileExistsError('The final dated ZIP already exists; inspect rather than overwrite.')
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for path in sorted(files):
        bundle.write(path, path.relative_to(ROOT).as_posix())
with zipfile.ZipFile(archive) as bundle:
    bad = bundle.testzip()
    if bad:
        raise RuntimeError(f'ZIP validation failed: {bad}')
    for path in files:
        if hashlib.sha256(bundle.read(path.relative_to(ROOT).as_posix())).digest() != hashlib.sha256(path.read_bytes()).digest():
            raise RuntimeError(f'ZIP contents differ: {path}')
print(f'Packaged and verified {len(files)} files: {archive}')
