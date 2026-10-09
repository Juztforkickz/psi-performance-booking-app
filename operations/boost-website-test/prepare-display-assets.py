"""Package existing approved artwork for the offline website preview.

No artwork or character design is changed. The original Boost PNG is preserved.
"""
from pathlib import Path
import argparse
import shutil
from PIL import Image

directory = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--homepage-hero", type=Path, help="Observed homepage hero bundled from the current public website")
args = parser.parse_args()
assets = directory / "assets"
assets.mkdir(exist_ok=True)
with Image.open(directory.parent.parent / "mobile/assets/images/boost-assistant.png") as image:
    image.thumbnail((256, 256), Image.Resampling.LANCZOS)
    image.save(assets / "boost-display.webp", lossless=True, method=6)
if args.homepage_hero:
    with Image.open(args.homepage_hero) as image:
        if image.format != "WEBP":
            raise ValueError("Expected the observed WebP hero asset")
    shutil.copyfile(args.homepage_hero, assets / "homepage-hero.webp")
print({p.name: p.stat().st_size for p in assets.iterdir()})
