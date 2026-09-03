"""Generate synthetic Apple review attachments. Never connects to a live service.

Requires reportlab. Render the PDFs to JPG with Poppler for the staff publisher.
All values below are fictional, even where they match the dedicated test vehicle.
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from pypdf import PdfReader

OUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "apple-review"
OUT.mkdir(parents=True, exist_ok=True)
INK = HexColor("#111820")
BLUE = HexColor("#155D78")
ICE = HexColor("#65CFF8")
GREY = HexColor("#DBE3E7")
MUTED = HexColor("#465762")
LIGHT = HexColor("#F1F5F7")
DATE = "03/09/2026"
VEHICLE = "2003 Holden VY SS"
REG = "TEST001"


def text(c, x, y, value, size=11, bold=False, color=INK):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, value)


def base(filename, title, subtitle, page_size=A4):
    c = canvas.Canvas(str(OUT / filename), pagesize=page_size, invariant=1)
    c.setTitle("PSI demonstration only - " + title)
    c.setAuthor("PSI Performance PTY LTD")
    w, h = page_size
    c.setFillColor(INK)
    c.rect(0, h - 132, w, 132, fill=1, stroke=0)
    text(c, 36, h - 44, "PSI", 30, True, white)
    text(c, 36, h - 63, "PERFORMANCE", 10, True, GREY)
    text(c, 36, h - 94, title, 23, True, white)
    text(c, 36, h - 115, subtitle, 10, False, GREY)
    c.setFillColor(ICE)
    c.rect(0, h - 159, w, 27, fill=1, stroke=0)
    text(c, 36, h - 150, "DEMONSTRATION ONLY  /  FICTIONAL DATA  /  APP REVIEW", 10, True)
    c.setStrokeColor(GREY)
    c.line(36, 57, w - 36, 57)
    text(c, 36, 40, "PSI Performance PTY LTD | Synthetic app-review sample", 9, True, MUTED)
    text(c, 36, 26, "No actual work, measured result or payment obligation. Not a tax invoice.", 8, False, MUTED)
    return c, w, h


def field(c, x, y, label, value):
    text(c, x, y, label.upper(), 8, True, BLUE)
    text(c, x, y - 18, value, 12, True)


def inspection():
    c, w, h = base("demo-workshop-inspection.pdf", "Workshop inspection", "DEMO-INSPECTION-001 | Sample customer-visible repair history")
    field(c, 36, h - 190, "Customer", "PSI App Review")
    field(c, 310, h - 190, "Inspection date", DATE)
    field(c, 36, h - 244, "Vehicle", VEHICLE)
    field(c, 310, h - 244, "Registration / sample odometer", REG + " / 120,000 km")
    text(c, 36, h - 303, "SAMPLE INSPECTION FINDINGS", 12, True, BLUE)
    rows = [
        ("Engine bay", "Example visual check recorded. No actual inspection performed."),
        ("Fluids", "Example oil and coolant level check shown for review."),
        ("Brakes and tyres", "Example condition entry demonstrates report history."),
        ("Road test", "Not performed. This is a fictional demonstration record."),
    ]
    y = h - 330
    for label, detail in rows:
        c.setFillColor(LIGHT)
        c.rect(36, y - 46, w - 72, 58, fill=1, stroke=0)
        text(c, 48, y - 5, label, 11, True)
        text(c, 48, y - 26, detail, 9)
        y -= 70
    text(c, 36, y - 10, "CUSTOMER SUMMARY", 12, True, BLUE)
    text(c, 36, y - 34, "This sample demonstrates how PSI workshop records appear in the app.", 10)
    text(c, 36, y - 51, "No maintenance, inspection or repair has been performed on this vehicle.", 10)
    text(c, 36, y - 80, "Sample follow-up: Monitor tyre wear at a future workshop visit.", 10, True)
    c.save()


def invoice():
    c, w, h = base("demo-invoice-not-payable.pdf", "Sample invoice", "DEMO-INV-001 | NOT PAYABLE | NOT A TAX INVOICE")
    field(c, 36, h - 190, "Sample customer", "PSI App Review")
    field(c, 310, h - 190, "Sample invoice date", DATE)
    field(c, 36, h - 244, "Vehicle", VEHICLE)
    field(c, 310, h - 244, "Registration", REG)
    y = h - 300
    c.setFillColor(BLUE)
    c.rect(36, y - 23, w - 72, 32, fill=1, stroke=0)
    text(c, 48, y - 12, "FICTIONAL LINE ITEM", 10, True, white)
    text(c, w - 140, y - 12, "AMOUNT (AUD)", 10, True, white)
    for offset, title, amount in [(60, "Demo workshop inspection", "$200.00"), (105, "Demo labour and report preparation", "$185.00")]:
        text(c, 48, y - offset, title, 11)
        text(c, w - 124, y - offset, amount, 11, True)
    c.setStrokeColor(GREY)
    c.line(36, y - 129, w - 36, y - 129)
    for offset, title, amount in [(163, "Illustrative subtotal", "$385.00"), (194, "Illustrative GST (10%)", "$38.50"), (231, "Illustrative total", "$423.50")]:
        text(c, 245, y - offset, title, 11, offset == 231)
        text(c, w - 124, y - offset, amount, 12, True)
    c.setFillColor(LIGHT)
    c.rect(36, 164, w - 72, 113, fill=1, stroke=0)
    text(c, 52, 244, "AMOUNT DUE: $0.00 AUD", 19, True, BLUE)
    text(c, 52, 219, "The amounts above exist only to demonstrate the invoice screen.", 10)
    text(c, 52, 200, "Do not pay, claim GST, enter into Xero or use as proof of purchase.", 10)
    text(c, 36, 126, "No bank details, PayID, payment link or real tax identifiers are included.", 10, False, MUTED)
    c.save()


def dyno():
    c, w, h = base("demo-dyno-graph.pdf", "Sample hub dyno graph", f"{VEHICLE} | {REG} | {DATE} | Fictional 98 RON example", landscape(A4))
    # Synthetic power trace; torque calculated from HP so both axes agree.
    rpm = list(range(1500, 6001, 500))
    hp = [65, 100, 145, 180, 225, 264, 291, 310, 305, 290]
    torque = [power * 7120.9092 / speed for power, speed in zip(hp, rpm)]
    assert max(hp) == 310 and round(max(torque)) == 470
    text(c, 55, h - 189, "PEAK POWER  310 HP AT HUBS", 15, True, BLUE)
    text(c, 470, h - 189, "PEAK TORQUE  470 Nm AT HUBS", 15, True, MUTED)
    x0, x1, y0, y1 = 70, w - 70, 145, h - 224
    def xp(r): return x0 + (r - 1500) / 4500 * (x1 - x0)
    def yp(p): return y0 + p / 350 * (y1 - y0)
    def yt(t): return y0 + t / 550 * (y1 - y0)
    c.setLineWidth(.5)
    c.setStrokeColor(GREY)
    for value in range(0, 351, 50):
        yy = yp(value)
        c.line(x0, yy, x1, yy)
        text(c, x0 - 32, yy - 3, str(value), 8, color=MUTED)
        text(c, x1 + 8, yy - 3, str(round(value / 350 * 550)), 8, color=MUTED)
    for speed in rpm:
        xx = xp(speed)
        c.line(xx, y0, xx, y1)
        text(c, xx - 11, y0 - 16, str(speed), 8, color=MUTED)
    text(c, x0 - 25, y1 + 12, "HP", 9, True, BLUE)
    text(c, x1 + 7, y1 + 12, "Nm", 9, True, MUTED)
    text(c, w / 2 - 34, y0 - 35, "ENGINE RPM", 9, True)
    for values, scale, color, dashed in [(hp, yp, BLUE, False), (torque, yt, MUTED, True)]:
        c.setStrokeColor(color)
        c.setLineWidth(2.5)
        c.setDash(6, 3) if dashed else c.setDash()
        path = c.beginPath()
        path.moveTo(xp(rpm[0]), scale(values[0]))
        for speed, value in zip(rpm[1:], values[1:]):
            path.lineTo(xp(speed), scale(value))
        c.drawPath(path)
    c.setDash()
    text(c, 70, 85, "Solid blue: power (HP)   |   Dashed grey: torque (Nm)   |   Synthetic curve, not a measured run", 10)
    c.save()


inspection()
invoice()
dyno()
for path in sorted(OUT.glob("*.pdf")):
    pdf = PdfReader(path)
    assert len(pdf.pages) == 1, path
    content = pdf.pages[0].extract_text()
    assert "DEMONSTRATION ONLY" in content and REG in content, path
    assert path.stat().st_size < 6 * 1024 * 1024
    print(f"Verified {path.name}: one page, fictional-data label and vehicle present")
