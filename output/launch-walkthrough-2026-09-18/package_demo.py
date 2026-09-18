import hashlib, json, shutil, struct, subprocess
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent
DEST = ROOT / 'public/campaign-videos/launch-walkthrough-2026-09-18'
FF = ROOT / 'output/promo-refresh-2026-09-12/tools/ffmpeg.exe'
DEST.mkdir(parents=True, exist_ok=True)
entries = []
for name, title, duration in [('PSI-Animated-Full-Walkthrough', 'Full walkthrough', '1 minute 40 seconds'), ('PSI-Animated-Demo-30s', 'Short advertising cut', '30 seconds')]:
    for suffix in ['.mp4', '-poster.jpg']:
        shutil.copy2(SRC / (name + suffix), DEST / (name + suffix))
    silent = DEST / (name + '-Silent.mp4')
    subprocess.run([str(FF), '-y', '-v', 'error', '-i', str(DEST / (name + '.mp4')), '-c:v', 'copy', '-an', '-movflags', '+faststart', str(silent)], check=True)
    size = (DEST / (name + '.mp4')).stat().st_size / 1_000_000
    entries.append(f'''<article><h2>{title}</h2><p class="meta">{duration} · 1080 × 1920 · {size:.1f} MB · Original instrumental soundtrack</p>
<video controls playsinline preload="metadata" poster="{name}-poster.jpg" aria-label="{title}, animated PSI app demonstration"><source src="{name}.mp4" type="video/mp4"></video>
<div class="actions"><a class="button" download href="{name}.mp4">Download video</a><a class="button secondary" download href="{name}-Silent.mp4">Download silent copy</a><a class="plain" href="{name}.mp4" target="_blank" rel="noopener">Open video directly</a></div></article>''')

html = '''<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050505"><title>PSI animated app walkthrough</title>
<style>
:root{color-scheme:dark;font-family:Arial,sans-serif;background:#050505;color:#fff}*{box-sizing:border-box}body{margin:0}main{width:min(100% - 32px,680px);margin:auto;padding:32px 0 56px}.eyebrow{color:#60c7eb;font-weight:800;letter-spacing:2px;font-size:13px}h1{font-size:clamp(30px,8vw,46px);margin:12px 0}h2{font-size:23px;margin:0 0 12px}p,li{line-height:1.6;color:#c6cbd0}article{margin:24px 0;padding:16px;border:1px solid #343a40;border-radius:12px;background:#111}.meta{font-size:14px}video{display:block;width:100%;max-height:66vh;background:#000}.actions{display:grid;gap:12px;margin-top:16px}.button{padding:16px;background:#60c7eb;color:#050505;border-radius:6px;font-weight:800;text-decoration:none;text-align:center}.secondary{background:transparent;border:1px solid #60c7eb;color:#60c7eb}.plain{color:#60c7eb;text-align:center;padding:8px}a:focus-visible{outline:3px solid white;outline-offset:4px}section{margin-top:32px}li{margin-bottom:10px}footer{margin-top:28px}footer a{color:#60c7eb}
</style></head><body><main><header><div class="eyebrow">PSI PERFORMANCE · CREATED 18 SEPTEMBER 2026</div><h1>Your app, explained.</h1><p>Animated demonstrations using PSI app artwork and fictional examples: booking requests, vehicle illustrations, odometer readings, pictures, dyno graphs, invoices, files and reminders.</p><p>These are illustrated app walkthroughs, not screen recordings. Both versions say <strong>Launching soon</strong>.</p></header>
''' + '\n'.join(entries) + '''
<section><h2>Save to your iPhone</h2><ol><li>Open this page in <strong>Safari</strong> and tap <strong>Download video</strong>.</li><li>Open the download in Safari's downloads list or the <strong>Files</strong> app.</li><li>Tap <strong>Share → Save Video</strong> to add it to Photos.</li></ol><p>If you are viewing this inside another app, open the link in Safari first. The silent copies let you add your own audio.</p></section>
<section><h2>What the full video covers</h2><p>Home screen scrolling; all five booking request steps; changing car artwork; entering kilometres; opening saved pictures, dyno results, invoices and supporting files; choosing reminder settings.</p><p>Performance+ archive features require a paid subscription. All examples are fictional and no real booking or notification is sent.</p></section>
<footer><a href="../">All PSI campaign videos</a></footer></main></body></html>'''
(DEST / 'index.html').write_text(html, encoding='utf8')
shutil.copy2(SRC / 'PSI-Full-Walkthrough-Captions.srt', DEST)
validation = []
for video in DEST.glob('*.mp4'):
    data = video.read_bytes(); offset = 0; boxes = []
    while offset + 8 <= len(data):
        length, kind = struct.unpack('>I4s', data[offset:offset+8])
        if length == 1: length = struct.unpack('>Q', data[offset+8:offset+16])[0]
        if length == 0: length = len(data)-offset
        if length < 8: raise ValueError('Invalid MP4 box')
        boxes.append(kind.decode('ascii')); offset += length
    assert boxes.index('moov') < boxes.index('mdat'), 'Fast start missing'
    subprocess.run([str(FF), '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
    validation.append({'file':video.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'fast_start':True,'full_decode_passed':True})
class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('src','href','poster') and value and not value.startswith(('http', '#')):
                assert (DEST / value).exists(), value
Links().feed(html)
(SRC / 'delivery-validation.json').write_text(json.dumps(validation,indent=2),encoding='utf8')
print(json.dumps(validation,indent=2))
