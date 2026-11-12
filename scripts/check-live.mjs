#!/usr/bin/env node
/**
 * check-live.mjs — prove a film is really on the archive.
 *
 *   node scripts/check-live.mjs <slug>
 *
 * Logs in with the fleet's Venice key (read from disk, never printed), then
 * checks the films page, the catalogue entry, and a ranged video request.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.ARCHIVE_URL || 'https://venice.up.railway.app';
const slug = process.argv[2];
if (!slug) {
  console.error('usage: node scripts/check-live.mjs <slug>');
  process.exit(2);
}

const KEY_FILES = [
  path.join(os.homedir(), '.hermes/secrets/venice_inference_key_katha'),
  path.join(os.homedir(), '.hermes/secrets/venice_api_key'),
];
const keyFile = KEY_FILES.find((p) => fs.existsSync(p));
if (!keyFile) {
  console.error('✗ no Venice key on disk');
  process.exit(2);
}
const apiKey = fs.readFileSync(keyFile, 'utf8').trim();

const login = await fetch(`${BASE}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey }),
});
if (!login.ok) {
  console.error(`✗ login ${login.status} — the key was rejected`);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() || [])
  .map((c) => c.split(';')[0])
  .join('; ');

const get = (pathname, headers = {}) =>
  fetch(`${BASE}${pathname}`, { headers: { cookie, ...headers } });

const results = [];

const page = await get('/films');
const pageBody = page.status === 200 ? await page.text() : '';
results.push(['films page', page.status === 200 && pageBody.includes('Films'), `HTTP ${page.status}`]);

const catalogue = await get('/films.json');
const data = catalogue.ok ? await catalogue.json() : { films: [] };
const entry = (data.films || []).find((f) => f.slug === slug);
results.push(['catalogue entry', Boolean(entry), entry ? `#${(data.films || []).length} of ${data.total}` : 'missing']);

const video = await get(`/films/${slug}.mp4`, { Range: 'bytes=0-1023' });
results.push(['video stream', video.status === 206, `HTTP ${video.status} ${video.headers.get('content-type') || ''}`]);

const poster = await get(`/films/${slug}.jpg`);
results.push(['poster', poster.status === 200, `HTTP ${poster.status}`]);

let ok = true;
for (const [name, pass, detail] of results) {
  if (!pass) ok = false;
  console.log(`${pass ? '✓' : '✗'} ${name.padEnd(16)} ${detail}`);
}
if (entry) console.log(`  ${entry.name} — made ${entry.made} — ${BASE}/films`);

process.exit(ok ? 0 : 1);
