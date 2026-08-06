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

/**
 * One word for a whole booking, from the state of the passes in it.
 *
 * A booking is rarely all one thing on the day: a family of four arrives in
 * two cars, so two passes are checked in and two are not. "Partly checked in"
 * is the honest description of that, and it is the state the person looking
 * at the list most needs to be able to see.
 */
function bookingStatus(
  statuses: string[]
): 'active' | 'partly_checked_in' | 'checked_in' | 'cancelled' {
  if (statuses.every((s) => s === 'cancelled')) return 'cancelled';
  const live = statuses.filter((s) => s !== 'cancelled');
  if (live.every((s) => s === 'checked_in')) return 'checked_in';
  if (live.some((s) => s === 'checked_in')) return 'partly_checked_in';
  return 'active';
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
      `${env.url}/rest/v1/registrations?select=id,full_name,booking_reference,` +
      `created_at,number_of_passes,total_amount,payment_status` +
      `&email=eq.${encodeURIComponent(email)}` +
      `&phone=eq.${encodeURIComponent(phone)}` +
      `&order=created_at.desc&limit=20`;
    const regResponse = await fetch(regUrl, { headers: env.headers });
    if (!regResponse.ok) throw new Error('lookup failed');
    const regs = (await regResponse.json()) as Array<{
      id: string;
      full_name: string | null;
      booking_reference: string | null;
      created_at: string;
      number_of_passes: number;
      total_amount: number | null;
      payment_status: string | null;
    }>;
    if (!regs.length) return send(res, 404, { error: GENERIC });

    /* ONE READ FOR EVERY CANDIDATE BOOKING'S PASSES.
       They are needed twice over: to match on attendee names, and to build
       the reply. Asking per booking would be one round trip each for a
       household that books repeatedly, and they are all the same query with
       a different id. */
    const passUrl =
      `${env.url}/rest/v1/passes` +
      `?select=id,registration_id,status,attendee_name,sequence` +
      `&registration_id=in.(${regs.map((r) => r.id).join(',')})` +
      `&order=sequence.asc`;
    const passResponse = await fetch(passUrl, { headers: env.headers });
    if (!passResponse.ok) throw new Error('lookup failed');
    const allPasses = (await passResponse.json()) as Array<{
      id: string;
      registration_id: string;
      status: string;
      attendee_name: string | null;
      sequence: number;
    }>;

    /* THE NAME MATCHES THE PURCHASER OR ANY ATTENDEE.
       A booking is made by one person for several, and the person who comes
       looking for it later is often not the one whose name is on it: a parent
       books, a grandparent turns up at the gate having been told "it's under
       Priya". Both are legitimate holders of the same booking, so both open
       it. */
    const named = new Set(
      allPasses
        .filter((p) => foldName(p.attendee_name ?? '') === wanted)
        .map((p) => p.registration_id)
    );
    /* EVERY MATCHING BOOKING, not the first one found.
       A family that books in September and again in October holds two, and
       returning only one of them hides passes the visitor paid for and will
       be asked for at the gate. `regs` is already newest first, so the
       bookings come back in the order the list wants to show them. */
    const matched = regs.filter(
      (r) => foldName(r.full_name ?? '') === wanted || named.has(r.id)
    );
    const passesFor = new Map<string, typeof allPasses>();
    for (const pass of allPasses) {
      const bucket = passesFor.get(pass.registration_id);
      if (bucket) bucket.push(pass);
      else passesFor.set(pass.registration_id, [pass]);
    }
    const bookings = matched.filter((r) => passesFor.get(r.id)?.length);
    if (!bookings.length) return send(res, 404, { error: GENERIC });

    /* EVERY PASS IN EVERY MATCHED BOOKING IS ROTATED, not just the first.
       Retrieval hands back the whole deck, so every token in it is newly
       issued and every previously circulated link stops working. Rotating
       one and returning several would have left the other links alive
       indefinitely, which is the opposite of what rotation is for. */
    const rotated = await Promise.all(
      bookings.map(async (booking) => {
        const rows = passesFor.get(booking.id) as typeof allPasses;
        const tokens = await Promise.all(
          rows.map(async (pass) => {
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
        if (tokens.some((t) => t === null)) throw new Error('rotation failed');
        return {
          reference: booking.booking_reference,
          booked_at: booking.created_at,
          passes: rows.length,
          total_amount: booking.total_amount,
          payment_status: booking.payment_status,
          status: bookingStatus(rows.map((p) => p.status)),
          tokens: tokens as string[],
        };
      })
    );

    const flat = rotated.flatMap((b) => b.tokens);
    return send(res, 200, {
      // Newest booking first, each with its own deck in booking order.
      bookings: rotated,
      // `token` and `tokens` are the pre-bookings shape, kept so a browser
      // still holding a cached bundle mid-deploy opens a pass rather than an
      // error. They are the flattened decks, newest booking first.
      token: flat[0],
      tokens: flat,
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
