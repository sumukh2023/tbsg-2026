/**
 * POST /api/retrieve — pass retrieval for visitors who lost the success
 * page. Requires the email, the mobile number AND the name used to register;
 * the response is deliberately identical for "no match" and "bad details" so
 * registrations cannot be enumerated.
 *
 * THE NAME IS MATCHED LENIENTLY AND THE OTHER TWO ARE NOT. An email address
 * and a phone number have one correct form; a name does not. Someone who
 * registered as "Priya  Menon" and types "priya menon" has proved exactly as
 * much as someone who reproduced the double space, so the comparison folds
 * case, runs of whitespace and accents before comparing. It is a third thing
 * the requester has to know, not a spelling test.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cleanText,
  jsonBody,
  randomToken,
  send,
  sha256Hex,
  supabaseEnv,
} from './_shared.js';

const GENERIC =
  'Pass not found. Please check the details entered and try again.';

/**
 * A name reduced to what it actually is, so two spellings of the same name
 * compare equal.
 *
 * Case, leading and trailing space and runs of internal whitespace all go.
 * So do combining accents: NFD splits "é" into "e" plus its accent and the
 * range strips the accent, which means a visitor who registered from a phone
 * that produced "José" is not locked out by a desktop keyboard that produced
 * "Jose". What is deliberately NOT stripped is letters: this stays a check
 * that the requester knows the name, not a fuzzy search.
 */
function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const body = jsonBody(req);
  if (!body) {
    return send(res, 400, { error: 'Request body must be JSON.' });
  }

  const email = cleanText(body.email, 160)?.toLowerCase() ?? null;
  const phone = cleanText(body.phone, 16)?.replace(/[\s-]/g, '') ?? null;
  /* Tabs and newlines become SPACES before `cleanText` sees them. It strips
     control characters outright, which is right for storage and wrong here:
     a name pasted out of a spreadsheet arrives as "Priya\tMenon", and
     deleting the tab makes it "PriyaMenon", which matches nothing. Turning it
     into the space it visually was makes the paste behave like the typing it
     looks like. */
  const name = cleanText(
    typeof body.full_name === 'string'
      ? body.full_name.replace(/[\t\n\r\f\v]+/g, ' ')
      : body.full_name,
    120
  );
  if (!email || !phone || !name) {
    return send(res, 404, { error: GENERIC });
  }
  const wanted = foldName(name);

  const env = supabaseEnv('retrieve');
  if (!env) {
    return send(res, 503, { error: 'The pass service is not configured yet.' });
  }

  try {
    /* The name is compared HERE rather than in the query. PostgREST's `eq`
       is exact and case-sensitive and `ilike` still would not collapse a
       double space, so the lenient comparison this needs cannot be expressed
       as a filter. Candidates are fetched by email and phone (already a very
       narrow key) and folded in memory. The limit is small but not one: the
       same household can hold more than one registration on a shared address
       and number, and taking only the newest would refuse the person whose
       booking happens not to be the latest. */
    const regUrl =
      `${env.url}/rest/v1/registrations?select=id,full_name` +
      `&email=eq.${encodeURIComponent(email)}` +
      `&phone=eq.${encodeURIComponent(phone)}` +
      `&order=created_at.desc&limit=20`;
    const regResponse = await fetch(regUrl, { headers: env.headers });
    if (!regResponse.ok) throw new Error('lookup failed');
    const regs = (await regResponse.json()) as Array<{
      id: string;
      full_name: string | null;
    }>;
    /* THE NAME MATCHES THE PURCHASER OR ANY ATTENDEE.
       A booking is made by one person for several, and the person who comes
       looking for it later is often not the one whose name is on it: a parent
       books, a grandparent turns up at the gate having been told "it's under
       Priya". Both are legitimate holders of the same booking, so both open
       it. The purchaser is checked first because it costs nothing; the
       attendee names need a second read and are only fetched if that misses. */
    const byPurchaser = regs.find((r) => foldName(r.full_name ?? '') === wanted);

    let booking = byPurchaser ?? null;
    if (!booking && regs.length) {
      const ids = regs.map((r) => r.id).join(',');
      const namesUrl =
        `${env.url}/rest/v1/passes?select=registration_id,attendee_name` +
        `&registration_id=in.(${ids})`;
      const namesResponse = await fetch(namesUrl, { headers: env.headers });
      if (!namesResponse.ok) throw new Error('lookup failed');
      const rows = (await namesResponse.json()) as Array<{
        registration_id: string;
        attendee_name: string | null;
      }>;
      const hit = rows.find((r) => foldName(r.attendee_name ?? '') === wanted);
      booking = hit ? (regs.find((r) => r.id === hit.registration_id) ?? null) : null;
    }
    if (!booking) return send(res, 404, { error: GENERIC });

    const passUrl =
      `${env.url}/rest/v1/passes?select=id,status,pass_reference` +
      `&registration_id=eq.${booking.id}&order=sequence.asc`;
    const passResponse = await fetch(passUrl, { headers: env.headers });
    if (!passResponse.ok) throw new Error('lookup failed');
    const passes = (await passResponse.json()) as Array<{
      id: string;
      status: string;
      pass_reference: string;
    }>;
    if (!passes.length) return send(res, 404, { error: GENERIC });

    /* EVERY PASS IN THE BOOKING IS ROTATED, not just the first.
       Retrieval hands back the whole deck, so every token in it is newly
       issued and every previously circulated link stops working. Rotating
       one and returning several would have left the other links alive
       indefinitely, which is the opposite of what rotation is for. */
    const issued = await Promise.all(
      passes.map(async (pass) => {
        const token = randomToken();
        const rotate = await fetch(
          `${env.url}/rest/v1/passes?id=eq.${pass.id}`,
          {
            method: 'PATCH',
            headers: env.headers,
            body: JSON.stringify({
              verification_token_hash: await sha256Hex(token),
              updated_at: new Date().toISOString(),
            }),
          }
        );
        return rotate.ok ? token : null;
      })
    );
    if (issued.some((t) => t === null)) throw new Error('rotation failed');
    const tokens = issued as string[];

    return send(res, 200, {
      // The whole deck, in booking order. `token` is the first of them, kept
      // so a browser holding a cached bundle mid-deploy still opens a pass.
      token: tokens[0],
      tokens,
    });
  } catch (error) {
    console.error(
      `[retrieve] stage=lookup error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 500, {
      error: 'The pass service is unreachable right now.',
    });
  }
}
