#!/usr/bin/env python3
"""Browser UI test for td-gwen (python playwright, system install).

Loads the page at 390x844 portrait and asserts:
  - dock has 5 buttons
  - clicking a dock button adds .selected
  - buying via __game works and gold updates
  - selectAt shows the panel
  - after a wave starts, gold text updates
Exit 0 on success, 1 on failure.
"""
import sys, os, http.server, socketserver, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def serve(root):
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=root, **k)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port

def main():
    httpd, port = serve(ROOT)
    url = f"http://127.0.0.1:{port}/"
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(300)

        # dismiss the start overlay (menu screen) so the dock is clickable
        assert page.evaluate("document.getElementById('overlay').classList.contains('visible')"), "start menu not shown"
        page.click("#btn-start")
        page.wait_for_timeout(200)
        assert not page.evaluate("document.getElementById('overlay').classList.contains('visible')"), "overlay still visible after START"

        # 1. dock has 5 buttons
        btns = page.locator("#dock .dock-btn")
        assert btns.count() == 5, f"dock has {btns.count()} buttons, want 5"

        # 2. click cannon dock button -> selected class
        page.click("#dock .dock-btn[data-type='cannon']")
        page.wait_for_timeout(100)
        sel = page.evaluate("document.querySelector('#dock .dock-btn.selected').dataset.type")
        assert sel == "cannon", f"selected dock type is {sel}, want cannon"

        # 3. buy via __game, gold updates
        gold0 = page.evaluate("__game.getHud().gold")
        res = page.evaluate("__game.buyAt('arrow', 1, 2)")
        assert res["ok"], f"buyAt failed: {res}"
        gold1 = page.evaluate("__game.getHud().gold")
        assert gold1 == gold0 - 70, f"gold {gold0} -> {gold1}, want -70"
        page.wait_for_timeout(300)  # let hud sync (throttled 200ms)
        txt = page.text_content("#hud-gold")
        assert txt.strip() == str(gold1), f"#hud-gold shows {txt!r}, want {gold1}"

        # 4. selectAt -> panel appears
        page.evaluate("__game.selectAt(1, 2)")
        page.wait_for_timeout(200)
        visible = page.evaluate("document.getElementById('panel').classList.contains('visible')")
        assert visible, "panel not visible after selectAt"
        title = page.text_content("#panel-title")
        assert "ARROW" in title.upper(), f"panel title {title!r}"

        # 5. start wave: hud reflects combat phase and (eventually) gold changes
        page.evaluate("__game.startWaveNow()")
        phase = page.evaluate("__game.getHud().phase")
        assert phase == "combat", f"phase after startWaveNow is {phase}"
        deadline = time.time() + 30
        txt2 = None
        while time.time() < deadline:
            page.wait_for_timeout(1000)
            txt2 = page.text_content("#hud-gold")
            if txt2.strip() != str(gold1):
                break
        assert txt2.strip() != str(gold1), f"gold text did not update during wave ({txt2!r})"

        # no console errors
        real_errors = [e for e in errors if "favicon" not in e.lower()]
        assert not real_errors, f"console errors: {real_errors}"

        print("ui-browser-test: OK (5 dock btns, select, buy, panel, gold update, no console errors)")
        browser.close()
    httpd.shutdown()
    return 0

if __name__ == "__main__":
    sys.exit(main())
