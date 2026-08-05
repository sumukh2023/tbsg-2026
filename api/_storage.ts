/**
 * Supporting documents for the sponsor Expression of Interest.
 *
 * Underscore-prefixed: Vercel does not expose it as a route, so it costs
 * nothing against the 12-function Hobby limit — which matters here, because
 * `api/` is AT that limit. There is no room for an upload route of its own,
 * and this is not a compromise: the upload belongs to the EOI and nothing
 * else will ever call it.
 *
 * WHY THE BYTES DO NOT GO THROUGH VERCEL. A serverless function on Vercel
 * accepts a 4.5 MB request body. The brief asks for 10 MB documents, and a
 * 10 MB file base64'd into JSON is 13.3 MB, so routing the file through the
 * function cannot work at the required size at all. Instead the function
 * issues a SIGNED UPLOAD URL and the browser PUTs the file straight to
 * Supabase Storage. Vercel never sees the bytes; the size limit that applies
 * is the bucket's.
 *
 * That makes the trust boundary the interesting part, so it is worth being
 * explicit about what is checked and where:
 *
 *   - The client never chooses the storage path. The server generates it.
 *   - The path comes back signed (HMAC over the server's own secret), so a
 *     client cannot submit a path the server did not issue for this form.
 *   - The content type is derived from the EXTENSION by the server, not read
 *     from what the browser claimed. Browsers report .doc and .ppt as
 *     application/octet-stream often enough that trusting the claim means
 *     either rejecting real documents or accepting anything.
 *   - The size and type recorded in the database are read back FROM STORAGE
 *     after the upload, never taken from the client. The declared size is
 *     checked first only so an oversized file is refused before it is sent.
 *   - The bucket is private. Nothing here ever produces a public URL; the
 *     desk gets a time-limited signed one.
 */
import { hmacHex, timingSafeEqual } from './_shared.js';

/** Private. Created by hand — see docs/PARTNERS.md for the exact steps. */
export const DOCUMENT_BUCKET = 'partner-documents';

/** 10 MB, as briefed. Also set on the bucket itself, which is the real gate. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * The five formats a company profile actually arrives as, and the content
 * type each one is stored under. An ALLOWLIST: anything not named here is
 * refused, which covers executables and archives without having to enumerate
 * them. They are enumerated anyway, in `BLOCKED_EXTENSIONS`, purely so the
 * person holding a .zip gets told what is wrong instead of a flat "not
 * accepted".
 */
export const DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export type DocumentExtension = keyof typeof DOCUMENT_TYPES;

/** Named only to give a better sentence than the allowlist alone would. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'cpl', 'dll', 'sh', 'bash',
  'app', 'apk', 'jar', 'ps1', 'vbs', 'wsf', 'reg', 'pif', 'deb', 'rpm',
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'cab',
]);

export type DocumentClaim = {
  /** Sanitised, as it will appear in the storage path. */
  safeName: string;
  /** What the sender called it, as it will be shown to a human. */
  displayName: string;
  extension: DocumentExtension;
  contentType: string;
};

/**
 * Everything that makes a filename dangerous in a path, removed: directory
 * separators, traversal, control characters, leading dots. What survives is
 * a flat, printable name — and the original is kept separately for display,
 * so a document called "Профиль компании.pdf" is still called that in the
 * email even though the object is stored under an ASCII name.
 */
function sanitiseFilename(name: string): string {
  const flat = name
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 100);
  return flat || 'document';
}

/**
 * Validate a proposed upload. Returns the claim to sign, or a sentence to
 * show the person who chose the file.
 */
export function describeDocument(
  rawName: unknown,
  rawSize: unknown
): DocumentClaim | string {
  if (typeof rawName !== 'string' || !rawName.trim()) {
    return 'Choose a file to attach.';
  }
  const displayName = rawName.trim().slice(0, 200);

  const size = typeof rawSize === 'number' ? rawSize : Number(rawSize);
  if (!Number.isFinite(size) || size <= 0) {
    return 'That file looks empty.';
  }
  if (size > MAX_DOCUMENT_BYTES) {
    return 'That file is larger than 10 MB. Please attach a smaller one.';
  }

  const extension = displayName.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return 'Programs and archives cannot be attached. Please send a PDF, Word or PowerPoint document.';
  }
  if (!(extension in DOCUMENT_TYPES)) {
    return 'That file type is not accepted. Please attach a PDF, Word or PowerPoint document.';
  }
  const ext = extension as DocumentExtension;

  const safe = sanitiseFilename(displayName);
  // Sanitising can eat the extension (a name that was entirely non-ASCII
  // before the dot); put the real one back so the object is stored under a
  // name that says what it is.
  const safeName = safe.toLowerCase().endsWith(`.${ext}`)
    ? safe
    : `${safe.replace(/\.[^.]*$/, '')}.${ext}`;

  return { safeName, displayName, extension: ext, contentType: DOCUMENT_TYPES[ext] };
}

