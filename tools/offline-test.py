#!/usr/bin/env python3
# offline-test.py — PWA offline browser test (Playwright, headless Chromium).
#
# Serves the repo root over http, loads the app, waits for the service worker
# to be ready, then goes OFFLINE and reloads. Asserts a fully clean offline
# session: no >=400 responses, no console errors, no pageerrors, no
# requestfailed events, HUD visible. Then starts a wave offline and checks
# hud-wave > 0, screenshots /tmp/pwa-offline.png, comes back online and
# reloads again (still clean). Prints RESULT: PASS/FAIL with the lists.
#
# Run: python3 tools/offline-test.py   (exit 0 = PASS)

import http.server
import socketserver
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8791
BASE = f'http://127.0.0.1:{PORT}'


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def start_server():
    handler = lambda *a, **kw: QuietHandler(*a, directory=str(ROOT), **kw)
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def collect(page, rec):
    """Wire up response/console/pageerror/requestfailed listeners."""
    def on_response(resp):
        if resp.status >= 400:
            rec['bad_responses'].append(f'{resp.status} {resp.url}')
    def on_console(msg):
        if msg.type == 'error':
            rec['console_errors'].append(msg.text)
    def on_pageerror(err):
        rec['pageerrors'].append(str(err))
    def on_req_failed(req):
        rec['requestfailed'].append(f'{req.method} {req.url} ({req.failure})')
    page.on('response', on_response)
    page.on('console', on_console)
    page.on('pageerror', on_pageerror)
    page.on('requestfailed', on_req_failed)


def fresh_rec():
    return {'bad_responses': [], 'console_errors': [], 'pageerrors': [], 'requestfailed': []}


def main():
    httpd = start_server()
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(offline=False)
        page = ctx.new_page()

        # --- Online first load: install + activate the SW -------------------
        rec = fresh_rec()
        collect(page, rec)
        page.goto(BASE + '/', wait_until='load', timeout=30000)
        try:
            page.wait_for_function(
                "navigator.serviceWorker.getRegistration().then(r => !!r)",
                timeout=20000)
            page.wait_for_function(
                "() => navigator.serviceWorker.ready.then(() => true)",
                timeout=20000)
        except Exception as e:
            failures.append(f'SW not ready within 20s: {e}')
        page.reload(wait_until='load')
        page.wait_for_timeout(500)
        if rec['bad_responses']:
            failures.append(f'online load had >=400 responses: {rec["bad_responses"]}')

        # --- Offline reload --------------------------------------------------
        rec = fresh_rec()
        collect(page, rec)
        ctx.set_offline(True)
        page.reload(wait_until='load')
        page.wait_for_timeout(1000)
        hud_visible = page.locator('#hud').is_visible()
        if not hud_visible:
            failures.append('HUD (#hud) not visible after offline reload')
        if rec['bad_responses']:
            failures.append(f'offline reload >=400 responses: {rec["bad_responses"]}')
        if rec['console_errors']:
            failures.append(f'offline console errors: {rec["console_errors"]}')
        if rec['pageerrors']:
            failures.append(f'offline pageerrors: {rec["pageerrors"]}')
        if rec['requestfailed']:
            failures.append(f'offline requestfailed: {rec["requestfailed"]}')

        # --- Start a wave while offline --------------------------------------
        # Clicking #btn-start dismisses the menu overlay (newGame -> phase stays
        # 'build'); the engine's initial build phase waits for the player, so we
        # also call __game.startWaveNow() to actually start wave 1.
        try:
            page.click('#btn-start', timeout=5000)
        except Exception as e:
            failures.append(f'could not click #btn-start: {e}')
        page.wait_for_timeout(300)
        try:
            page.evaluate('window.__game.startWaveNow()')
        except Exception as e:
            failures.append(f'could not call __game.startWaveNow(): {e}')
        page.wait_for_timeout(2000)
        try:
            wave_txt = page.text_content('#hud-wave') or ''
            wave_val = int(wave_txt.strip())
        except ValueError:
            wave_val = -1
        if wave_val <= 0:
            failures.append(f'hud-wave not > 0 after starting offline (got {wave_val!r})')

        page.screenshot(path='/tmp/pwa-offline.png')

        # --- Back online: still clean ----------------------------------------
        rec = fresh_rec()
        collect(page, rec)
        ctx.set_offline(False)
        page.reload(wait_until='load')
        page.wait_for_timeout(1000)
        if rec['bad_responses']:
            failures.append(f'back-online reload >=400 responses: {rec["bad_responses"]}')
        if rec['console_errors']:
            failures.append(f'back-online console errors: {rec["console_errors"]}')
        if rec['pageerrors']:
            failures.append(f'back-online pageerrors: {rec["pageerrors"]}')
        if rec['requestfailed']:
            failures.append(f'back-online requestfailed: {rec["requestfailed"]}')

        browser.close()
    httpd.shutdown()

    print('=== offline-test ===')
    print(f'HUD visible offline: {hud_visible}')
    print(f'hud-wave after start (offline): {wave_val}')
    print(f'screenshot: /tmp/pwa-offline.png')
    if failures:
        print('RESULT: FAIL')
        for f in failures:
            print(f'  - {f}')
        sys.exit(1)
    print('RESULT: PASS')
    sys.exit(0)


if __name__ == '__main__':
    main()
