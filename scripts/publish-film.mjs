#!/usr/bin/env node
/**
 * publish-film.mjs — put a brag video on the archive.
 *
 * Copies the film + poster into films/, records it in films.json, commits,
 * pushes and deploys the archive to Railway. Run from anywhere.
 *
 *   node scripts/publish-film.mjs \
 *     --slug mystery-menu --name "Mystery Menu" \
 *     --tagline "Two chefs draft five secret ingredients..." \
 *     --live https://mystery-menu-production.up.railway.app \
 *     --repo https://github.com/vivmuk/mystery-menu \
 *     --video ~/Projects/viv-brag/mystery-menu/brag-output/brag.mp4 \
 *     --poster ~/Projects/viv-brag/mystery-menu/brag-output/brag.jpg
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });

const slug = arg('slug');
const name = arg('name');
const tagline = arg('tagline');
const live = arg('live');
const repo = arg('repo');
const video = arg('video').replace(/^~/, os.homedir());
const poster = arg('poster').replace(/^~/, os.homedir());
const made = arg('date', new Date().toISOString().slice(0, 10));
const replace = flag('replace');

if (!slug || !name || !video) die('need at least --slug, --name and --video');
if (!/^[a-z0-9-]+$/.test(slug)) die('--slug must be lowercase letters, digits and dashes');
if (!fs.existsSync(video)) die(`no video at ${video}`);

const filmsDir = path.join(ROOT, 'films');
const dataPath = path.join(ROOT, 'films.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const existing = (data.films || []).findIndex((f) => f.slug === slug);
if (existing > -1 && !replace) die(`"${slug}" is already on the site — pass --replace to redo it`);

// poster: use a sibling brag.jpg when none is given
let posterPath = poster;
if (!posterPath || !fs.existsSync(posterPath)) {
  const guess = path.join(path.dirname(video), 'brag.jpg');
  if (fs.existsSync(guess)) posterPath = guess;
}
if (!posterPath) die('no poster found (expected a brag.jpg next to the video, or --poster)');

const mp4Name = `${slug}.mp4`;
const jpgName = `${slug}.jpg`;
fs.copyFileSync(video, path.join(filmsDir, mp4Name));
fs.copyFileSync(posterPath, path.join(filmsDir, jpgName));

const entry = {
  slug,
  name,
  made,
  video: `films/${mp4Name}`,
  poster: `films/${jpgName}`,
  ...(live ? { live } : {}),
  ...(repo ? { repo } : {}),
  ...(tagline ? { tagline } : {}),
};

if (existing > -1) data.films[existing] = entry;
else data.films.push(entry);
data.films.sort((a, b) => (a.made < b.made ? 1 : a.made > b.made ? -1 : 0));
data.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 1)}\n`);

const size = (fs.statSync(path.join(filmsDir, mp4Name)).size / 1048576).toFixed(1);
console.log(`✓ ${name} → films/${mp4Name} (${size} MB), ${data.films.length}/${data.total} films`);

if (flag('no-deploy')) {
  console.log('· skipped commit + deploy (--no-deploy)');
  process.exit(0);
}

try {
  run('git', ['add', `films/${mp4Name}`, `films/${jpgName}`, 'films.json']);
  run('git', ['-c', 'user.name=Vivek Muk', '-c', 'user.email=vivmuk@users.noreply.github.com', 'commit', '-m', `film: ${name}`]);
  run('git', ['push', 'origin', 'HEAD']);
  console.log('✓ pushed');
} catch (err) {
  console.warn('! git step failed — the files are written, fix and re-run with --replace');
  process.exitCode = 1;
}

try {
  run('railway', ['up', '--ci', '--service', 'web']);
  console.log('✓ deployed');
} catch (err) {
  console.error('✗ railway deploy failed — run `railway up --ci --service web` in the repo once the cause is fixed');
  process.exitCode = 1;
}
