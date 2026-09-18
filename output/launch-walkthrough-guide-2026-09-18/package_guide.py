"""Package the finished PSI videos and validate the portable delivery folder.

Run only after both guide.py renders finish. The sound originals in WORK are
read-only inputs. This script copies them, remuxes separate silent versions,
builds the viewing page and performs full decode validation of all four MP4s.
No imports from guide.py: importing this module has no filesystem side effects.
"""

from datetime import datetime, timezone
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work/launch-walkthrough-guide-2026-09-18"
DEST = ROOT / "public/campaign-videos/complete-guide-2026-09-18"
FFMPEG = ROOT / "output/promo-refresh-2026-09-12/tools/ffmpeg.exe"
TITLES = ("PSI-Complete-App-Guide", "PSI-Launch-Showcase-90s")
SUFFIXES = (".mp4", "-poster.jpg", ".srt", "-chapters.json", "-validation.json")


def digest(path):
    value = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def write_text(path, content):
    temporary = path.with_name(path.name + ".packaging-tmp")
    temporary.write_text(content, encoding="utf-8", newline="\n")
    temporary.replace(path)


def srt_to_vtt(source):
    source = source.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    pattern = re.compile(r"(?m)^(\d{2}:\d{2}:\d{2}),(\d{3})(\s+-->\s+)(\d{2}:\d{2}:\d{2}),(\d{3})([^\n]*)$")
    converted, count = pattern.subn(r"\1.\2\3\4.\5\6", source)
    if count == 0 or " --> " not in converted:
        raise ValueError("SRT contains no supported caption timestamps")
    if len(re.findall(r"(?m)^.*-->.*$", source)) != count:
        raise ValueError("SRT contains an unsupported caption timestamp")
    return "WEBVTT\n\n" + converted.strip() + "\n", count


def logical_chapter(name):
    normal = re.sub(r"\s+", " ", str(name).strip()).casefold()
    groups = {
        "welcome": "Welcome",
        "account setup": "Account setup",
        "my garage": "My Garage",
        "home": "Home",
        "book ahead": "Book Ahead & bookings",
        "your bookings": "Book Ahead & bookings",
        "dyno & build": "Dyno & build",
        "performance+": "Records & Performance+",
        "your records": "Records & Performance+",
        "settings & notifications": "Settings",
        "theme preference": "Settings",
        "psi events": "Events & cars for sale",
        "customer cars for sale": "Events & cars for sale",
        "account & help": "Account & help",
        "ready for your next visit": "Launching soon",
    }
    return groups.get(normal, str(name).strip())


def grouped_chapters(chapters):
    if not isinstance(chapters, list) or not chapters:
        raise ValueError("A nonempty chapter list is required")
    result, seen = [], set()
    previous = -1.0
    for item in chapters:
        start, duration = float(item["start"]), float(item["duration"])
        if not (start >= previous and start >= 0 and duration > 0):
            raise ValueError("Chapters must have increasing starts and positive durations")
        previous = start
        label = logical_chapter(item["chapter"])
        if label not in seen:
            seen.add(label)
            result.append({"label": label, "start": start, "title": str(item["title"])})
    return result


def timestamp(seconds):
    seconds = round(float(seconds))
    return f"{seconds // 60}:{seconds % 60:02d}"


def video_card(stem, title, description, duration, player_id, primary=False):
    stem = escape(stem, quote=True)
    return f'''<section class="film {'primary-film' if primary else ''}" aria-labelledby="{player_id}-title">
  <div class="film-heading"><p class="eyebrow">{'THE COMPLETE WALKTHROUGH' if primary else 'THE QUICK LOOK'} · {escape(timestamp(duration))}</p>
  <h2 id="{player_id}-title">{escape(title)}</h2><p>{escape(description)}</p></div>
  <div class="player-wrap"><video id="{player_id}" controls playsinline preload="metadata" poster="{stem}-poster.jpg" aria-label="{escape(title, quote=True)}">
    <source src="{stem}.mp4" type="video/mp4">
    <track kind="captions" src="{stem}.vtt" srclang="en-AU" label="English (Australia)">
    Your browser can’t play this video. <a href="{stem}.mp4">Open the MP4 directly</a>.
  </video></div>
  <div class="downloads"><a class="button" href="{stem}.mp4" download>Download with sound <span aria-hidden="true">↓</span></a>
  <a class="button secondary" href="{stem}-silent.mp4" download>Download silent <span aria-hidden="true">↓</span></a></div>
  <div class="file-links"><a href="{stem}.mp4">Open sound MP4</a><a href="{stem}-silent.mp4">Open silent MP4</a><a href="{stem}.srt" download>Download captions</a></div>
</section>'''