/* -------------------------------------------------------------------- */
/*  Proving the server issued the path                                   */
/* -------------------------------------------------------------------- */

/**
 * The path is a random directory, so it is already unguessable — but "hard to
 * guess" is not the same as "cannot be claimed", and the submit step must not
 * be able to attach an object the sender did not upload. So the path comes
 * back with an HMAC and has to come back WITH it.
 *
 * The key is the service-role key, which is already server-only and always
 * present wherever this runs. Deliberately not a new environment variable:
 * one more secret to set is one more way a deployment is half-configured.
 */
function signingSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
}

export function documentToken(path: string): Promise<string> {
  return hmacHex(signingSecret(), `partner-document:${path}`);
}

export async function documentTokenValid(
  path: string,
  token: unknown
): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  return timingSafeEqual(await documentToken(path), token);
}

/* -------------------------------------------------------------------- */
/*  Storage                                                              */
/* -------------------------------------------------------------------- */

type Env = { url: string; headers: Record<string, string> };

/** `<random>/<safe name>`, so two senders attaching "profile.pdf" never collide. */
export function documentPath(safeName: string): string {
  return `${crypto.randomUUID()}/${safeName}`;
}

/**
 * A one-off URL the browser can PUT the file to directly. Supabase returns it
 * relative; it is made absolute here so the client is handed something it can
 * use without knowing how Storage is laid out.
 */
export async function signUpload(
  env: Env,
  path: string
): Promise<string | null> {
  const response = await fetch(
    `${env.url}/storage/v1/object/upload/sign/${DOCUMENT_BUCKET}/${encodeURI(path)}`,
    { method: 'POST', headers: env.headers, body: '{}' }
  );
  if (!response.ok) {
    console.error(`[partner] stage=sign-upload storage_status=${response.status}`);
    return null;
  }
  const data = (await response.json()) as { url?: string };
  return data.url ? `${env.url}/storage/v1${data.url}` : null;
}

/**
 * What is ACTUALLY in the bucket at that path: the size and content type the
 * storage server recorded, not the ones the browser announced. This is the
 * check that makes the whole flow safe to trust, so a missing object is a
 * refusal rather than a shrug.
 */
export async function documentInfo(
  env: Env,
  path: string
): Promise<{ size: number; contentType: string } | null> {
  const slash = path.lastIndexOf('/');
  const prefix = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const response = await fetch(
    `${env.url}/storage/v1/object/list/${DOCUMENT_BUCKET}`,
    {
      method: 'POST',
      headers: env.headers,
      body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
    }
  );
  if (!response.ok) {
    console.error(`[partner] stage=doc-info storage_status=${response.status}`);
    return null;
  }
  const rows = (await response.json()) as Array<{
    name: string;
    metadata?: { size?: number; mimetype?: string } | null;
  }>;
  const found = Array.isArray(rows) ? rows.find((r) => r.name === name) : undefined;
  if (!found?.metadata?.size) return null;
  return {
    size: found.metadata.size,
    contentType: found.metadata.mimetype ?? 'application/octet-stream',
  };
}

/** Best-effort removal, for a document whose form never made it to a row. */
export async function removeDocument(env: Env, path: string): Promise<void> {
  await fetch(
    `${env.url}/storage/v1/object/${DOCUMENT_BUCKET}/${encodeURI(path)}`,
    { method: 'DELETE', headers: env.headers }
  ).catch(() => undefined);
}

/** Thirty days: long enough to survive a holiday, short enough to expire. */
export const DOWNLOAD_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * A time-limited link to a private object. The bucket is not public and no
 * code path here makes it public — a document someone sent us in confidence
 * does not become a URL that works forever because it was convenient.
 */
export async function signDownload(
  env: Env,
  path: string
): Promise<string | null> {
  const response = await fetch(
    `${env.url}/storage/v1/object/sign/${DOCUMENT_BUCKET}/${encodeURI(path)}`,
    {
      method: 'POST',
      headers: env.headers,
      body: JSON.stringify({ expiresIn: DOWNLOAD_TTL_SECONDS }),
    }
  );
  if (!response.ok) {
    console.error(`[partner] stage=sign-download storage_status=${response.status}`);
    return null;
  }
  const data = (await response.json()) as { signedURL?: string };
  return data.signedURL ? `${env.url}/storage/v1${data.signedURL}` : null;
}

/** "2.4 MB" — for the desk copy, which should say how big the thing is. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
