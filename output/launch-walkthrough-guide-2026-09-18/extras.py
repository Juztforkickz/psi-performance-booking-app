"""Source-checked supplementary customer scenes for the animated PSI guide.

These are composed illustrations. No account, store, notification, email or
external service is accessed. The containing renderer supplies the demo label.
"""
from PIL import Image, ImageDraw


SCENES = [
    {
        "id": "extras_plus", "title": "Choose your level of access",
        "chapter": "Performance+", "duration": 12,
        "narration": "Performance Plus is optional. Your everyday account stays free. One subscription unlocks detailed workshop records, photos, invoices and dyno files across every vehicle.",
        "caption": "Explore what Performance+ includes.",
        "taps": [(4.0, 390, 920)],
    },
    {
        "id": "extras_notifications", "title": "Choose the updates you receive",
        "chapter": "Settings & Notifications", "duration": 12,
        "narration": "Choose booking updates, service reminders, event alerts and notification sounds. Opted-in service reminders use the completed service date. Your phone controls device alerts.",
        "caption": "Turn on Service & visit reminders.",
        "taps": [(3.0, 664, 544)],
    },
    {
        "id": "extras_theme", "title": "Make the app comfortable to use",
        "chapter": "Theme preference", "duration": 10,
        "narration": "Choose Dark or Bright to suit your preference. Select Automatic to follow your device setting, then continue using your garage, bookings and reports.",
        "caption": "Choose your preferred theme.",
        "taps": [(3.0, 389, 411), (6.0, 627, 411)],
    },
    {
        "id": "extras_events", "title": "Keep up with PSI events",
        "chapter": "PSI Events", "duration": 11,
        "narration": "Sign in to view upcoming PSI events. On the installed app, allow notifications to set an event reminder. This fictional example schedules nothing.",
        "caption": "Open an event and review its reminder.",
        "taps": [(4.5, 390, 755)],
    },
    {
        "id": "extras_cars", "title": "Ask PSI about listing your car",
        "chapter": "Customer Cars for Sale", "duration": 12,
        "narration": "Customer Cars for Sale shows owner-approved listings. Ask PSI to review your car by opening an email draft. Nothing is published or sent automatically.",
        "caption": "Open a listing request draft.",
        "taps": [(4.5, 390, 961)],
    },
    {
        "id": "extras_account", "title": "Your account and support",
        "chapter": "Account & help", "duration": 11,
        "narration": "Use Account to edit your profile, review privacy information or sign out. Open support for help with sign-in, vehicle records, booking requests and account questions.",
        "caption": "Open Support & account help.",
        "taps": [(5.0, 390, 882)],
    },
]


def _copy(ui, im, content, y, size=29, color=None, bold=False, x=58, width=660):
    return ui.text(im, content, x, y, size, color or ui.MUTED, bold, width)


def _card(ui, im, y, height, border=None):
    ui.rect(im, (36, y, 744, y + height), ui.PANEL, border or ui.LINE, 10, 2)


def _switch(ui, im, y, enabled):
    ui.rect(im, (617, y, 713, y + 52), ui.CYAN if enabled else '#555b61', None, 26)
    ImageDraw.Draw(im).ellipse((666 if enabled else 624, y + 7, 706 if enabled else 664, y + 45), fill=ui.WHITE)


def _plus(t, ui):
    if t < 4.25:
        im = ui.base('Invoice archive', 'Performance+ private records', 'Reports')
        ui.icon(im, 'lock-closed-outline', 320, 228, 112)
        _copy(ui, im, '7 private PSI records waiting', 383, 36, ui.WHITE, True)
        _copy(ui, im, 'Open the private details and attached files with Performance+.', 459, 31)
        _card(ui, im, 611, 205)
        _copy(ui, im, 'ONE SUBSCRIPTION', 636, 25, ui.CYAN, True)
        _copy(ui, im, 'Every Performance+ category.\nEvery vehicle in your PSI account.', 685, 31, ui.WHITE)
        ui.button(im, 'See everything included with Performance+', 881)
        _copy(ui, im, 'Your original invoice is still emailed as normal.', 1010, 28)
        _copy(ui, im, 'Optional subscription', 1116, 28, ui.CYAN, True)
        return im

    im = ui.base('Performance+', 'Your car. Its complete story.', 'Reports')
    _card(ui, im, 191, 127)
    _copy(ui, im, 'CURRENT PLAN', 210, 23, ui.CYAN, True)
    _copy(ui, im, 'PSI Free', 249, 34, ui.WHITE, True)
    _card(ui, im, 352, 221)
    _copy(ui, im, 'ALWAYS PART OF PSI FREE', 374, 25, ui.CYAN, True)
    _copy(ui, im, 'Profile, garage and your vehicle photo\nBookings, reminders and notifications\nService dates, kilometres and your notes', 421, 29, ui.WHITE)
    _card(ui, im, 604, 334, ui.CYAN)
    _copy(ui, im, 'PERFORMANCE+', 625, 26, ui.CYAN, True)
    for i, label in enumerate([
        'Service & repair history · Recommended work',
        'Dyno results & graphs · Invoice archive',
        'Workshop photos',
        'Modifications & build history',
        'Reports & documents',
    ]):
        ui.icon(im, 'checkmark-circle-outline', 58, 677 + i * 45, 25)
        _copy(ui, im, label, 674 + i * 45, 27, ui.WHITE, x=100, width=620)
    _copy(ui, im, 'One subscription covers every vehicle\nin your PSI account.', 974, 30, ui.WHITE)
    _copy(ui, im, 'PSI workshop records stay read-only.', 1096, 28, ui.CYAN)
    return im


