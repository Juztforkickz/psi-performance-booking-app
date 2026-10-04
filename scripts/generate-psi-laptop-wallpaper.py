from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "app-release-campaign-2026-10-04" / "PSI-Facebook-Banner-Apple-Android-2033x774.jpg"
DESTINATION = ROOT / "output" / "app-release-campaign-2026-10-04" / "PSI-Laptop-Wallpaper-1920x1200.jpg"

WIDTH = 1920
HEIGHT = 1200


with Image.open(SOURCE).convert("RGB") as source:
    cover_scale = max(WIDTH / source.width, HEIGHT / source.height)
    cover_size = (
        round(source.width * cover_scale),
        round(source.height * cover_scale),
    )
    background = source.resize(cover_size, Image.Resampling.LANCZOS)
    left = (background.width - WIDTH) // 2
    top = (background.height - HEIGHT) // 2
    background = background.crop((left, top, left + WIDTH, top + HEIGHT))
    background = background.filter(ImageFilter.GaussianBlur(34))
    background = ImageEnhance.Brightness(background).enhance(0.32)

    banner_height = round(source.height * WIDTH / source.width)
    banner = source.resize((WIDTH, banner_height), Image.Resampling.LANCZOS)
    banner_top = (HEIGHT - banner_height) // 2

    mask = Image.new("L", (WIDTH, banner_height), 255)
    fade = 24
    mask_pixels = mask.load()
    for y in range(fade):
        opacity = round(255 * (y + 1) / fade)
        for x in range(WIDTH):
            mask_pixels[x, y] = opacity
            mask_pixels[x, banner_height - y - 1] = opacity

    background.paste(banner, (0, banner_top), mask)
    background.save(DESTINATION, quality=96, subsampling=0, optimize=True)

print(DESTINATION)