def page(chapters, complete_duration, short_duration):
    chapter_buttons = "\n".join(
        f'<button class="chapter" type="button" data-start="{item["start"]:.3f}"><span>{escape(item["label"])}</span><time>{timestamp(item["start"])}</time></button>'
        for item in chapters
    )
    full = video_card(TITLES[0], "Your complete app guide", "Follow account setup, My Garage, booking requests, vehicle records and settings, one action at a time.", complete_duration, "full-guide", True)
    short = video_card(TITLES[1], "The 90-second showcase", "A shorter introduction to your PSI garage, ready to watch or save.", short_duration, "short-guide")
    return '''<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#080b0e"><meta name="description" content="Watch the PSI Performance Garage animated app guide and 90-second showcase. Launching soon.">
<title>PSI Performance Garage · The app guide</title>
<style>
:root{color-scheme:dark;--ink:#080b0e;--panel:#11191e;--line:#2c414c;--white:#f2f7f9;--muted:#b8c6cc;--cyan:#65cff8}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:22px}body{margin:0;background:radial-gradient(ellipse at 15% 0,#14313d 0,transparent 43%),var(--ink);color:var(--white);font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--cyan);text-underline-offset:4px}button,a{-webkit-tap-highlight-color:transparent}button:focus-visible,a:focus-visible,video:focus-visible{outline:3px solid var(--cyan);outline-offset:5px}main{width:min(1140px,100%);margin:auto;padding:28px max(18px,env(safe-area-inset-right)) 36px max(18px,env(safe-area-inset-left))}header{max-width:860px;padding:20px 0 32px}.wordmark{font-weight:850;font-size:18px;letter-spacing:.1em}.wordmark span{color:var(--cyan)}.status{display:inline-flex;border:1px solid #5ca3ba;background:#112934;color:var(--cyan);border-radius:30px;padding:6px 13px;margin:26px 0 8px;font-size:13px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}h1{font-size:clamp(38px,7vw,70px);line-height:1.06;letter-spacing:-.04em;margin:10px 0 22px;max-width:760px}header p{max-width:740px;font-size:18px;color:var(--muted);margin:0}h2{font-size:clamp(25px,4vw,34px);line-height:1.15;letter-spacing:-.02em;margin:8px 0 12px}h3{font-size:24px;line-height:1.2;margin:0 0 12px}p{margin:0 0 16px;color:var(--muted)}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.13em;color:var(--cyan);margin:0}.layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(270px,1fr);gap:25px;align-items:start}.film,.side-card{border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,#142028,#0e1419);overflow:hidden;box-shadow:0 18px 65px #0003}.film-heading{padding:25px 25px 0}.film-heading p:last-child{margin-bottom:22px}.player-wrap{display:flex;justify-content:center;background:#000;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}video{display:block;width:100%;max-width:510px;aspect-ratio:9/16;max-height:82svh;object-fit:contain;background:#000}.downloads{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:20px 20px 12px}.button{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:54px;padding:13px 15px;background:var(--cyan);border:1px solid var(--cyan);color:#061119;text-decoration:none;border-radius:10px;font-weight:750;font-size:14px}.button.secondary{background:#0c171d;color:var(--cyan)}.button:hover{filter:brightness(1.12)}.file-links{display:flex;flex-wrap:wrap;gap:9px 19px;padding:0 22px 24px;font-size:13px}.sidebar{display:grid;gap:22px}.side-card{padding:24px}.chapter-list{display:grid;gap:9px}.chapter{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-height:49px;text-align:left;padding:11px 13px;border:1px solid #365362;border-radius:9px;background:#0a141a;color:var(--white);font-family:inherit;font-size:14px;font-weight:650;line-height:1.3;cursor:pointer}.chapter:hover,.chapter[aria-current="true"]{background:#183c4b;border-color:var(--cyan)}.chapter time{color:var(--cyan);font:500 13px/1.3 ui-monospace,monospace;flex:none}.live-status{margin:12px 0 0;font-size:13px;min-height:21px}.note{font-size:14px}ol{margin:18px 0 0;padding-left:23px;color:var(--muted)}li{padding-left:3px;margin:12px 0}li strong{color:var(--white)}.short-section{margin-top:26px;max-width:680px}.short-section video{max-width:475px}.short-section .film-heading{padding-top:27px}footer{padding:28px 3px 8px;color:var(--muted);font-size:13px}.nav-links{display:flex;flex-wrap:wrap;gap:11px 22px;margin-top:22px;font-weight:650}.callout{border-left:3px solid var(--cyan);padding-left:15px;margin-top:18px;font-size:14px}.launch-copy{color:var(--cyan);font-weight:700}@media(max-width:800px){main{padding-top:15px}.layout{grid-template-columns:1fr}.sidebar{grid-template-columns:1fr 1fr}.sidebar .chapter-card{grid-column:1/-1}.chapter-list{grid-template-columns:1fr 1fr}header{padding-bottom:27px}.short-section{max-width:none}video{max-width:560px;max-height:85svh}}@media(max-width:520px){.sidebar{grid-template-columns:1fr}.film-heading{padding:22px 18px 0}.side-card{padding:20px}.downloads{padding:16px 14px 11px;gap:8px}.button{padding:12px 10px;font-size:13px;gap:6px}.file-links{padding:0 16px 20px;font-size:12px;gap:10px 17px}.chapter{font-size:13px;padding:11px 9px;gap:6px}.chapter-list{gap:8px}.short-section{margin-top:23px}header p{font-size:17px}.status{margin-top:22px}.film,.side-card{border-radius:15px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><main>
<header><div class="wordmark">PSI <span>PERFORMANCE GARAGE</span></div><div class="status">Launching soon</div><h1>Your car.<br>Your PSI app.</h1>
<p>Explore the app from your first sign-in to your next workshop visit. Watch the complete guide, or start with the 90-second showcase.</p>
<div class="nav-links"><a href="#full-guide-title">Watch the full guide</a><a href="#short-guide-title">Watch the showcase</a><a href="#save-iphone">Save to iPhone</a></div>
<p class="callout">These are animated demonstrations using fictional customer details, vehicles and records. They are not live app recordings. No real accounts, bookings, payments or messages are created.</p></header>
<div class="layout">''' + full + '''<aside class="sidebar">
<section class="side-card chapter-card" aria-labelledby="chapter-title"><p class="eyebrow">SKIP TO A CHAPTER</p><h2 id="chapter-title">Find your next step.</h2><p class="note">These buttons jump within the complete guide.</p><div class="chapter-list">''' + chapter_buttons + '''</div><p class="live-status" id="chapter-status" role="status" aria-live="polite"></p></section>
<section class="side-card" id="save-iphone" aria-labelledby="iphone-title"><h3 id="iphone-title">Save to your iPhone</h3><ol><li>Open this page in <strong>Safari</strong>.</li><li>Tap <strong>Download with sound</strong> or <strong>Download silent</strong>.</li><li>Open Safari’s Downloads list, or <strong>Files → Downloads</strong>, and open the video.</li><li>Tap <strong>Share → Save Video</strong> to add it to Photos.</li></ol><p class="note">If a link opens a video player, use <strong>Share → Save to Files</strong> first, then open the saved video in Files.</p></section>
<section class="side-card"><h3>Sound or silent.</h3><p>Sound versions include narration and music. Silent downloads keep the same visuals with no audio track.</p><p class="note">Use the player’s captions control for English captions. Captions are also available to download.</p><p class="launch-copy">Launching soon. Follow PSI Performance for release news.</p></section>
</aside></div><div class="short-section">''' + short + '''</div>
<footer>PSI Performance Garage · Animated app guide · Fictional examples · 18 September 2026</footer>
</main><script>
(() => {
  const player = document.getElementById('full-guide');
  const status = document.getElementById('chapter-status');
  const buttons = [...document.querySelectorAll('button[data-start]')];
  let pendingJump = null;
  function performJump() {
    if (!pendingJump || player.readyState < 1) return;
    const jump = pendingJump; pendingJump = null;
    const maximum = Number.isFinite(player.duration) ? Math.max(0, player.duration - 0.05) : jump.seconds;
    try { player.currentTime = Math.min(jump.seconds, maximum); }
    catch (_) { status.textContent = 'Use the player controls to choose a time.'; return; }
    buttons.forEach(button => button.setAttribute('aria-current', String(button === jump.button)));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    player.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block: 'center'});
    status.textContent = 'Opening ' + jump.label + '.';
    const playback = player.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {
      status.textContent = jump.label + ' is ready. Tap Play to watch.';
    });
  }
  player.addEventListener('loadedmetadata', performJump);
  player.addEventListener('error', () => { pendingJump = null; status.textContent = 'Use Open sound MP4 below the player to watch directly.'; });
  buttons.forEach(button => button.addEventListener('click', () => {
    const seconds = Number(button.dataset.start);
    if (!Number.isFinite(seconds) || seconds < 0) return;
    pendingJump = {seconds, button, label: button.querySelector('span').textContent};
    if (player.readyState >= 1) performJump();
    else { status.textContent = 'Loading the guide…'; player.load(); }
  }));
})();
</script></body></html>
'''


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key == "id" and value:
                self.ids.add(value)
            if key in ("href", "src", "poster") and value:
                self.links.append((tag, key, value))


