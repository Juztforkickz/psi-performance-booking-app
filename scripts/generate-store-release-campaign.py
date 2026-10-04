from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps
from reportlab.graphics.barcode.qr import QrCodeWidget


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "app-release-campaign-2026-10-04"
ASSETS = OUT / "assets"
PUBLIC = ROOT / "public" / "download"

BACKGROUND = ASSETS / "psi-workshop-clean-background.png"
META_SOURCE = Path(r"C:\Users\PSI PERFORMANCE\Desktop\PSI APP\meta pic.jpg")
APP_ICON = ROOT / "mobile" / "assets" / "images" / "psi-app-icon-1024.png"
PSI_LOGO = ROOT / "public" / "psi-logo.png"
APPLE_BADGE = ASSETS / "app-store-badge-rendered.png"
GOOGLE_BADGE = ASSETS / "google-play-badge.png"

APPLE_URL = "https://apps.apple.com/au/app/psi-performance-garage/id6806902732"
GOOGLE_URL = "https://play.google.com/store/apps/details?id=com.psiperformance.booking"
DOWNLOAD_URL = "https://juztforkickz.github.io/psi-performance-booking-app/download/"

BLUE = (101, 207, 248)
WHITE = (245, 248, 250)
SILVER = (192, 204, 211)
INK = (4, 8, 11)

FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
FONT_REGULAR = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_CONDENSED = Path(r"C:\Windows\Fonts\AGENCYB.TTF")


def font(size: int, condensed: bool = False, regular: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_CONDENSED if condensed else FONT_REGULAR if regular else FONT_BOLD
    return ImageFont.truetype(str(path), size)


def cover(image: Image.Image, size: tuple[int, int], centre: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=centre)


def alpha_resize(path: Path, width: int | None = None, height: int | None = None) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if width is not None:
        height = round(image.height * width / image.width)
    elif height is not None:
        width = round(image.width * height / image.height)
    assert width is not None and height is not None
    return image.resize((width, height), Image.Resampling.LANCZOS)


def paste_centred(canvas: Image.Image, image: Image.Image, y: int, x: int | None = None) -> tuple[int, int, int, int]:
    if x is None:
        x = (canvas.width - image.width) // 2
    canvas.alpha_composite(image, (x, y))
    return x, y, x + image.width, y + image.height


def centred(draw: ImageDraw.ImageDraw, text: str, y: int, text_font: ImageFont.FreeTypeFont, fill=WHITE, width: int = 1080) -> None:
    box = draw.textbbox((0, 0), text, font=text_font)
    x = (width - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=text_font, fill=fill)


def dark_gradient(canvas: Image.Image, top_alpha: int, bottom_alpha: int = 0) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(canvas.height):
        ratio = y / max(1, canvas.height - 1)
        alpha = round(top_alpha + (bottom_alpha - top_alpha) * ratio)
        for x in range(canvas.width):
            pixels[x, y] = (0, 0, 0, alpha)
    canvas.alpha_composite(overlay)


def panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 24, alpha: int = 220) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=(5, 10, 13, alpha), outline=(101, 207, 248, 190), width=2)


