"""Prepare small 16:9 picker previews from the matching portrait garage artwork.

Run with the existing workshop Python/Pillow environment. Full artwork and its
stored IDs remain intact. No customer uploads or private storage are touched.
"""
import json
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parents[1] / 'assets' / 'images' / 'garage-vehicles'
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8-sig'))
thumbnails = folder / 'thumbs'
thumbnails.mkdir(exist_ok=True)
total = 0
for entry in manifest['vehicles']:
    source = folder / entry['jpeg']
    with Image.open(source) as image:
        image = image.convert('RGB')
        width, height = image.size
        # Match the existing portrait artwork's visible horizontal garage frame:
        # image height 222%, top -70%, frame ratio 16:9.
        top = round(height * 70 / 222)
        crop_height = round(width * 9 / 16)
        top = min(top, height - crop_height)
        preview = image.crop((0, top, width, top + crop_height))
        preview = preview.resize((480, 270), Image.Resampling.LANCZOS)
        output = thumbnails / f"{entry['id']}.jpg"
        preview.save(output, format='JPEG', quality=78, optimize=True, progressive=True)
        total += output.stat().st_size
print(f"Prepared {len(manifest['vehicles'])} thumbnails, {total:,} bytes combined")
