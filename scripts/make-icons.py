#!/usr/bin/env python3
"""Generate every Docent Studio icon asset from the pixel mark.

The mark is the Docent Studio tile from smartloop.ai: a white tile carrying the
pixel lantern in ink, with its two panes in the brand pink. It is defined here as a
9x9 grid, so every output is drawn from cells rather than scaled from a bitmap
and stays crisp at any size.

Run from the repo root (macOS, for iconutil):

    python3 scripts/make-icons.py

Writes:
    build/icon.icns                       macOS app icon
    build/smartloop.icon/Assets/mark.png  Icon Composer layer
    build/installerSidebar.bmp            NSIS sidebar (mark only; text is kept)
    public/img/logo.png                   Windows / Linux / window icon
    public/img/tray.png                   tray glyph, white (Windows / Linux)
    public/img/trayTemplate{,@2x}.png     tray glyph, template (macOS)
    packaging/snap/snap/icon.png          snap icon
    src/app/favicon.ico                   favicon
"""
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter

INK = (10, 10, 15)            # #0a0a0f
PINK = (236, 72, 153)         # #ec4899
TILE_TOP = (255, 255, 255)    # tile gradient, top to bottom
TILE_BOTTOM = (240, 240, 243) # #f0f0f3
TILE_EDGE = (10, 10, 20, 26)  # #0a0a141a hairline, keeps the tile on white

# (x, y, w, h) in grid cells. The mark spans x 1..8, y 0..9.
BODY = [
    (3, 0, 3, 1), (3, 1, 1, 1), (5, 1, 1, 1),
    (1, 2, 7, 1), (2, 3, 5, 1),
    (2, 4, 1, 3), (4, 4, 1, 3), (6, 4, 1, 3),
    (2, 7, 5, 1), (1, 8, 7, 1),
]
PANES = [(3, 4, 1, 3), (5, 4, 1, 3)]
GRID = 9

SS = 4  # supersampling for the tile's rounded corners


def draw_mark(img, cell, body=INK, panes=PINK):
    """Draw the mark centered on `img` with `cell` px per grid cell.

    `panes=None` leaves the panes transparent, for one-color glyphs.
    """
    d = ImageDraw.Draw(img)
    ox = (img.width - GRID * cell) // 2
    oy = (img.height - GRID * cell) // 2

    def fill(rects, color):
        for x, y, w, h in rects:
            d.rectangle(
                [ox + x * cell, oy + y * cell, ox + (x + w) * cell - 1, oy + (y + h) * cell - 1],
                fill=color,
            )

    fill(BODY, body)
    if panes:
        fill(PANES, panes)
    return img


def tile_icon(canvas, tile, radius, cell, shadow=False):
    """The white tile with the mark, centered on a transparent square canvas."""
    big = canvas * SS
    t, r = tile * SS, radius * SS
    off = (big - t) // 2

    gradient = Image.new("RGBA", (t, t))
    gd = ImageDraw.Draw(gradient)
    for y in range(t):
        k = y / (t - 1)
        gd.line(
            [(0, y), (t, y)],
            fill=tuple(round(a + (b - a) * k) for a, b in zip(TILE_TOP, TILE_BOTTOM)) + (255,),
        )
    mask = Image.new("L", (t, t), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, t - 1, t - 1], r, fill=255)

    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle(
            [off, off + 6 * SS, off + t - 1, off + t - 1 + 6 * SS], r, fill=(0, 0, 0, 70)
        )
        out = Image.alpha_composite(out, sh.filter(ImageFilter.GaussianBlur(10 * SS)))
    out.paste(gradient, (off, off), mask)

    edge = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        [off, off, off + t - 1, off + t - 1], r, outline=TILE_EDGE, width=max(SS, t // 400)
    )
    out = Image.alpha_composite(out, edge)

    draw_mark(out, cell * SS)
    return out.resize((canvas, canvas), Image.LANCZOS)


def glyph(width, height, cell, color):
    """The mark alone in one color, panes cut out."""
    return draw_mark(Image.new("RGBA", (width, height), (0, 0, 0, 0)), cell, body=color, panes=None)


def save(img, path):
    img.save(path, optimize=True)
    print(path)


def build_icns(master, path):
    """macOS .icns from the 1024px master, via iconutil."""
    work = tempfile.mkdtemp()
    iconset = os.path.join(work, "icon.iconset")
    os.mkdir(iconset)
    for size in (16, 32, 128, 256, 512):
        master.resize((size, size), Image.LANCZOS).save(os.path.join(iconset, f"icon_{size}x{size}.png"))
        master.resize((size * 2, size * 2), Image.LANCZOS).save(
            os.path.join(iconset, f"icon_{size}x{size}@2x.png")
        )
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", path], check=True)
    shutil.rmtree(work)
    print(path)


def build_sidebar(path):
    """Swap the mark on the NSIS sidebar, leaving its backdrop and text alone."""
    im = Image.open(path).convert("RGB")
    # The old mark sat on a near-black square; repaint that area from the
    # backdrop (a vertical gradient, sampled at the left edge) before pasting.
    px = im.load()
    for y in range(66, 158):
        for x in range(36, 128):
            px[x, y] = px[6, y]
    mark = tile_icon(64, 60, 14, 4)
    im.paste(mark, (82 - 32, 112 - 32), mark)
    im.save(path, format="BMP")
    print(path)


def main():
    # macOS: 824px tile on a 1024px canvas, per Apple's icon grid.
    mac = tile_icon(1024, 824, 185, 54, shadow=True)
    build_icns(mac, "build/icon.icns")

    # Icon Composer layer: the mark alone, the tile comes from the icon's fill.
    layer = draw_mark(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), 62)
    save(layer, "build/smartloop.icon/Assets/mark.png")

    # Windows / Linux draw the bitmap as-is, so the tile fills the canvas.
    logo = tile_icon(512, 480, 108, 32)
    save(logo, "public/img/logo.png")
    save(logo, "packaging/snap/snap/icon.png")
    logo.resize((256, 256), Image.LANCZOS).save(
        "src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print("src/app/favicon.ico")

    # Tray: the mark takes three quarters of the canvas, leaving padding all
    # round so it sits with the other menu bar / panel icons instead of
    # touching the bar's edges. 3px cells keep the @2x template on whole
    # pixels; the 1x one is that image halved.
    save(glyph(128, 128, 10, (255, 255, 255, 255)), "public/img/tray.png")
    template = glyph(36, 36, 3, (0, 0, 0, 255))
    save(template, "public/img/trayTemplate@2x.png")
    save(template.resize((18, 18), Image.LANCZOS), "public/img/trayTemplate.png")

    build_sidebar("build/installerSidebar.bmp")


if __name__ == "__main__":
    main()
