"""Source-checked fictional account setup for the narrated PSI walkthrough.

This is composed animation, not captured app UI. It never requests an email,
creates an account, uploads a photo, or accesses a service. The caller supplies
the existing render_demo module as ``ui`` and draws any animated tap overlay.

Sources: mobile/src/app/account/index.tsx and account/sign-up.tsx;
mobile/src/components/vehicle-photo-picker.tsx. Public preview authentication
is disabled; these scenes illustrate the normal app's approved-account flow.
"""

from math import floor


SCENES = [
    {
        "id": "account_email",
        "title": "Start with your email.",
        "chapter": "ACCOUNT SETUP",
        "narration": "PSI sets up new customer access. Once approved, enter your email and request a six-digit sign-in code. No password is needed.",
        "caption": "Approved customer access · fictional email animation",
        "duration": 11,
        "taps": [(1.2, 342, 621), (7.3, 392, 760)],
    },
    {
        "id": "account_verify",
        "title": "Verify your sign-in code.",
        "chapter": "ACCOUNT SETUP",
        "narration": "Enter the six-digit code from your email, then verify and sign in. The screen shows a ten-minute expiry for the code.",
        "caption": "Illustrative code · no email sent or account accessed",
        "duration": 10,
        "taps": [(1.2, 344, 510), (6.8, 390, 711)],
    },
    {
        "id": "account_profile",
        "title": "Add your contact details.",
        "chapter": "ACCOUNT SETUP",
        "narration": "Add your first and last names and your mobile number. Your verified email stays with your account. Next, enter your vehicle.",
        "caption": "Fictional customer details · verified email stays fixed",
        "duration": 12,
        "taps": [(1.0, 352, 391), (3.0, 352, 536), (6.4, 352, 826)],
    },
    {
        "id": "account_vehicle",
        "title": "Set up your primary vehicle.",
        "chapter": "ACCOUNT SETUP",
        "narration": "Add registration, year, make and model. You can choose a vehicle photo, then save account details to complete the setup.",
        "caption": "2003 Holden Commodore VY SS · DEMO001",
        "duration": 13,
        "taps": [(0.8, 339, 268), (2.8, 339, 416), (4.2, 339, 564), (6.0, 339, 712), (10.8, 390, 1083)],
    },
    {
        "id": "account_saved",
        "title": "Your garage starts here.",
        "chapter": "ACCOUNT SETUP",
        "narration": "After saving, open My Garage to see your vehicle. Your profile and vehicle details stay together for your future PSI visits.",
        "caption": "Fictional saved state · no real customer record created",
        "duration": 10,
        "taps": [(7.5, 390, 1059)],
    },
]


def _seconds(scene_id, t, duration):
    reference = next(scene["duration"] for scene in SCENES if scene["id"] == scene_id)
    return max(0.0, min(reference, float(t) * reference / max(float(duration), 0.001)))


def _typed(value, t, start, end):
    """Even, deterministic typing, with a short blinking insertion caret."""
    if t < start:
        return ""
    if t >= end:
        return value
    portion = max(0.0, min(1.0, (t - start) / (end - start)))
    count = min(len(value), floor(portion * (len(value) + 1)))
    return value[:count] + ("│" if floor(t * 2.5) % 2 == 0 else "")


def _page(ui, title, eyebrow="Account setup"):
    im = ui.base(title, eyebrow)
    # Account routes have their own header and do not show the tab bar.
    ui.rect(im, (0, 1197, 779, 1299), ui.BG, ui.BG, w=1)
    return im


def _footer(im, ui, label="FICTIONAL ACCOUNT SETUP · NO LIVE CHANGES"):
    ui.rect(im, (36, 1210, 744, 1211), ui.LINE, ui.LINE, w=1)
    ui.text(im, label, 36, 1235, 21, ui.MUTED, True, width=708)


def _email(t, ui):
    im = _page(ui, "Sign in with email", "Account access")
    ui.text(im, "We’ll email you a six-digit sign-in code.\nNo password is required.", 36, 181, 31, ui.WHITE, width=708)
    ui.rect(im, (36, 304, 744, 508), ui.PANEL, ui.LINE)
    ui.text(im, "Need an account?", 60, 326, 31, ui.WHITE, True)
    ui.text(im, "New customer accounts are set up by PSI.", 60, 373, 27, ui.MUTED, width=660)
    ui.button(im, "Contact PSI for account access →", 421, True, 58, 664)
    ui.field(im, "Email", _typed("alex.driver@example.com", t, 1.35, 5.35), 547, active=1.2 <= t < 7.3)
    ui.button(im, "Email my sign-in code", 721)
    if t >= 7.7:
        ui.rect(im, (36, 854, 744, 1119), ui.PANEL, ui.CYAN)
        ui.icon(im, "mail-outline", 62, 878, 40)
        ui.text(im, "If this email belongs to an approved PSI account, a six-digit sign-in code will arrive shortly. Enter it below within 10 minutes.", 60, 941, 29, ui.WHITE, width=657)
    else:
        ui.text(im, "Use your approved PSI email address.", 36, 861, 29, ui.MUTED, width=708)
    _footer(im, ui, "FICTIONAL SIGN-IN · NO EMAIL SENT")
    return im


