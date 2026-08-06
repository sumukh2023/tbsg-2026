/**
 * GET /api/pass?token=… — the holder's own pass presentation. The token is
 * the unguessable secret from the registration response; possession of it
 * is what authorises this read. Returns only what the pass itself shows.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findPassByToken, send, supabaseEnv } from './_shared.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const raw = req.query.token;
  const token = typeof raw === 'string' ? raw : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return send(res, 422, { error: 'That pass link is not valid.' });
  }

  const env = supabaseEnv('pass');
  if (!env) {
    return send(res, 503, { error: 'The pass service is not configured yet.' });
  }

  try {
    const pass = await findPassByToken(env, token);
    if (!pass) {
      return send(res, 404, { error: 'No pass matches this link.' });
    }
    return send(res, 200, {
      pass: {
        reference: pass.pass_reference,
        status: pass.status,
        issued_at: pass.issued_at,
        checked_in_at: pass.checked_in_at,
        sequence: pass.sequence,
        booking_reference: pass.registrations?.booking_reference ?? null,
        of: pass.registrations?.number_of_passes ?? 1,
        guest: {
          /* THE ATTENDEE, off the pass itself. It used to be the booking's
             `full_name`, which meant every pass in a family showed the
             purchaser and none of them named the person holding it. */
          name: pass.attendee_name,
          visitor_type: pass.attendee_category,
          number_of_passes: pass.registrations?.number_of_passes ?? 1,
          // The school roll this pass carries: the attendee's own for a
          // student, the child the booking is for on a parent's pass.
          student_name: pass.student_name,
          usn: pass.usn,
          class: pass.class,
          section: pass.section,
        },
      },
    });
  } catch (error) {
    console.error(
      `[pass] stage=lookup error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 500, {
      error: 'The pass service is unreachable right now.',
    });
  }
}
