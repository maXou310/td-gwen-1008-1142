// icon-gen.py — one-off generator for icons/icon-192.png and icons/icon-512.png.
// Draws the app icon per STYLE.md: neon arrow-tower chevron on #0b0e22,
// rounded-square mask. Run: python3 tools/icon-gen.py
import math
import struct
import zlib

BG = (11, 14, 34)        # #0b0e22
ACCENT = (77, 255, 156)  # #4dff9c (arrow neon)
GLOW = (55, 230, 255)    # #37e6ff edge


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def in_rounded_square(x, y, size, r):
    if x < 0 or y < 0 or x >= size or y >= size:
        return False
    cx = clamp(x, r, size - r)
    cy = clamp(y, r, size - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def chevron_dist(px, py, cx, cy, s):
    # Distance to a downward chevron (two strokes meeting at bottom point).
    # Top-left arm: from (-s, -0.6s) to (0, 0.6s); top-right mirrored.
    def seg_dist(px, py, ax, ay, bx, by):
        vx, vy = bx - ax, by - ay
        wx, wy = px - ax, py - ay
        c1 = vx * wx + vy * wy
        c1 = clamp(c1, 0, vx * vx + vy * vy)
        qx, qy = ax + c1 / (vx * vx + vy * vy) * vx, ay + c1 / (vx * vx + vy * vy) * vy
        return math.hypot(px - qx, py - qy)

    d1 = seg_dist(px - cx, py - cy, -s, -0.6 * s, 0, 0.6 * s)
    d2 = seg_dist(px - cx, py - cy, s, -0.6 * s, 0, 0.6 * s)
    return min(d1, d2)


def render(size):
    r = size * 0.18  # corner radius
    half = size / 2
    stroke = size * 0.075
    glow_r = size * 0.05
    buf = bytearray()
    for y in range(size):
        row = bytearray()
        for x in range(size):
            if not in_rounded_square(x, y, size, r):
                row += bytes((0, 0, 0, 0))
                continue
            # Background with subtle vertical gradient.
            g = y / size
            bg = (
                int(BG[0] + (16 - BG[0]) * g),
                int(BG[1] + (20 - BG[1]) * g),
                int(BG[2] + (48 - BG[2]) * g),
            )
            col = bg
            # Glow ring around the rounded square edge (inner 2px-ish).
            border_d = min(x, y, size - 1 - x, size - 1 - y)
            if border_d < 3:
                f = 1 - border_d / 3
                col = tuple(int(bg[i] + (GLOW[i] - bg[i]) * f * 0.5) for i in range(3))
            # Chevron glyph.
            d = chevron_dist(x, y, half, half, size * 0.28)
            if d < stroke + glow_r:
                # Soft outer glow falloff.
                f = clamp(1 - (d - stroke) / glow_r, 0, 1)
                if f > 0:
                    col = tuple(int(col[i] + (ACCENT[i] - col[i]) * f * 0.55) for i in range(3))
            if d < stroke:
                # Core: bright center -> accent edges.
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
    import os
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write_png(os.path.join(root, 'icons', 'icon-192.png'), 192, render(192))
    write_png(os.path.join(root, 'icons', 'icon-512.png'), 512, render(512))