def _verify(t, ui):
    im = _page(ui, "Sign in with email", "Account access")
    ui.text(im, "Enter the code from your email.", 36, 181, 31, ui.WHITE, width=708)
    ui.field(im, "Email", "alex.driver@example.com", 267)
    ui.field(im, "Six-digit code", _typed("482193", t, 1.45, 4.65), 437, active=1.2 <= t < 6.8)
    ui.text(im, "Expires after 10 minutes", 36, 571, 28, ui.MUTED)
    ui.button(im, "Verify and sign in", 672)
    ui.button(im, f"Request a new code in {max(0, 60 - floor(t))}s", 782, True)
    if t >= 7.2:
        ui.rect(im, (36, 925, 744, 1080), ui.PANEL, ui.GREEN)
        ui.icon(im, "checkmark-circle-outline", 60, 949, 43, ui.GREEN)
        ui.text(im, "Signed in. Your account is loading.", 119, 953, 31, ui.WHITE, True, width=592)
    else:
        ui.text(im, "A six-digit email code keeps sign-in simple.", 36, 934, 29, ui.MUTED, width=708)
    _footer(im, ui, "ILLUSTRATIVE CODE · NO ACCOUNT ACCESSED")
    return im


def _profile(t, ui):
    im = _page(ui, "One profile.\nEvery PSI visit.")
    ui.text(im, "Your details", 36, 267, 34, ui.WHITE, True)
    ui.field(im, "First name", _typed("Alex", t, 1.15, 2.25), 320, active=1.0 <= t < 2.6)
    ui.field(im, "Last name", _typed("Driver", t, 3.15, 4.65), 465, active=3.0 <= t < 5.1)
    ui.field(im, "Email", "alex.driver@example.com", 610)
    ui.icon(im, "lock-closed-outline", 688, 669, 27, ui.MUTED)
    ui.field(im, "Mobile", _typed("0491 570 006", t, 6.55, 9.0), 755, active=6.4 <= t < 9.4)
    ui.rect(im, (36, 931, 744, 1089), ui.PANEL, ui.LINE)
    ui.text(im, "Your privacy", 60, 951, 29, ui.WHITE, True)
    ui.text(im, "Only you and authorised PSI staff can view your saved profile, vehicle and photo.", 60, 998, 27, ui.MUTED, width=651)
    ui.text(im, "Primary vehicle", 36, 1133, 32, ui.CYAN, True)
    ui.icon(im, "arrow-down-outline", 695, 1135, 34)
    _footer(im, ui)
    return im


def _vehicle(t, ui):
    im = _page(ui, "Primary vehicle")
    for label, value, y, start, end in [
        ("Registration", "DEMO001", 197, 0.95, 2.2),
        ("Year", "2003", 345, 2.95, 3.8),
        ("Make", "Holden", 493, 4.35, 5.5),
        ("Model", "Commodore VY SS", 641, 6.15, 8.4),
    ]:
        ui.field(im, label, _typed(value, t, start, end), y, active=start - 0.15 <= t < end + 0.35)
    ui.text(im, "Vehicle photo", 36, 811, 30, ui.WHITE, True)
    ui.text(im, "Optional", 615, 817, 24, ui.MUTED)
    ui.button(im, "Take photo", 867, True, 36, 337)
    ui.button(im, "Choose photo", 867, True, 407, 337)
    ui.text(im, "Choose one image from this device.", 36, 965, 27, ui.MUTED, width=708)
    ui.button(im, "Save account details", 1044)
    if t >= 11.15:
        ui.text(im, "Saving account details…", 36, 1151, 28, ui.CYAN, True)
    _footer(im, ui)
    return im


def _saved(t, ui):
    im = _page(ui, "One profile.\nEvery PSI visit.")
    ui.rect(im, (36, 278, 744, 496), ui.PANEL, ui.GREEN)
    ui.icon(im, "checkmark-circle-outline", 60, 304, 43, ui.GREEN)
    ui.text(im, "Profile structure ready", 118, 309, 31, ui.WHITE, True, width=580)
    ui.text(im, "Your profile and vehicle details were saved to your private PSI account.", 60, 374, 30, ui.WHITE, width=653)
    ui.rect(im, (36, 531, 744, 976), ui.PANEL, ui.LINE)
    ui.text(im, "Your details", 61, 555, 25, ui.CYAN, True)
    ui.text(im, "Alex Driver", 61, 603, 36, ui.WHITE, True)
    ui.text(im, "alex.driver@example.com", 61, 658, 30, ui.WHITE)
    ui.text(im, "0491 570 006", 61, 706, 30, ui.WHITE)
    ui.rect(im, (61, 770, 719, 771), ui.LINE, ui.LINE, w=1)
    ui.text(im, "Primary vehicle", 61, 798, 25, ui.CYAN, True)
    ui.text(im, "2003 Holden Commodore VY SS", 61, 843, 31, ui.WHITE, True, width=653)
    ui.text(im, "DEMO001", 61, 903, 29, ui.MUTED, True)
    ui.button(im, "Open My Garage", 1020, True)
    ui.button(im, "Book without an account", 1110, True)
    _footer(im, ui, "FICTIONAL SAVED STATE · NO RECORD CREATED")
    return im


def draw(scene_id, t, duration, ui):
    """Return a deterministic 780 × 1300 RGB onboarding frame.

    ``t`` and ``duration`` are in seconds. Unknown IDs raise ``ValueError``.
    """
    renderers = {
        "account_email": _email,
        "account_verify": _verify,
        "account_profile": _profile,
        "account_vehicle": _vehicle,
        "account_saved": _saved,
    }
    if scene_id not in renderers:
        raise ValueError(f"Unknown onboarding scene: {scene_id}")
    im = renderers[scene_id](_seconds(scene_id, t, duration), ui)
    if im.size != (780, 1300):
        raise ValueError(f"Unexpected onboarding frame size: {im.size}")
    return im.convert("RGB")
