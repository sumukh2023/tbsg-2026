/**
 * Full-stack sign-in test: the REAL API handlers, the REAL built frontend, a
 * REAL browser, and real cookies. Nothing is stubbed except the database.
 *
 * Every earlier test mocked `/api/auth/*` at the network layer, so the one
 * thing that actually broke in production — the browser accepting the
 * Set-Cookie header and sending it back — was never exercised.
 *
 *   node e2e-auth.mjs
 */
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
// Playwright is not a dependency of this project — it is whatever the
// environment provides. Resolve it leniently and skip rather than fail if it
// is absent, so `npm ci` on a clean machine is not held hostage to it.
let playwright;
for (const spec of [
  'playwright',
  '/opt/node22/lib/node_modules/playwright/index.js',
]) {
  try {
    const mod = await import(spec);
    playwright = mod.chromium ? mod : mod.default;
    if (playwright?.chromium) break;
  } catch {
    /* try the next */
  }
}
if (!playwright?.chromium) {
  console.log('Playwright not available here — skipping the browser pass.');
  process.exit(0);
}
const chromium = playwright.chromium;
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5601;
const APP_PORT = 4180;
process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';

await start(PG_PORT);

await build({
  entryPoints: ['api/auth.ts', 'api/verify.ts', 'api/admin.ts', 'api/_auth.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@node-rs/argon2', '@vercel/node'],
  logLevel: 'error',
});

const authFn = (await import(`${OUT}/auth.js`)).default;
const adminFn = (await import(`${OUT}/admin.js`)).default;
const verifyFn = (await import(`${OUT}/verify.js`)).default;
const { hashPassword } = await import(`${OUT}/_auth.js`);

// ---------------------------------------------------------------- fixtures
const adminId = randomUUID();
const volunteerId = randomUUID();
db.volunteers.push(
  { id: adminId, full_name: 'Sumukh Nayak', email: 'sumukh.nayak@outlook.com',
    password_hash: await hashPassword('correct-horse-battery'), role: 'admin',
    active: true, failed_attempts: 0, locked_until: null,
    must_change_password: false, last_login: null },
  { id: volunteerId, full_name: 'Ryan Saha', email: 'ryansahatbsg@gmail.com',
    password_hash: await hashPassword('correct-horse-battery'), role: 'volunteer',
    active: true, failed_attempts: 0, locked_until: null,
    must_change_password: false, last_login: null }
);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm' };

/** Reproduce the vercel.json rewrites, so routing is tested too. */
function rewrite(pathname) {
  let m = pathname.match(/^\/api\/auth\/([^/]+)$/);
  if (m) return { fn: authFn, query: { action: m[1] } };
  m = pathname.match(/^\/api\/admin\/([^/]+)$/);
  if (m) return { fn: adminFn, query: { resource: m[1] } };
  if (pathname === '/api/verify') return { fn: verifyFn, query: {} };
  return null;
}

// Flipped by the last test to model "the browser did not keep the cookie".
// Done at the server because Playwright's route.fetch() applies Set-Cookie to
// the context itself, so intercepting in the page cannot actually block it.
let blockCookies = false;

const app = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${APP_PORT}`);
  const route = rewrite(url.pathname);

  if (route) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const query = { ...route.query, ...Object.fromEntries(url.searchParams) };
    // The @vercel/node shim: req.body parsed, req.query populated, and a res
    // that supports status()/json()/setHeader() the way the handlers expect.
    const vreq = { method: req.method, headers: req.headers, body, query, url: req.url };
    const vres = {
      status(code) { res.statusCode = code; return this; },
      setHeader(k, v) {
        if (blockCookies && k.toLowerCase() === 'set-cookie') return this;
        res.setHeader(k, v);
        return this;
      },
      json(data) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return this; },
    };
    try {
      await route.fn(vreq, vres);
    } catch (error) {
      console.log(`  !! handler threw on ${url.pathname}: ${error?.message}`);
      if (!res.headersSent) { res.statusCode = 500; res.end('{}'); }
    }
    if (!res.writableEnded) res.end();
    return;
  }

  // Static dist/ with SPA fallback, as vercel.json's catch-all does.
  let file = join(new URL('../dist/', import.meta.url).pathname, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file) || url.pathname.endsWith('/')) file = 'dist/index.html';
  try {
    const data = readFileSync(file);
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise((r) => app.listen(APP_PORT, r));

// ---------------------------------------------------------------- the test
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label} ${detail}`); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH || existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }
    : {}
);

for (const [who, email, role, home] of [
  ['administrator', 'sumukh.nayak@outlook.com', 'admin', '/volunteer/admin'],
  ['volunteer', 'ryansahatbsg@gmail.com', 'volunteer', '/volunteer'],
]) {
  console.log(`\n${who} — real browser, real cookies`);
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();

  const responses = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/')) responses.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  await page.goto(`http://localhost:${APP_PORT}/volunteer`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  check('redirected to the login page',
    new URL(page.url()).pathname === '/volunteer/login', page.url());

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2500);

  const loginResponse = responses.find((r) => r.includes('/api/auth/login'));
  check('POST /api/auth/login returned 200', loginResponse === '200 /api/auth/login', String(loginResponse));

  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name.includes('fb_volunteer'));
  check('the browser ACCEPTED the session cookie', Boolean(session),
    `cookies seen: ${JSON.stringify(cookies.map((c) => c.name))}`);
  if (session) {
    check('  cookie is HttpOnly + Secure + Lax',
      session.httpOnly && session.secure && session.sameSite === 'Lax',
      JSON.stringify({ httpOnly: session.httpOnly, secure: session.secure, sameSite: session.sameSite }));
    check('  cookie carries no __Host- prefix (silently rejectable)',
      !session.name.startsWith('__Host-'), session.name);
  }

  const sessionCall = responses.filter((r) => r.includes('/api/auth/session')).pop();
  check('GET /api/auth/session answered 200', sessionCall === '200 /api/auth/session', String(sessionCall));

  const who2 = await page.evaluate(() =>
    fetch('/api/auth/session', { credentials: 'same-origin' }).then((r) => r.json()));
  check('the session resolves to the signed-in person',
    who2.volunteer?.role === role, JSON.stringify(who2));

  const landed = new URL(page.url()).pathname;
  check(`landed on ${home}`, landed === home, `got ${landed}`);
  check('no error message on screen',
    (await page.getByText('Invalid email or password.').count()) === 0);

  await page.close();
  await ctx.close();
}

// The production symptom, forced: the password is right and the browser
// refuses to store the cookie. The page must SAY that, not blame the password.
console.log('\ncookies blocked — the failure must be legible');
{
  blockCookies = true;
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${APP_PORT}/volunteer/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByLabel('Email').fill('sumukh.nayak@outlook.com');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2500);
  const message = await page.getByRole('alert').innerText().catch(() => '');
  const cookiesNow = await ctx.cookies();
  console.log(`    path=${new URL(page.url()).pathname} cookies=${JSON.stringify(cookiesNow.map((c) => c.name))}`);
  check('does NOT blame the password', !/invalid email or password/i.test(message), message);
  check('names the real cause (session cookie)', /session cookie/i.test(message), message);
  await ctx.close();
  blockCookies = false;
}

console.log(`\n${'='.repeat(58)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(58)}`);
await browser.close();
app.close();
process.exit(fail === 0 ? 0 : 1);
