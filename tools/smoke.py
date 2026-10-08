# Playwright smoke: load the PWA at 390x844, buy cannon+frost, start wave 1,
# wait 6s, check console errors, screenshot /tmp/towers.png.
import json
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto("http://localhost:8093/", wait_until="load")
    page.wait_for_timeout(500)

    info = page.evaluate("""() => ({
        hasGame: !!window.__game,
        state: window.__game ? window.__game.getState() : null
    })""")
    print("initial:", json.dumps(info))

    bought = page.evaluate("""() => {
        const out = [];
        outer: for (let row = 0; row < 9; row++) for (let col = 0; col < 13; col++) {
            const r = window.__game.buyAt('cannon', col, row);
            if (r && r.ok) { out.push(['cannon', col, row]); break outer; }
        }
        return out;
    }""")
    print("bought cannon:", json.dumps(bought))
    bought2 = page.evaluate("""() => {
        for (let row = 0; row < 9; row++) for (let col = 0; col < 13; col++) {
            const r = window.__game.buyAt('frost', col, row);
            if (r && r.ok) return ['frost', col, row];
        }
        return null;
    }""")
    print("bought frost:", json.dumps(bought2))

    page.evaluate("() => window.__game.startWaveNow()")
    page.wait_for_timeout(6000)
    after = page.evaluate("""() => ({ state: window.__game.getState(), perf: window.__perf })""")
    print("after 6s:", json.dumps(after))
    page.screenshot(path="/tmp/towers.png")
    print("console errors:", json.dumps(errors))
    browser.close()

raise SystemExit(1 if errors else 0)