def _notifications(t, ui):
    im = ui.base('Settings &\nNotifications', 'Your preferences', 'Settings')
    ui.text(im, 'Notification preferences', 36, 250, 34, ui.WHITE, True)
    ui.text(im, 'Saved to your account', 36, 300, 26, ui.CYAN)
    enabled = t >= 3.25
    rows = [
        ('Booking updates', 'Confirmations and date changes.', True),
        ('Service & visit reminders', 'Visits and opted-in service milestones.', enabled),
        ('PSI event alerts', 'New and updated event details.', True),
        ('Notification sound', 'Your phone’s sound settings still apply.', True),
    ]
    for i, (label, detail, on) in enumerate(rows):
        y = 353 + i * 151
        _card(ui, im, y, 132, ui.CYAN if i == 1 and enabled else None)
        _copy(ui, im, label, y + 19, 28, ui.WHITE, True, width=545)
        _copy(ui, im, detail, y + 76, 25, width=642)
        _switch(ui, im, y + 14, on)
    _copy(ui, im, 'Device alerts', 1001, 29, ui.WHITE, True)
    _copy(ui, im, 'Enable device notifications in the installed app.\nYour phone controls banners, sounds and badges.', 1050, 26)
    return im


def _theme(t, ui):
    preference = 'dark' if t < 3.25 else 'bright' if t < 6.25 else 'automatic'
    bright = preference == 'bright'
    bg, panel, ink, muted, accent = ('#f5f7f8', '#ffffff', '#11181c', '#49565c', '#19759a') if bright else (ui.BG, ui.PANEL, ui.WHITE, ui.MUTED, ui.CYAN)
    im = Image.new('RGB', (780, 1300), bg)
    ui.text(im, 'YOUR PREFERENCES', 36, 28, 24, accent, True)
    ui.text(im, 'Settings &\nNotifications', 36, 77, 56, ink, True, 710)
    ui.text(im, 'Theme preference', 36, 283, 34, ink, True)
    for i, (key, label) in enumerate([('dark', 'Dark'), ('bright', 'Bright'), ('automatic', 'Automatic')]):
        x = 36 + i * 242
        chosen = key == preference
        ui.rect(im, (x, 363, x + 224, 461), accent if chosen else panel, accent if chosen else muted, 9, 2)
        ui.text(im, label, x + 23, 388, 29, bg if chosen else ink, True)
    if preference == 'automatic':
        ui.text(im, 'Automatic follows your device setting\nfor dark and bright.', 36, 505, 31, muted, False, 710)
    else:
        ui.text(im, 'Your app in ' + ('Bright' if bright else 'Dark') + '.', 36, 505, 32, muted)
    ui.rect(im, (36, 658, 744, 1095), panel, muted, 12, 2)
    if bright:
        ui.rect(im, (55, 675, 313, 794), '#111111', '#111111', 8)
    ui.fit(im, ui.ASSETS / 'psi-logo.png', (64, 681, 232, 106))
    ui.text(im, 'Your preferences', 65, 820, 31, ink, True)
    ui.text(im, 'A clear view of your garage,\nbookings and reports.', 65, 888, 33, muted, False, 645)
    ui.icon(im, 'checkmark-circle-outline', 65, 1011, 40, accent)
    ui.text(im, label_for_theme(preference), 123, 1008, 29, ink, True)
    ui.nav(im, 'Settings')
    if bright:
        ui.rect(im, (0, 1198, 780, 1300), panel, muted, 0, 2)
        for i, (label, symbol) in enumerate([
            ('Home', 'home-outline'), ('My Garage', 'car-sport-outline'),
            ('Bookings', 'calendar-outline'), ('Reports', 'document-text-outline'),
            ('Settings', 'notifications-outline'),
        ]):
            color = accent if label == 'Settings' else muted
            ui.icon(im, symbol, i * 156 + 60, 1210, 35, color)
            width = ImageDraw.Draw(im).textlength(label, font=ui.font(20, True))
            ui.text(im, label, i * 156 + (156 - width) / 2, 1254, 20, color, True)
    return im


def label_for_theme(value):
    return {'dark': 'Dark selected', 'bright': 'Bright selected', 'automatic': 'Automatic selected'}[value]