def create_qr(data: str, output: Path, size: int = 1600) -> Image.Image:
    widget = QrCodeWidget(data, barLevel="H")
    widget.qr.make()
    matrix = widget.qr.modules
    count = widget.qr.moduleCount
    border = 4
    modules = count + border * 2
    scale = max(1, size // modules)
    native = modules * scale
    image = Image.new("RGB", (native, native), "white")
    draw = ImageDraw.Draw(image)
    for row in range(count):
        for column in range(count):
            if matrix[row][column]:
                x0 = (column + border) * scale
                y0 = (row + border) * scale
                draw.rectangle((x0, y0, x0 + scale - 1, y0 + scale - 1), fill="black")
    canvas = Image.new("RGB", (size, size), "white")
    offset = (size - native) // 2
    canvas.paste(image, (offset, offset))
    canvas.save(output, optimize=True)
    return canvas


def qr_tile(qr: Image.Image, size: int, border: int = 16) -> Image.Image:
    qr = qr.resize((size, size), Image.Resampling.NEAREST).convert("RGBA")
    tile = Image.new("RGBA", (size + border * 2, size + border * 2), "white")
    tile.alpha_composite(qr, (border, border))
    return tile


def badge(path: Path, height: int) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    content = image.getbbox()
    if content:
        image = image.crop(content)
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def add_top_brand(canvas: Image.Image, y: int, logo_width: int) -> int:
    logo = alpha_resize(PSI_LOGO, width=logo_width)
    paste_centred(canvas, logo, y)
    return y + logo.height


def android_feed(background: Image.Image) -> Path:
    canvas = cover(background, (1080, 1350), (0.5, 0.5)).convert("RGBA")
    dark_gradient(canvas, 205, 28)
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((0, 0, 1080, 650), fill=(0, 0, 0, 78))
    add_top_brand(canvas, 42, 250)
    centred(draw, "ANDROID RELEASE", 164, font(32, condensed=True), BLUE)
    centred(draw, "THE PSI APP", 217, font(82), WHITE)
    centred(draw, "IS NOW ON", 306, font(55), SILVER)
    centred(draw, "GOOGLE PLAY.", 366, font(88), BLUE)
    centred(draw, "Your car. Its whole story.", 470, font(34, regular=True), WHITE)
    google = badge(GOOGLE_BADGE, 100)
    paste_centred(canvas, google, 520)
    draw.rectangle((48, 1260, 1032, 1263), fill=BLUE)
    centred(draw, "DOWNLOAD PSI PERFORMANCE GARAGE", 1280, font(24, condensed=True), WHITE)
    path = OUT / "PSI-Android-Launch-Feed-4x5.png"
    canvas.convert("RGB").save(path, quality=96)
    return path


def android_story(background: Image.Image) -> Path:
    canvas = cover(background, (1080, 1920), (0.5, 0.47)).convert("RGBA")
    dark_gradient(canvas, 218, 60)
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((0, 0, 1080, 720), fill=(0, 0, 0, 65))
    add_top_brand(canvas, 105, 265)
    centred(draw, "ANDROID RELEASE", 235, font(36, condensed=True), BLUE)
    centred(draw, "THE PSI APP", 302, font(90), WHITE)
    centred(draw, "IS NOW ON", 404, font(62), SILVER)
    centred(draw, "GOOGLE PLAY.", 477, font(96), BLUE)
    centred(draw, "Your car. Its whole story.", 594, font(36, regular=True), WHITE)
    google = badge(GOOGLE_BADGE, 108)
    paste_centred(canvas, google, 652)
    draw.rectangle((60, 1805, 1020, 1808), fill=BLUE)
    centred(draw, "DOWNLOAD NOW", 1832, font(30, condensed=True), WHITE)
    path = OUT / "PSI-Android-Launch-Reel-Story-9x16.png"
    canvas.convert("RGB").save(path, quality=96)
    return path


def combined_feed(background: Image.Image, apple_qr: Image.Image, google_qr: Image.Image) -> Path:
    canvas = cover(background, (1080, 1350), (0.5, 0.49)).convert("RGBA")
    veil = Image.new("RGBA", canvas.size, (0, 0, 0, 172))
    canvas.alpha_composite(veil)
    draw = ImageDraw.Draw(canvas, "RGBA")
    add_top_brand(canvas, 34, 230)
    centred(draw, "ONE APP. TWO STORES.", 156, font(59), WHITE)
    centred(draw, "PSI PERFORMANCE GARAGE", 226, font(31, condensed=True), BLUE)
    panel(draw, (42, 292, 1038, 1126), 28, 228)
    items = [
        (APPLE_BADGE, apple_qr, "IPHONE", 78, 82),
        (GOOGLE_BADGE, google_qr, "ANDROID", 570, 82),
    ]
    for badge_path, qr, label, x, _ in items:
        b = badge(badge_path, 76)
        bx = x + (430 - b.width) // 2
        canvas.alpha_composite(b, (bx, 340))
        tile = qr_tile(qr, 340, 14)
        canvas.alpha_composite(tile, (x + (430 - tile.width) // 2, 448))
        label_box = draw.textbbox((0, 0), label, font=font(31, condensed=True))
        draw.text((x + (430 - (label_box[2] - label_box[0])) // 2, 860), label, font=font(31, condensed=True), fill=BLUE)
    centred(draw, "SCAN YOUR STORE TO DOWNLOAD", 951, font(31), WHITE)
    centred(draw, "Bookings. Records. Workshop photos. Your complete PSI story.", 1004, font(23, regular=True), SILVER)
    combined = qr_tile(create_qr(DOWNLOAD_URL, ASSETS / "psi-app-download-both-qr-1600.png"), 138, 9)
    canvas.alpha_composite(combined, ((1080 - combined.width) // 2, 1139))
    centred(draw, "ONE QR FOR BOTH STORES", 1300, font(23, condensed=True), WHITE)
    path = OUT / "PSI-App-Download-Apple-Android-QR-Feed-4x5.png"
    canvas.convert("RGB").save(path, quality=96)
    return path


def combined_web(background: Image.Image, apple_qr: Image.Image, google_qr: Image.Image) -> Path:
    canvas = cover(background, (1600, 900), (0.5, 0.57)).convert("RGBA")
    dark_gradient(canvas, 92, 45)
    draw = ImageDraw.Draw(canvas, "RGBA")
    canvas.alpha_composite(Image.new("RGBA", canvas.size, (0, 0, 0, 46)))
    logo = alpha_resize(PSI_LOGO, width=340)
    canvas.alpha_composite(logo, (74, 74))
    draw.text((74, 244), "ONE APP.", font=font(83), fill=WHITE)
    draw.text((74, 329), "TWO STORES.", font=font(83), fill=BLUE)
    draw.text((78, 437), "PSI Performance Garage is available now", font=font(30, regular=True), fill=WHITE)
    draw.text((78, 480), "for iPhone and Android.", font=font(30, regular=True), fill=SILVER)
    draw.text((78, 566), "SCAN YOUR STORE TO DOWNLOAD", font=font(31, condensed=True), fill=BLUE)
    draw.text((78, 620), "Your car. Its whole story.", font=font(35), fill=WHITE)
    panel(draw, (745, 55, 1540, 845), 28, 230)
    for badge_path, qr, label, x in [
        (APPLE_BADGE, apple_qr, "IPHONE", 790),
        (GOOGLE_BADGE, google_qr, "ANDROID", 1165),
    ]:
        b = badge(badge_path, 72)
        canvas.alpha_composite(b, (x + (320 - b.width) // 2, 118))
        tile = qr_tile(qr, 286, 13)
        canvas.alpha_composite(tile, (x + (320 - tile.width) // 2, 230))
        label_box = draw.textbbox((0, 0), label, font=font(31, condensed=True))
        draw.text((x + (320 - (label_box[2] - label_box[0])) // 2, 565), label, font=font(31, condensed=True), fill=BLUE)
    draw.line((790, 630, 1495, 630), fill=(101, 207, 248, 120), width=2)
    icon = alpha_resize(APP_ICON, width=116)
    canvas.alpha_composite(icon, (1082, 664))
    draw.text((1217, 682), "PSI PERFORMANCE", font=font(27, condensed=True), fill=WHITE)
    draw.text((1217, 721), "GARAGE", font=font(44), fill=BLUE)
    path = OUT / "PSI-App-Download-Apple-Android-QR-Website-1600x900.png"
    canvas.convert("RGB").save(path, quality=96)
    return path


def facebook_banner(apple_qr: Image.Image, google_qr: Image.Image) -> Path:
    canvas = Image.open(META_SOURCE).convert("RGBA")
    if canvas.size != (2033, 774):
        canvas = cover(canvas, (2033, 774))
    # Preserve the approved banner and its original top right app panel. Rework
    # only the footer area after the social icons so each store has its own code.
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((1265, 632, 2033, 774), fill=(2, 7, 10, 248))
    for qr, label, x in [(apple_qr, "APPLE", 1282), (google_qr, "GOOGLE PLAY", 1380)]:
        tile = qr.resize((74, 74), Image.Resampling.NEAREST).convert("RGBA")
        canvas.alpha_composite(tile, (x, 640))
        label_box = draw.textbbox((0, 0), label, font=font(18, condensed=True))
        draw.text((x + (74 - (label_box[2] - label_box[0])) // 2, 721), label, font=font(18, condensed=True), fill=WHITE)
    draw.rectangle((1482, 649, 1485, 752), fill=BLUE)
    draw.rectangle((1530, 679, 1572, 683), fill=BLUE)
    draw.text((1590, 659), "PERFORMANCE LIVES HERE.", font=font(31, condensed=True), fill=BLUE)
    draw.rectangle((1977, 679, 2019, 683), fill=BLUE)
    path = OUT / "PSI-Facebook-Banner-Apple-Android-2033x774.jpg"
    canvas.convert("RGB").save(path, quality=96, subsampling=0)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    if not BACKGROUND.exists():
        raise FileNotFoundError(f"Missing campaign background: {BACKGROUND}")

    apple_qr = create_qr(APPLE_URL, ASSETS / "psi-app-store-apple-qr-1600.png")
    google_qr = create_qr(GOOGLE_URL, ASSETS / "psi-google-play-qr-1600.png")
    PUBLIC.mkdir(parents=True, exist_ok=True)
    badge(APPLE_BADGE, 166).save(PUBLIC / "app-store-badge.png", optimize=True)
    badge(GOOGLE_BADGE, 166).save(PUBLIC / "google-play-badge.png", optimize=True)
    apple_qr.resize((1600, 1600), Image.Resampling.NEAREST).save(PUBLIC / "psi-app-store-apple-qr.png", optimize=True)
    google_qr.resize((1600, 1600), Image.Resampling.NEAREST).save(PUBLIC / "psi-google-play-qr.png", optimize=True)
    background = Image.open(BACKGROUND)
    outputs = [
        android_feed(background),
        android_story(background),
        combined_feed(background, apple_qr, google_qr),
        combined_web(background, apple_qr, google_qr),
        facebook_banner(apple_qr, google_qr),
    ]
    for path in outputs:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
