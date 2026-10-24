# Venice Projects

A living archive of every project built on the [Venice API](https://venice.ai) over 18 months — from the original 70s birthday-card generator to **KinderQuill** (the Venice-funded flagship) and a fleet of 50+ live deployments.

## Live site
https://web-production-de114.up.railway.app

## What's inside
- `server.js` — private gate: verifies a Venice API key live, then issues a signed 12-hour HttpOnly session cookie
- `login.html` — light, single-purpose key entry screen
- `index.html` + `app.js` — Three.js particle cosmos, scroll-driven reveals, animated counters, scramble-text hero
- `projects.json` — the catalog: 48 live Railway deployments, each with a real screenshot
- `screenshots/` — live captures of every running app

## Access
The archive is private. Open the site, paste a Venice API key, and it is checked with a one-token call to `api.venice.ai/api/v1/chat/completions`. The key is never stored or logged; the browser only gets a signed session cookie for 12 hours. `projects.json`, `app.js` and every screenshot are served only behind that cookie.

Run locally: `PORT=8080 node server.js`.

## Highlights
- **KinderQuill** — AI children's storybooks (Venice-funded flagship): https://kinderquill.up.railway.app
- **Venice Video** — model-aware video generation UI: https://venicevideo.up.railway.app
- **Designviv** — 100 design styles + 226 technique compendium: https://designviv.up.railway.app
- **ViviIndex Benchmark** — real-API model benchmarking: https://benchmarkviv.up.railway.app
