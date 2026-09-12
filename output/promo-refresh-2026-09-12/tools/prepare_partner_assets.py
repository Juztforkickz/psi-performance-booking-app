"""Prepare exact partner-logo cutouts for the promotional video renderer."""

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
SOURCE = REPO / "mobile/assets/images/partners/martini-racing-products.jpg"
OUTPUT = ROOT / "source/partner-ad-assets/martini-racing-products-black.png"


def is_outer_white(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    # The supplied JPEG includes a soft neutral shadow around the shield. Treat
    # every connected light/grey neutral pixel at the image edge as background,
    # while the shield's enclosed white lettering and centre remain untouched.
    return min(red, green, blue) >= 160 and max(red, green, blue) - min(red, green, blue) <= 24


def remove_connected_white_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def add(x: int, y: int) -> None:
        offset = y * width + x
        if not outside[offset] and is_outer_white(pixels[x, y]):
            outside[offset] = 1
            queue.append((x, y))

    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            add(x - 1, y)
        if x + 1 < width:
            add(x + 1, y)
        if y:
            add(x, y - 1)
        if y + 1 < height:
            add(x, y + 1)

    rgba = rgb.convert("RGBA")
    alpha = Image.new("L", (width, height), 255)
    alpha.putdata([0 if value else 255 for value in outside])
    rgba.putalpha(alpha)
    return rgba


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
cutout = remove_connected_white_background(Image.open(SOURCE))
black_matte = Image.new("RGBA", cutout.size, (0, 0, 0, 255))
black_matte.alpha_composite(cutout)
black_matte.convert("RGB").save(OUTPUT, optimize=True)
print(f"Prepared {OUTPUT}")
