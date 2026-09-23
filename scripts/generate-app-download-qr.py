from pathlib import Path

from PIL import Image
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "download"
URL = "https://juztforkickz.github.io/psi-performance-booking-app/download/"
QR_MODULE_SCALE = 32
QR_BORDER_MODULES = 4
QR_PNG_SIZE = 2048


def create_qr_assets() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    widget = QrCodeWidget(URL, barLevel="H")
    widget.qr.make()
    matrix = widget.qr.modules
    count = widget.qr.moduleCount
    total_modules = count + QR_BORDER_MODULES * 2
    size = total_modules * QR_MODULE_SCALE
    image = Image.new("RGB", (size, size), "white")
    pixels = image.load()
    for row in range(count):
        for column in range(count):
            if not matrix[row][column]:
                continue
            x0 = (column + QR_BORDER_MODULES) * QR_MODULE_SCALE
            y0 = (row + QR_BORDER_MODULES) * QR_MODULE_SCALE
            for y in range(y0, y0 + QR_MODULE_SCALE):
                for x in range(x0, x0 + QR_MODULE_SCALE):
                    pixels[x, y] = (0, 0, 0)
    # Preserve square modules at their native scale, then centre them on an
    # exact 2048 px canvas for social media and high-resolution printing.
    canvas_image = Image.new("RGB", (QR_PNG_SIZE, QR_PNG_SIZE), "white")
    offset = (QR_PNG_SIZE - size) // 2
    canvas_image.paste(image, (offset, offset))
    canvas_image.save(OUTPUT / "psi-app-download-qr-2048.png", quality=100)

    rects = []
    for row in range(count):
        for column in range(count):
            if matrix[row][column]:
                rects.append(f'<rect x="{column + QR_BORDER_MODULES}" y="{row + QR_BORDER_MODULES}" width="1" height="1"/>')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_modules} {total_modules}" '
        f'shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>'
        f'<g fill="#000">{"".join(rects)}</g></svg>'
    )
    (OUTPUT / "psi-app-download-qr.svg").write_text(svg, encoding="utf-8")


def create_a4_poster() -> None:
    path = OUTPUT / "psi-app-download-workshop-poster-a4.pdf"
    page_width, page_height = A4
    pdf = canvas.Canvas(str(path), pagesize=A4)
    pdf.setFillColor(HexColor("#050505"))
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#65CFF8"))
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawCentredString(page_width / 2, page_height - 58, "YOUR CAR. ITS COMPLETE STORY.")
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 28)
    pdf.drawCentredString(page_width / 2, page_height - 98, "DOWNLOAD THE PSI APP")
    pdf.setFillColor(HexColor("#C8CED3"))
    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(page_width / 2, page_height - 126, "Workshop photos, bookings, reports and reminders in one private account.")

    qr_size = 310
    qr_x = (page_width - qr_size) / 2
    qr_y = page_height - 470
    pdf.setFillColor(white)
    pdf.roundRect(qr_x - 14, qr_y - 14, qr_size + 28, qr_size + 28, 8, fill=1, stroke=0)
    pdf.drawImage(str(OUTPUT / "psi-app-download-qr-2048.png"), qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True, mask="auto")

    pdf.setFillColor(HexColor("#65CFF8"))
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawCentredString(page_width / 2, qr_y - 48, "SCAN TO DOWNLOAD")
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(page_width / 2, qr_y - 76, "14 DAYS OF PERFORMANCE+ WHEN PSI PUBLISHES YOUR FIRST PHOTO GALLERY")
    pdf.setFillColor(HexColor("#C8CED3"))
    pdf.setFont("Helvetica", 11)
    pdf.drawCentredString(page_width / 2, qr_y - 99, "No payment. No automatic renewal. Keep access with Performance+ after the trial.")
    pdf.setFillColor(HexColor("#929AA1"))
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(page_width / 2, 42, URL)
    pdf.save()


if __name__ == "__main__":
    create_qr_assets()
    create_a4_poster()
