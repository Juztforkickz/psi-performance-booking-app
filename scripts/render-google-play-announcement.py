from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "app-release-campaign-2026-10-04"
ICON_PATH = ROOT / "mobile" / "assets" / "images" / "psi-app-icon-1024.png"
BADGE_PATH = OUT / "assets" / "google-play-badge.png"
FFMPEG = ROOT / "output" / "promo-refresh-2026-09-12" / "tools" / "ffmpeg.exe"

WIDTH = 1080
HEIGHT = 1920
FPS = 30
DURATION = 8
FRAMES = FPS * DURATION
BLUE = (101, 207, 248)
WHITE = (246, 248, 250)
SILVER = (198, 204, 209)

FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
FONT_REGULAR = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_CONDENSED = Path(r"C:\Windows\Fonts\AGENCYB.TTF")


def font(size: int, bold: bool = True, condensed: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_CONDENSED if condensed else FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size)


def ease_out_cubic(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 1 - (1 - value) ** 3


def ease_out_back(value: float) -> float:
    value = max(0.0, min(1.0, value))
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2


def opacity(frame: int, start: int, end: int) -> int:
    return round(255 * ease_out_cubic((frame - start) / max(1, end - start)))


def centred_text_layer(text: str, text_font: ImageFont.FreeTypeFont, fill: tuple[int, int, int], width: int = WIDTH) -> Image.Image:
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    box = probe.textbbox((0, 0), text, font=text_font)
    layer = Image.new("RGBA", (width, box[3] - box[1] + 20), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    text_width = box[2] - box[0]
    draw.text(((width - text_width) // 2, 4 - box[1]), text, font=text_font, fill=fill + (255,))
    return layer


def build_background() -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT), (4, 6, 8))
    spotlight = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(spotlight)
    draw.ellipse((-210, 250, WIDTH + 210, 1670), fill=218)
    spotlight = spotlight.filter(ImageFilter.GaussianBlur(250))
    glow = Image.new("RGB", (WIDTH, HEIGHT), (118, 122, 126))
    base = Image.composite(glow, base, spotlight)

    blue_spot = Image.new("L", (WIDTH, HEIGHT), 0)
    blue_draw = ImageDraw.Draw(blue_spot)
    blue_draw.ellipse((70, 515, WIDTH - 70, 1445), fill=62)
    blue_spot = blue_spot.filter(ImageFilter.GaussianBlur(240))
    blue_layer = Image.new("RGB", (WIDTH, HEIGHT), (15, 66, 86))
    base = Image.composite(blue_layer, base, blue_spot)

    vignette = Image.new("L", (WIDTH, HEIGHT), 0)
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.rectangle((0, 0, WIDTH, HEIGHT), fill=210)
    vignette_draw.ellipse((-120, 110, WIDTH + 120, HEIGHT - 30), fill=0)
    vignette = vignette.filter(ImageFilter.GaussianBlur(170))
    black = Image.new("RGB", (WIDTH, HEIGHT), "black")
    return Image.composite(black, base, vignette)


def build_icon() -> tuple[Image.Image, Image.Image]:
    source = Image.open(ICON_PATH).convert("RGBA").resize((600, 600), Image.Resampling.LANCZOS)
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((5, 5, 594, 594), radius=124, fill=255)
    source.putalpha(mask)

    gloss = Image.new("RGBA", source.size, (0, 0, 0, 0))
    gloss_draw = ImageDraw.Draw(gloss)
    gloss_draw.ellipse((-140, -300, 740, 310), fill=(255, 255, 255, 24))
    gloss.putalpha(ImageChops.multiply(gloss.getchannel("A"), mask))
    source = Image.alpha_composite(source, gloss)

    rim = Image.new("RGBA", source.size, (0, 0, 0, 0))
    rim_draw = ImageDraw.Draw(rim)
    rim_draw.rounded_rectangle((7, 7, 592, 592), radius=121, outline=(225, 232, 236, 78), width=5)
    source = Image.alpha_composite(source, rim)
    return source, mask


def resize_badge(height: int = 122) -> Image.Image:
    badge = Image.open(BADGE_PATH).convert("RGBA")
    content = badge.getbbox()
    if content:
        badge = badge.crop(content)
    width = round(badge.width * height / badge.height)
    return badge.resize((width, height), Image.Resampling.LANCZOS)


def paste_with_opacity(canvas: Image.Image, layer: Image.Image, xy: tuple[int, int], alpha: int) -> None:
    if alpha <= 0:
        return
    copy = layer.copy()
    copy.putalpha(ImageChops.multiply(copy.getchannel("A"), Image.new("L", copy.size, alpha)))
    canvas.alpha_composite(copy, xy)


def render() -> tuple[Path, Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    background = build_background().convert("RGBA")
    title = centred_text_layer("Now available", font(76), WHITE)
    subtitle = centred_text_layer("PSI Performance Garage", font(38), SILVER)
    platform = centred_text_layer("ANDROID", font(31, condensed=True), BLUE)
    icon, icon_mask = build_icon()
    badge = resize_badge()

    video_path = OUT / "PSI-Google-Play-Now-Available-Reel-9x16.mp4"
    cover_path = OUT / "PSI-Google-Play-Now-Available-Cover-9x16.png"
    command = [
        str(FFMPEG), "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-y", str(video_path),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None

    final_frame: Image.Image | None = None
    for frame in range(FRAMES):
        canvas = background.copy()

        title_alpha = opacity(frame, 6, 34)
        subtitle_alpha = opacity(frame, 18, 48)
        paste_with_opacity(canvas, title, (0, 300), title_alpha)
        paste_with_opacity(canvas, subtitle, (0, 405), subtitle_alpha)

        icon_progress = ease_out_back((frame - 28) / 58)
        icon_scale = 0.72 + 0.28 * icon_progress
        if frame > 92:
            icon_scale *= 1 + 0.008 * math.sin((frame - 92) / FPS * math.pi * 0.72)
        icon_alpha = opacity(frame, 24, 58)
        icon_size = max(1, round(600 * icon_scale))
        scaled_icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)

        icon_x = (WIDTH - icon_size) // 2
        icon_y = 580 + (600 - icon_size) // 2
        glow_size = icon_size + 92
        glow_mask = Image.new("L", (glow_size, glow_size), 0)
        glow_draw = ImageDraw.Draw(glow_mask)
        glow_draw.rounded_rectangle((46, 46, glow_size - 46, glow_size - 46), radius=max(40, round(124 * icon_scale)), fill=130)
        glow_mask = glow_mask.filter(ImageFilter.GaussianBlur(48))
        glow_layer = Image.new("RGBA", (glow_size, glow_size), BLUE + (0,))
        glow_layer.putalpha(glow_mask.point(lambda value: value * icon_alpha // 255))
        canvas.alpha_composite(glow_layer, (icon_x - 46, icon_y - 46))
        paste_with_opacity(canvas, scaled_icon, (icon_x, icon_y), icon_alpha)

        if 105 <= frame <= 158:
            shine_progress = (frame - 105) / 53
            shine = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
            shine_draw = ImageDraw.Draw(shine)
            start_x = round(-icon_size * 0.7 + shine_progress * icon_size * 1.9)
            shine_draw.polygon(
                [(start_x, 0), (start_x + 100, 0), (start_x - 80, icon_size), (start_x - 180, icon_size)],
                fill=(255, 255, 255, 22),
            )
            scaled_mask = icon_mask.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            shine.putalpha(ImageChops.multiply(shine.getchannel("A"), scaled_mask))
            canvas.alpha_composite(shine, (icon_x, icon_y))

        badge_alpha = opacity(frame, 70, 108)
        badge_y = round(1370 + 40 * (1 - ease_out_cubic((frame - 70) / 38)))
        paste_with_opacity(canvas, badge, ((WIDTH - badge.width) // 2, badge_y), badge_alpha)
        paste_with_opacity(canvas, platform, (0, 1530), opacity(frame, 90, 124))

        draw = ImageDraw.Draw(canvas, "RGBA")
        line_alpha = opacity(frame, 92, 130)
        line_width = round(360 * ease_out_cubic((frame - 92) / 38))
        draw.rectangle(((WIDTH - line_width) // 2, 1585, (WIDTH + line_width) // 2, 1588), fill=BLUE + (line_alpha,))

        if frame >= FRAMES - 18:
            fade = round(255 * (frame - (FRAMES - 18)) / 18)
            canvas.alpha_composite(Image.new("RGBA", canvas.size, (0, 0, 0, fade)))

        rgb = canvas.convert("RGB")
        if frame == 190:
            final_frame = rgb.copy()
        process.stdin.write(rgb.tobytes())

    process.stdin.close()
    return_code = process.wait()
    if return_code:
        raise RuntimeError(f"FFmpeg exited with code {return_code}")
    if final_frame is None:
        raise RuntimeError("Cover frame was not captured")
    final_frame.save(cover_path, quality=96)
    print(video_path.relative_to(ROOT))
    print(cover_path.relative_to(ROOT))
    return video_path, cover_path


if __name__ == "__main__":
    render()