def validate_links(html_path):
    collector = LinkCollector()
    collector.feed(html_path.read_text(encoding="utf-8"))
    checked = []
    base = html_path.parent.resolve()
    for tag, attribute, url in collector.links:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc:
            raise ValueError(f"Unexpected external asset or link: {url}")
        if not parsed.path:
            if parsed.fragment and unquote(parsed.fragment) not in collector.ids:
                raise ValueError(f"Missing HTML anchor: {url}")
            checked.append({"url": url, "kind": "anchor", "exists": True})
            continue
        target = (base / unquote(parsed.path)).resolve()
        if not target.is_relative_to(base) or not target.is_file():
            raise ValueError(f"Missing or out-of-folder {tag} {attribute}: {url}")
        checked.append({"url": url, "kind": f"{tag}.{attribute}", "exists": True})
    return checked


def mp4_boxes(path):
    boxes, position, length = [], 0, path.stat().st_size
    with path.open("rb") as handle:
        while position < length:
            handle.seek(position)
            header = handle.read(8)
            if len(header) != 8:
                raise ValueError(f"Truncated MP4 box at {position}: {path.name}")
            size, kind = struct.unpack(">I4s", header)
            header_length = 8
            if size == 1:
                extended = handle.read(8)
                if len(extended) != 8:
                    raise ValueError("Truncated extended MP4 box")
                size = struct.unpack(">Q", extended)[0]
                header_length = 16
            elif size == 0:
                size = length - position
            if size < header_length or position + size > length:
                raise ValueError(f"Invalid MP4 box size: {path.name}")
            boxes.append({"type": kind.decode("ascii", errors="replace"), "offset": position, "size": size})
            position += size
    moov = next((box["offset"] for box in boxes if box["type"] == "moov"), None)
    mdat = next((box["offset"] for box in boxes if box["type"] == "mdat"), None)
    if moov is None or mdat is None or not moov < mdat:
        raise ValueError(f"MP4 is missing fast-start ordering: {path.name}")
    return {"moov_before_mdat": True, "moov_offset": moov, "mdat_offset": mdat, "top_level_boxes": boxes}


