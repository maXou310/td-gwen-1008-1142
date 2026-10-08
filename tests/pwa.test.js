// pwa.test.js — static PWA checks (manifest, service worker, registration).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

test('manifest.json is valid JSON with all required fields', () => {
  const m = JSON.parse(read('manifest.json'));
  for (const f of ['name', 'short_name', 'start_url', 'scope', 'display',
    'theme_color', 'background_color', 'orientation', 'id', 'description', 'lang']) {
    assert.ok(f in m, `manifest missing field: ${f}`);
  }
  assert.equal(m.display, 'standalone');
  assert.equal(m.orientation, 'any');
  assert.equal(m.lang, 'en');
  assert.deepEqual(m.display_override, ['standalone', 'minimal-ui']);
});

test('manifest icons include both "any" and "maskable" purposes', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, 'icons array too small');
  const anyIcons = m.icons.filter((i) => i.purpose === 'any');
  const maskable = m.icons.filter((i) => i.purpose === 'maskable');
  assert.ok(anyIcons.some((i) => i.sizes === '192x192'), 'missing 192 any icon');
  assert.ok(anyIcons.some((i) => i.sizes === '512x512'), 'missing 512 any icon');
  assert.ok(maskable.length >= 1, 'missing maskable icon');
  const mk = maskable[0];
  assert.equal(mk.sizes, '512x512');
  assert.equal(mk.type, 'image/png');
  assert.ok(mk.src.endsWith('.png'), 'maskable icon should be a png');
});

test('sw.js has SW_VERSION and pre-caches the app shell', () => {
  const sw = read('sw.js');
  assert.match(sw, /SW_VERSION\s*=\s*'v1-pwa'/, 'SW_VERSION must be v1-pwa');
  for (const asset of ['./index.html', './manifest.json', './sw.js',
    './css/style.css', './src/main.js', './icons/icon-192.png',
    './icons/icon-512.png', './icons/icon-512-maskable.png']) {
    assert.ok(sw.includes(`'${asset}'`), `cache list missing ${asset}`);
  }
  assert.ok(!sw.includes('./tools/'), 'tools/ dir must not be cached');
  assert.ok(sw.includes("req.mode === 'navigate'"), 'app-shell navigate handling missing');
  assert.ok(sw.includes('skipWaiting'), 'install should skipWaiting');
  assert.ok(sw.includes('clients.claim()'), 'activate should clientsClaim');
});

test('register.js guards with try/catch and skips file://', () => {
  const reg = read('src/pwa/register.js');
  assert.match(reg, /try\s*\{/, 'register.js must use try/catch');
  assert.match(reg, /catch/, 'register.js must have a catch clause');
  assert.ok(reg.includes("location.protocol === 'file:'"), 'must skip on file: protocol');
  assert.ok(reg.includes("'./sw.js'"), 'must register ./sw.js');
});
