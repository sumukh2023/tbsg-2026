/**
 * Minimal in-memory stand-in for the PostgREST subset the API uses, so the
 * REAL handlers can be exercised end to end without a Supabase project.
 * Supports the operators these routes actually send: eq, gte, is, limit,
 * order, select with one level of embedding, and Prefer: return=representation.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export const db = {
  volunteers: [],
  volunteer_sessions: [],
  volunteer_login_attempts: [],
  verification_events: [],
  passes: [],
  registrations: [],
  contact_enquiries: [],
  donations: [],
};

export const stats = { queries: [] };

const parseValue = (raw) => {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return decodeURIComponent(raw);
};

/** One `column.op.value` condition. Shared by plain filters and `or=(…)`. */
function condition(row, key, raw) {
  const [op, ...rest] = raw.split('.');
  const value = parseValue(rest.join('.'));
  const actual = row[key];
  if (op === 'eq') return String(actual) === String(value);
  if (op === 'is') {
    return value === null
      ? actual === null || actual === undefined
      : actual === value;
  }
  if (op === 'gte') return new Date(actual) >= new Date(value);
  if (op === 'ilike') {
    // PostgREST spells the wildcard `*`; Postgres uses `%`. Either arrives.
    if (actual === null || actual === undefined) return false;
    const pattern = String(value)
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/[*%]/g, '.*');
    return new RegExp(`^${pattern}$`, 'i').test(String(actual));
  }
  throw new Error(`stub does not implement operator ${op}`);
}

/**
 * `or=(a.ilike.*x*,b.eq.y)` — a flat OR group, which is all the API sends.
 * Splitting on commas is safe here for the same reason the API has to strip
 * commas out of a search term before building one: a comma IS the separator.
 */
function orGroup(row, raw) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  return inner
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .some((c) => {
      const at = c.indexOf('.');
      return condition(row, c.slice(0, at), c.slice(at + 1));
    });
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (['select', 'limit', 'order', 'offset'].includes(key)) continue;
    if (key === 'or') {
      if (!orGroup(row, raw)) return false;
      continue;
    }
    if (!condition(row, key, raw)) return false;
  }
  return true;
}

/**
 * The reporting VIEWS, resolved from the fixture tables the same way the SQL
 * resolves them. Without this a test of the activity log would be reading an
 * empty table called `verification_activity` and passing for the wrong
 * reason — the joins are most of what the view is.
 */
const VIEWS = {
  verification_activity() {
    return db.verification_events.map((e) => {
      const v = db.volunteers.find((x) => x.id === e.volunteer_id) ?? null;
      // LEFT joins: an unknown-code scan has no pass and no registration.
      const p = db.passes.find((x) => x.id === e.pass_id) ?? null;
      const r = p
        ? (db.registrations.find((x) => x.id === p.registration_id) ?? null)
        : null;
      return {
        id: e.id,
        created_at: e.created_at,
        action: e.action,
        result: e.result ?? null,
        pass_reference: e.pass_reference ?? null,
        volunteer_id: e.volunteer_id,
        volunteer_name: v?.full_name ?? null,
        volunteer_role: e.volunteer_role ?? null,
        pass_id: e.pass_id ?? null,
        attendee_name: r?.full_name ?? null,
        attendee_email: r?.email ?? null,
        attendee_phone: r?.phone ?? null,
      };
    });
  },
};

/** Resolve `alias:table!fk(cols)` and `table(cols)` embeds against fixtures. */
function embed(row, table, select) {
  if (!select) return { ...row };
  const out = { ...row };
  const embedKeys = new Set();
  for (const [, alias, target, hint, cols] of select.matchAll(
    /(?:(\w+):)?(\w+)(?:!(\w+))?\(([^)]*)\)/g
  )) {
    const key = alias ?? target;
    embedKeys.add(key);
    let joined = null;
    if (target === 'registrations') {
      joined = db.registrations.find((r) => r.id === row.registration_id) ?? null;
    } else if (target === 'volunteers') {
      const fk = hint === 'passes_checked_in_by_fkey' ? 'checked_in_by' : 'volunteer_id';
      joined = db.volunteers.find((v) => v.id === row[fk]) ?? null;
    }
    out[key] = joined
      ? Object.fromEntries(cols.split(',').map((c) => [c.trim(), joined[c.trim()]]))
      : null;
  }
  const plain = select
    .replace(/(?:(\w+):)?(\w+)(?:!(\w+))?\([^)]*\)/g, '')
    .split(',').map((c) => c.trim()).filter(Boolean);
  if (plain.length && plain[0] !== '*') {
    for (const key of Object.keys(out)) {
      if (!plain.includes(key) && !embedKeys.has(key)) delete out[key];
    }
  }
  return out;
}

