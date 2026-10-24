'use strict';

/* Venice Projects — private archive gate.
 * A Venice API key is checked live against api.venice.ai; the browser gets a
 * signed, HttpOnly session cookie. The key itself is never stored or logged.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL = 12 * 60 * 60 * 1000;
const COOKIE = 'vp_session';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const attempts = new Map();

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function issueSession() {
  const exp = String(Date.now() + SESSION_TTL);
  return `${exp}.${sign(exp)}`;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

function hasSession(req) {
  const token = readCookie(req, COOKIE);
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cookieHeader(req, value, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    ...headers
  });
  res.end(body);
}

function redirect(res, location, headers = {}) {
  send(res, 302, '', { Location: location, ...headers });
}

function json(res, status, payload, headers = {}) {
  send(res, status, JSON.stringify(payload), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, reset: now + 10 * 60 * 1000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 10 * 60 * 1000;
  }
  entry.count += 1;
  attempts.set(ip, entry);
  return entry.count > 10;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error('too_large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function verifyVeniceKey(apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // /models is public, so it cannot prove a key. A one-token chat call is the
    // cheapest endpoint that actually authenticates the key.
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-v4-1-flash-1017',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      }),
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function loginPage() {
  return fs.readFileSync(path.join(ROOT, 'login.html'));
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return send(res, 400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/health') return json(res, 200, { status: 'ok' });

  if (pathname === '/login' || pathname === '/login.html') {
    if (hasSession(req)) return redirect(res, '/');
    return send(res, 200, loginPage(), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (rateLimited(ip)) return json(res, 429, { error: 'Too many attempts. Wait ten minutes and try again.' });

    let apiKey = '';
    try {
      const body = await readBody(req);
      apiKey = String((JSON.parse(body || '{}').apiKey) || '').trim();
    } catch {
      return json(res, 400, { error: 'Could not read that request.' });
    }

    if (apiKey.length < 10 || apiKey.length > 512) {
      return json(res, 400, { error: 'That does not look like a Venice API key.' });
    }

    const valid = await verifyVeniceKey(apiKey);
    if (!valid) return json(res, 401, { error: 'Venice rejected that key. Check it and try again.' });

    return json(res, 200, { ok: true, next: safeNext(url.searchParams.get('next')) }, {
      'Set-Cookie': cookieHeader(req, issueSession(), Math.floor(SESSION_TTL / 1000))
    });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    return redirect(res, '/login', { 'Set-Cookie': cookieHeader(req, '', 0) });
  }

  if (!hasSession(req)) {
    const next = encodeURIComponent(pathname + url.search);
    return redirect(res, `/login?next=${next}`);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  return serveStatic(req, res, pathname);
});

function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

server.listen(PORT, () => {
  console.log(`Venice Projects gate listening on ${PORT}`);
});