def _events(t, ui):
    im = ui.base('PSI Events', 'Upcoming PSI events and reminders.')
    ui.text(im, 'Upcoming events', 36, 211, 34, ui.WHITE, True)
    _card(ui, im, 280, 559)
    ui.icon(im, 'flag-outline', 62, 310, 43)
    _copy(ui, im, 'Open workshop morning', 380, 37, ui.WHITE, True)
    _copy(ui, im, '17/10/2026 · 9:00 am', 449, 30, ui.CYAN, True)
    _copy(ui, im, 'PSI workshop · fictional event', 505, 28)
    _copy(ui, im, 'A sample event to demonstrate\nevent details and reminder controls.', 567, 29)
    ui.button(im, 'Set 60 min reminder', 716, outline=True, x=60, w=660)
    if t >= 4.75:
        _card(ui, im, 891, 254, ui.CYAN)
        _copy(ui, im, 'Installed app + permission', 912, 31, ui.WHITE, True)
        _copy(ui, im, 'Allow notifications in your phone settings\nto use event reminders.', 969, 28)
        _copy(ui, im, 'No reminder set for this fictional event.', 1082, 26, ui.CYAN, True)
    else:
        _copy(ui, im, 'Event updates', 915, 32, ui.WHITE, True)
        _copy(ui, im, 'New or changed events appear here\nand can notify your device.', 974, 29)
    return im


def _cars(t, ui):
    if t < 4.75:
        im = ui.base('Customer Cars\nfor Sale', 'PSI-cared-for vehicles')
        _card(ui, im, 286, 370)
        ui.icon(im, 'car-sport-outline', 322, 317, 112)
        ui.center(im, 'No approved listings right now', 477, 34, ui.WHITE, True)
        _copy(ui, im, 'New owner-approved customer vehicles\nwill appear here when they become available.', 552, 29)
        _copy(ui, im, 'Selling your PSI-worked car?', 714, 30, ui.CYAN, True)
        _copy(ui, im, 'Ask PSI to review a listing', 770, 36, ui.WHITE, True)
        _copy(ui, im, 'Send the vehicle, expected price\nand current kilometres.', 835, 29)
        ui.button(im, 'Ask PSI to list my car', 922)
        _copy(ui, im, 'PSI contacts you before any details\nor photos are published.', 1048, 28)
        return im
    im = ui.base('Email draft', 'External email app · unsent')
    ui.field(im, 'To', 'info@psiperformance.com.au', 209)
    ui.field(im, 'Subject', 'Customer car listing request', 354)
    _card(ui, im, 517, 443)
    _copy(ui, im, 'Hi PSI,', 541, 30, ui.WHITE)
    _copy(ui, im, 'I would like to discuss listing my car\nin Customer Cars for Sale.', 601, 30, ui.WHITE)
    _copy(ui, im, 'Vehicle: Holden Commodore VY SS\nExpected price: [AUD]\nCurrent kilometres: [your reading]\nBest contact number: [your number]', 710, 28)
    _copy(ui, im, 'Owner permission + PSI review', 1003, 32, ui.CYAN, True)
    _copy(ui, im, 'Nothing sent. Nothing published.', 1080, 30, ui.WHITE, True)
    return im


def _account(t, ui):
    if t < 5.25:
        im = ui.base('Your PSI account.', 'Customer account')
        _card(ui, im, 208, 311)
        _copy(ui, im, 'SIGNED IN', 233, 25, ui.CYAN, True)
        _copy(ui, im, 'Alex Driver', 289, 41, ui.WHITE, True)
        _copy(ui, im, 'alex.driver@example.com', 360, 29)
        _copy(ui, im, 'Vehicles · 1 saved', 427, 30, ui.WHITE)
        ui.button(im, 'Edit my profile', 561)
        ui.button(im, 'Sign out', 698, outline=True)
        ui.button(im, 'Support & account help', 843, outline=True)
        ui.button(im, 'Privacy & data handling', 988, outline=True)
        return im
    im = ui.base('Account &\nbooking help', 'PSI support')
    _copy(ui, im, 'Contact PSI', 269, 35, ui.WHITE, True)
    _copy(ui, im, 'Monday–Friday · 8:30 am–5:00 pm', 333, 29)
    ui.button(im, 'Call 0433 431 781', 415)
    ui.button(im, 'Email info@psiperformance.com.au', 525, outline=True)
    _card(ui, im, 659, 230)
    _copy(ui, im, 'Sign-in help', 681, 33, ui.WHITE, True)
    _copy(ui, im, 'Use the newest six-digit email code\nwithin 10 minutes. Codes work once.', 746, 29)
    ui.button(im, 'Privacy & data handling', 939, outline=True)
    _copy(ui, im, 'Sign-in, records, bookings and privacy enquiries.', 1073, 28)
    return im


def draw(scene_id, t, duration, ui):
    """Return one 780×1300 RGB screen; taps use these screen coordinates."""
    drawers = {
        'extras_plus': _plus,
        'extras_notifications': _notifications,
        'extras_theme': _theme,
        'extras_events': _events,
        'extras_cars': _cars,
        'extras_account': _account,
    }
    if scene_id not in drawers:
        raise ValueError('Unknown supplementary scene: ' + str(scene_id))
    return drawers[scene_id](max(0.0, min(float(t), float(duration))), ui).convert('RGB')
