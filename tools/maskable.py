# maskable.py — generator for icons/icon-512-maskable.png (PWA maskable icon).
#
# Maskable icons are shown inside a shape (circle/squircle) chosen by the OS,
# so nothing important may sit in the outer ~20% ring. This script draws a
# FRESH 512x512 PNG: full-bleed square background #0b0e22 with the same neon
# arrow-tower chevron glyph as tools/icon-gen.py, centered and scaled to fit
# the middle 80% safe zone.
#
# Run: python3 tools/maskable.py   (writes ../icons/icon-512-maskable.png)
import math
import os
import struct
import zlib

BG = (11, 14, 34)        # #0b0e22
ACCENT = (77, 255, 156)  # #4dff9c (arrow neon)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    c1 = clamp(vx * wx + vy * wy, 0, vx * vx + vy * vy)
    qx, qy = ax + c1 / (vx * vx + vy * vy) * vx, ay + c1 / (vx * vx + vy * vy) * vy
    return math.hypot(px - qx, py - qy)


def chevron_dist(px, py, cx, cy, s):
    # Downward chevron: two strokes meeting at the bottom point.
    d1 = seg_dist(px - cx, py - cy, -s, -0.6 * s, 0, 0.6 * s)
    d2 = seg_dist(px - cx, py - cy, s, -0.6 * s, 0, 0.6 * s)
    return min(d1, d2)


def render(size):
    half = size / 2
    # Safe zone: glyph lives in the middle 80% -> scale factor 0.8 of the
    # non-maskable layout (which used s = size*0.28, stroke = size*0.075).
    s = size * 0.28 * 0.8
    stroke = size * 0.075 * 0.8
    glow_r = size * 0.05 * 0.8
    buf = bytearray()
    for y in range(size):
        row = bytearray()
        for x in range(size):
            col = BG  # full-bleed background, every pixel opaque
            d = chevron_dist(x, y, half, half, s)
            if d < stroke + glow_r:
                f = clamp(1 - (d - stroke) / glow_r, 0, 1)
                if f > 0:
                    col = tuple(int(col[i] + (ACCENT[i] - col[i]) * f * 0.55) for i in range(3))
            if d < stroke:
                f = d / stroke
                core = (235, 255, 245)
                col = tuple(int(core[i] + (ACCENT[i] - core[i]) * f) for i in range(3))
            row += bytes((col[0], col[1], col[2], 255))
        buf += b'\x00' + bytes(row)  # PNG filter 0 per scanline
    return bytes(buf)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        c += struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print(f'wrote {path} ({size}x{size})')


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write_png(os.path.join(root, 'icons', 'icon-512-maskable.png'), 512, render(512))
