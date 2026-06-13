#!/usr/bin/env python3
"""Generate Ground Control PWA icons (pure stdlib PNG encoder).

Draws a crosshair / target mark on a dark rounded surface. No external deps.
Produces standard and maskable icons at 192 and 512 px.
"""
import zlib, struct, math, os

BG      = (13, 17, 23)      # #0d1117
SURFACE = (22, 27, 34)      # #161b22
GREEN   = (63, 185, 80)     # #3fb950
TEXT    = (230, 237, 243)   # #e6edf3
MUTED   = (125, 133, 144)   # #7d8590


def write_png(path, width, height, pixels):
    """pixels: flat list of (r,g,b,a) tuples, len == width*height."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (none)
        row = pixels[y * width:(y + 1) * width]
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xffffffff
        return c + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


def blend(dst, src, a):
    """alpha blend src over dst, a in 0..1"""
    return tuple(int(round(dst[i] * (1 - a) + src[i] * a)) for i in range(3))


def rounded_rect_alpha(x, y, x0, y0, x1, y1, radius):
    """coverage 0..1 for rounded rect with simple anti-alias on corners."""
    # inside straight zones
    if x0 + radius <= x <= x1 - radius and y0 <= y <= y1:
        return 1.0
    if y0 + radius <= y <= y1 - radius and x0 <= x <= x1:
        return 1.0
    # corner centres
    corners = [
        (x0 + radius, y0 + radius), (x1 - radius, y0 + radius),
        (x0 + radius, y1 - radius), (x1 - radius, y1 - radius),
    ]
    # pick nearest applicable corner
    for (cx, cy) in corners:
        if ((x < x0 + radius and cx == x0 + radius) or (x > x1 - radius and cx == x1 - radius)) and \
           ((y < y0 + radius and cy == y0 + radius) or (y > y1 - radius and cy == y1 - radius)):
            d = math.hypot(x - cx, y - cy)
            return max(0.0, min(1.0, radius - d + 0.5))
    return 0.0


def make_icon(size, maskable=False):
    px = [(BG[0], BG[1], BG[2], 255)] * (size * size)

    cx = cy = size / 2.0
    # On maskable icons keep content inside the safe zone (~80%).
    scale = 0.78 if maskable else 0.92
    inset = (1 - scale) / 2.0 * size

    rx0, ry0 = inset, inset
    rx1, ry1 = size - inset, size - inset
    radius = size * 0.20

    ring_r = (rx1 - rx0) / 2.0 * 0.66
    ring_w = max(2.0, size * 0.045)
    cross_len = ring_r * 1.42
    cross_w = max(2.0, size * 0.035)
    dot_r = size * 0.045

    for y in range(size):
        for x in range(size):
            idx = y * size + x
            base = px[idx]
            cur = (base[0], base[1], base[2])

            # rounded surface panel
            cov = rounded_rect_alpha(x + 0.5, y + 0.5, rx0, ry0, rx1, ry1, radius)
            if cov > 0:
                cur = blend(cur, SURFACE, cov)

            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            dist = math.hypot(dx, dy)

            # crosshair arms (with small gap around the centre)
            gap = dot_r + size * 0.02
            on_arm = False
            if gap < abs(dx) <= cross_len and abs(dy) <= cross_w / 2:
                on_arm = True
            if gap < abs(dy) <= cross_len and abs(dx) <= cross_w / 2:
                on_arm = True
            if on_arm:
                cur = blend(cur, GREEN, 1.0)

            # target ring
            edge = abs(dist - ring_r)
            if edge <= ring_w / 2 + 0.5:
                a = max(0.0, min(1.0, ring_w / 2 + 0.5 - edge))
                cur = blend(cur, GREEN, a)

            # centre dot
            if dist <= dot_r + 0.5:
                a = max(0.0, min(1.0, dot_r + 0.5 - dist))
                cur = blend(cur, GREEN, a)

            px[idx] = (cur[0], cur[1], cur[2], 255)

    return px


def main():
    os.makedirs("icons", exist_ok=True)
    for size in (192, 512):
        write_png(f"icons/icon-{size}.png", size, size, make_icon(size, maskable=False))
        write_png(f"icons/icon-maskable-{size}.png", size, size, make_icon(size, maskable=True))
    # small apple-touch friendly
    write_png("icons/icon-180.png", 180, 180, make_icon(180, maskable=False))
    print("icons written")


if __name__ == "__main__":
    main()
