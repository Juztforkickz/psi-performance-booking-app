"""Restore the supplied poster as video layers without regenerating its graph.

The built-in image editor supplies only the obscured heading. The screenshot's
unobscured chart, result panels, slogan and car remain the source video pixels.
The standalone artwork is a frame exported from this lossless video master.
"""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
FF = ROOT / 'tools/ffmpeg.exe'
SOURCE = ROOT / 'source/dyno-restored-2026-09-13'
original = SOURCE / 'original-instagram-screenshot.jpg'
header = SOURCE / 'psi-dyno-cleaned-v2.png'
master = SOURCE / 'psi-dyno-original-chart-master.mp4'
for path in (original, header):
    if not path.is_file():
        raise FileNotFoundError(path)

# Coordinates refer to the 588x1280 screenshot and 972x1619 generated cleanup.
# Instagram's mute button is the only overlay below the heading. The small
# delogo region is outside the dyno chart, result panels and car body.
filters = (
    '[0:v]crop=972:374:0:0,scale=588:226:flags=lanczos,setsar=1[heading];'
    '[1:v]delogo=x=530:y=1160:w=37:h=39:show=0,'
    'crop=588:750:0:468,setsar=1[original];'
    '[heading][original]vstack=inputs=2,format=yuv420p[v]'
)
subprocess.run([
    str(FF), '-hide_banner', '-loglevel', 'error',
    '-loop', '1', '-framerate', '30', '-i', str(header),
    '-loop', '1', '-framerate', '30', '-i', str(original),
    '-filter_complex', filters, '-map', '[v]', '-t', '5', '-r', '30',
    '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '0',
    '-movflags', '+faststart', '-y', str(master)
], check=True)
subprocess.run([
    str(FF), '-hide_banner', '-loglevel', 'error', '-xerror', '-i', str(master),
    '-frames:v', '1', '-y', str(ROOT / 'social/PSI-Dyno-Artwork-Clean.png')
], check=True)
print('Restored dyno video master and standalone artwork; original chart retained.')
