/**
 * Shared helpers for the Flash @ Brigade Edge functions. Files prefixed
 * with an underscore are not exposed as routes by Vercel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Send a JSON response on the classic Vercel Node.js (req, res) signature. */
export function send(
  res: VercelResponse,
  status: number,
  body: Record<string, unknown>
): void {
  res.status(status).json(body);
}

/** The parsed JSON body, or null when absent/malformed/not an object. */
export function jsonBody(req: VercelRequest): Record<string, unknown> | null {
  const body = req.body as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return null;
}

/** Trim, collapse whitespace, strip control characters, cap length. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

export function supabaseEnv(
  scope = 'api'
): { url: string; headers: Record<string, string> } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    // Names only, never values: these lines exist to make Vercel Logs
    // reveal the exact missing configuration.
    if (!url) {
      console.error(
        `[${scope}] Missing required environment variable: SUPABASE_URL`
      );
    }
    if (!key) {
      console.error(
        `[${scope}] Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY`
      );
    }
    return null;
  }
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  };
}

/** URL-safe random token (default 24 bytes ≈ 192 bits of entropy). */
export function randomToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let base64 = '';
  raw.forEach((b) => {
    base64 += String.fromCharCode(b);
  });
  return btoa(base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Maximum passes per registration — one ceiling for every visitor type.
 * Mirrored in the Get Passes UI (src/festival/getpasses/GetPassesPage.tsx);
 * keep in sync. The `registrations.number_of_passes` check constraint in
 * supabase/schema.sql already permits 1..10, so this needs no migration.
 */
export const MAX_PASSES = 10;

/** Human-friendly pass reference, e.g. FB26-K7M3Q (no confusable glyphs). */
export function passReference(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const raw = crypto.getRandomValues(new Uint8Array(5));
  let out = '';
  raw.forEach((b) => {
    out += alphabet[b % alphabet.length];
  });
  return `FB26-${out}`;
}

export type PassRow = {
  id: string;
  registration_id: string;
  pass_reference: string;
  status: 'valid' | 'checked_in' | 'cancelled';
  issued_at: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  registrations?: {
    full_name: string;
    visitor_type: string;
    number_of_passes: number;
  };
};

/** Fetch a pass (joined with its registration) by hashed token. */
export async function findPassByToken(
  env: { url: string; headers: Record<string, string> },
  token: string
): Promise<PassRow | null> {
  const hash = await sha256Hex(token);
  const url =
    `${env.url}/rest/v1/passes` +
    `?select=id,registration_id,pass_reference,status,issued_at,checked_in_at,checked_in_by,` +
    `registrations(full_name,visitor_type,number_of_passes)` +
    `&verification_token_hash=eq.${hash}&limit=1`;
  const response = await fetch(url, { headers: env.headers });
  if (!response.ok) throw new Error('pass lookup failed');
  const rows = (await response.json()) as PassRow[];
  return rows[0] ?? null;
}
