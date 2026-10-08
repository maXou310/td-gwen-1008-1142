# shoot-game.py — art verification screenshots (playwright).
# Phone 390x844: buy all 5 tower types, wave 1, /tmp/art-mid.png after 5s,
# /tmp/art-late.png ~35s later. Desktop 1400x900: start menu -> game,
# /tmp/art-desktop.png after 2s. Exits non-zero on page/console errors.
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'

def check_errors(pg, label):
    errs = pg._errs
    if errs:
        print(f'{label}: CONSOLE/PAGE ERRORS:')
        for e in errs: print(' -', e)
        return False
    print(f'{label}: no console/page errors')
    return True

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- phone ----
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    pg._errs = []
    pg.on('console', lambda m: m.type == 'error' and pg._errs.append('console: ' + m.text))
    pg.on('pageerror', lambda e: pg._errs.append('page: ' + str(e)))
    pg.goto(BASE + '/index.html', wait_until='networkidle')
    pg.wait_for_function('window.__game !== undefined', timeout=10000)
    # dismiss menu overlay
    pg.evaluate("""() => {
      const s = window.__test;
      s.fastForward(1, [
        {t:'arrow',   c:1, r:3},
        {t:'cannon',  c:3, r:3},
        {t:'frost',   c:5, r:1},
        {t:'support', c:6, r:7},
        {t:'sniper',  c:9, r:1},
      ]);
    }""")
    ok1 = check_errors(pg, 'phone')
    pg.wait_for_timeout(5000)
    pg.screenshot(path='/tmp/art-mid.png')
    hud_mid = pg.evaluate('window.__game.getHud()')
    n_en = pg.evaluate('typeof window.__game.getState().enemies')
    print('mid: hud=', hud_mid, 'enemies alive=', n_en)
    pg.wait_for_timeout(30000)
    pg.screenshot(path='/tmp/art-late.png')
    hud_late = pg.evaluate('window.__game.getHud()')
    print('late: hud=', hud_late)
    ok2 = check_errors(pg, 'phone-late')
    pg.close()

    # ---- desktop ----
    dg = b.new_page(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
    dg._errs = []
    dg.on('console', lambda m: m.type == 'error' and dg._errs.append('console: ' + m.text))
    dg.on('pageerror', lambda e: dg._errs.append('page: ' + str(e)))
    dg.goto(BASE + '/index.html', wait_until='networkidle')
    dg.wait_for_function('window.__game !== undefined', timeout=10000)
    title = dg.text_content('#overlay-title')
    print('desktop overlay title:', title)
    dg.click('#btn-start')
    dg.wait_for_timeout(2000)
    dg.screenshot(path='/tmp/art-desktop.png')
    ok3 = check_errors(dg, 'desktop')
    dg.close()

    b.close()
    sys.exit(0 if (ok1 and ok2 and ok3) else 1)