def run_ffmpeg(arguments):
    completed = subprocess.run([str(FFMPEG), "-nostdin", "-hide_banner", "-v", "error", *arguments], capture_output=True, text=True)
    if completed.returncode:
        raise RuntimeError(f"FFmpeg failed ({completed.returncode}): {completed.stderr[-6000:]}")
    return completed


def validate_video(path):
    print(f"Full decode: {path.name}", flush=True)
    layout = mp4_boxes(path)
    completed = run_ffmpeg(["-xerror", "-err_detect", "explode", "-i", str(path), "-map", "0:v:0", "-map", "0:a?", "-f", "null", "-"])
    return {"name": path.name, "bytes": path.stat().st_size, "sha256": digest(path), "full_decode": "passed", "decode_exit_code": completed.returncode, "decode_stderr": completed.stderr.strip(), **layout}


def main():
    expected = ROOT / "public/campaign-videos/complete-guide-2026-09-18"
    if DEST.resolve() != expected.resolve() or not DEST.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("Delivery directory is outside the intended workspace location")
    inputs = [WORK / (stem + suffix) for stem in TITLES for suffix in SUFFIXES]
    missing = [str(path.relative_to(ROOT)) for path in inputs if not path.is_file() or path.stat().st_size == 0]
    if missing:
        raise FileNotFoundError("Wait for both finished renders and sidecars:\n" + "\n".join(missing))
    if not FFMPEG.is_file():
        raise FileNotFoundError(f"FFmpeg not found: {FFMPEG}")
    originals = {path.name: digest(path) for path in inputs}
    raw_chapters = {stem: json.loads((WORK / (stem + "-chapters.json")).read_text(encoding="utf-8-sig")) for stem in TITLES}
    # Validate both chapter files before producing any delivery output.
    groups = {stem: grouped_chapters(raw_chapters[stem]) for stem in TITLES}
    captions = {stem: srt_to_vtt((WORK / (stem + ".srt")).read_text(encoding="utf-8-sig")) for stem in TITLES}
    durations = {stem: max(float(item["start"]) + float(item["duration"]) for item in raw_chapters[stem]) for stem in TITLES}
    DEST.mkdir(parents=True, exist_ok=True)
    report = {"status": "running", "started_at_utc": datetime.now(timezone.utc).isoformat(), "delivery_folder": str(DEST.relative_to(ROOT)), "files": [], "source_sha256": originals}
    report_path = WORK / "delivery-validation.json"
    try:
        for source in inputs:
            target = DEST / source.name
            temporary = target.with_name(target.name + ".packaging-tmp")
            shutil.copy2(source, temporary)
            temporary.replace(target)
            if digest(target) != originals[source.name]:
                raise ValueError(f"Copy hash mismatch: {target.name}")
        for stem in TITLES:
            print(f"Create silent copy: {stem}", flush=True)
            temporary = DEST / (stem + "-silent.packaging.mp4")
            run_ffmpeg(["-y", "-i", str(WORK / (stem + ".mp4")), "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", str(temporary)])
            temporary.replace(DEST / (stem + "-silent.mp4"))
            write_text(DEST / (stem + ".vtt"), captions[stem][0])
        write_text(DEST / "index.html", page(groups[TITLES[0]], durations[TITLES[0]], durations[TITLES[1]]))
        report["html_links"] = validate_links(DEST / "index.html")
        report["caption_cues"] = {stem: captions[stem][1] for stem in TITLES}
        report["logical_chapters"] = groups[TITLES[0]]
        report["source_copies_match"] = True
        for stem in TITLES:
            for suffix in (".mp4", "-silent.mp4"):
                report["files"].append(validate_video(DEST / (stem + suffix)))
        final_source_hashes = {path.name: digest(path) for path in inputs}
        report["source_files_unchanged"] = originals == final_source_hashes
        if not report["source_files_unchanged"]:
            raise ValueError("A source artifact changed while packaging; wait for encoding to finish and rerun")
        report["delivery_sha256"] = {path.name: digest(path) for path in sorted(DEST.iterdir()) if path.is_file() and ".packaging" not in path.name}
        report["status"] = "passed"
    except Exception as failure:
        report["status"] = "failed"
        report["error"] = str(failure)
        raise
    finally:
        report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
        write_text(report_path, json.dumps(report, indent=2) + "\n")
    print(f"Ready: {DEST / 'index.html'}\nValidation: {report_path}", flush=True)


if __name__ == "__main__":
    main()