export function start(port = 5599) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const table = url.pathname.replace('/rest/v1/', '');
    const params = [...url.searchParams.entries()];
    const select = url.searchParams.get('select');
    stats.queries.push(`${req.method} ${table}`);

    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = body ? JSON.parse(body) : null;

    const rows = VIEWS[table] ? VIEWS[table]() : (db[table] ?? []);
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      if (req.method === 'GET') {
        let found = rows.filter((r) => matches(r, params));
        const order = url.searchParams.get('order');
        if (order) {
          const [col, dir] = order.split('.');
          found = [...found].sort((a, b) =>
            dir === 'desc'
              ? String(b[col]).localeCompare(String(a[col]))
              : String(a[col]).localeCompare(String(b[col]))
          );
        }
        // `searchParams.get` returns null when the param is absent, and
        // `Number(null)` is 0, which `Number.isInteger` happily accepts — so
        // the previous version sliced EVERY unlimited GET down to nothing and
        // answered `[]` however many rows matched. Any test whose subject
        // counts rows was silently measuring that instead of its own code.
        // Offset before limit, as PostgREST applies them.
        const rawOffset = url.searchParams.get('offset');
        if (rawOffset !== null) {
          const offset = Number(rawOffset);
          if (Number.isInteger(offset) && offset > 0) found = found.slice(offset);
        }
        const rawLimit = url.searchParams.get('limit');
        if (rawLimit !== null) {
          const limit = Number(rawLimit);
          if (Number.isInteger(limit) && limit >= 0) {
            found = found.slice(0, limit);
          }
        }
        return send(200, found.map((r) => embed(r, table, select)));
      }

      if (req.method === 'POST') {
        // Unique email, as the real unique index on lower(email) enforces.
        if (table === 'volunteers') {
          const clash = db.volunteers.some(
            (v) => v.email.toLowerCase() === String(payload.email).toLowerCase()
          );
          if (clash) return send(409, { message: 'duplicate key' });
        }
        const row = {
          id: randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload,
        };
        if (table === 'volunteers') {
          row.role ??= 'volunteer';
          row.active ??= true;
          row.failed_attempts ??= 0;
          row.locked_until ??= null;
          row.must_change_password ??= false;
          row.last_login ??= null;
        }
        if (table === 'volunteer_sessions') row.revoked_at ??= null;
        rows.push(row);
        const wantsBack = (req.headers.prefer ?? '').includes('representation');
        // REAL PostgREST returns 201 with a genuinely EMPTY body when
        // `Prefer: return=representation` is absent — not `[]`. Sending `[]`
        // here is what hid a production 500 for days.
        if (!wantsBack) {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end('');
        }
        return send(201, [embed(row, table, select)]);
      }

      if (req.method === 'PATCH') {
        const hit = rows.filter((r) => matches(r, params));
        hit.forEach((r) => Object.assign(r, payload));
        const wantsBack = (req.headers.prefer ?? '').includes('representation');
        // Likewise: a PATCH without representation is 204 No Content.
        if (!wantsBack) {
          res.writeHead(204);
          return res.end();
        }
        return send(200, hit.map((r) => embed(r, table, select)));
      }

      if (req.method === 'DELETE') {
        db[table] = rows.filter((r) => !matches(r, params));
        return send(204, []);
      }
      return send(405, { message: 'not implemented' });
    } catch (error) {
      return send(500, { message: String(error) });
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
