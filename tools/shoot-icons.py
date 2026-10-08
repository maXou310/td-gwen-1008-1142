# shoot-icons.py — regenerate icons/icon-192.png + icon-512.png from
# tools/icon-canvas.html via python playwright (element screenshots).
# Run: python3 tools/shoot-icons.py  (needs a local server or file:// URL)
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///home/agent/work/td-gwen/tools/icon-canvas.html'
OUT = {
    '#icon-512': '/home/agent/work/td-gwen/icons/icon-512.png',
    '#icon-192': '/home/agent/work/td-gwen/icons/icon-192.png',
}

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 800, 'height': 1400}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until='networkidle')
    pg.wait_for_function('window.__iconsReady === true', timeout=10000)
    for sel, out in OUT.items():
        el = pg.query_selector(sel)
        box = el.bounding_box()
        n = 512 if '512' in sel else 192
        pg.screenshot(path=out, clip={'x': box['x'], 'y': box['y'], 'width': n, 'height': n})
        print('wrote', out)
    if errs:
        print('PAGE ERRORS:', errs); sys.exit(1)
    b.close()
print('icons ok')
