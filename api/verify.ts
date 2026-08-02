/**
 * POST /api/verify — event-day verification and check-in, used by the
 * /verify-pass volunteer portal.
 *
 * Body: { action: 'verify' | 'checkin' | 'undo', token? | reference? }
 *
 * Authorisation is the volunteer's SESSION COOKIE — there is no shared access
 * code any more, and no credential travels in the body. Every action is
 * attributed to a real person and written to `verification_events`, which is
 * what makes "who checked this attendee in" answerable afterwards.
 *
 * Status semantics:
 *   200 valid / checked_in / undone · 401 not signed in
 *   403 role not permitted         · 404 unknown token
 *   409 already checked in         · 410 cancelled
 *   400 malformed request          · 503 database unavailable
 *
 * Validity is decided exclusively here against the database. Duplicate
 * check-ins are prevented with a conditional update (status must still be
 * 'valid' at write time), so simultaneous scans at two gates cannot both
 * succeed.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  findPassByReference,
  findPassByToken,
  jsonBody,
  REFERENCE_PATTERN,
  send,
  type PassRow,
} from './_shared.js';
import {
  findVolunteerById,
  originAllowed,
  recordVerification,
  requireVolunteer,
  type Env,
} from './_auth.js';

/**
 * Resolve check-in attribution to a display name. The pass stores only
 * `checked_in_by` (a volunteer ID); the name is joined at read time, so
 * correcting a volunteer's spelling corrects every pass they ever handled.
 */
async function presentationOf(env: Env, pass: PassRow) {
  // Resolved on demand, and only when there is an ID to resolve. A failure
  // here costs the name, never the verdict.
  const by = pass.checked_in_by
    ? await findVolunteerById(env, pass.checked_in_by).catch(() => null)
    : null;
  return {
    reference: pass.pass_reference,
    guest: {
      name: pass.registrations?.full_name ?? '',
      visitor_type: pass.registrations?.visitor_type ?? '',
      number_of_passes: pass.registrations?.number_of_passes ?? 1,
      // Present only on student passes; the gate reads them off the pass.
      usn: pass.registrations?.usn ?? null,
      class: pass.registrations?.class ?? null,
      section: pass.registrations?.section ?? null,
    },
    checked_in_at: pass.checked_in_at,
    // Joined name, falling back to the free text written by the retired
    // access-code system so older check-ins still read correctly.
    checked_in_by: by?.full_name ?? pass.checked_in_by_name ?? null,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }
  if (!originAllowed(req)) {
    return send(res, 403, { error: 'Request blocked.' });
  }

  // The session gate. Everything below this line has a named actor.
  const auth = await requireVolunteer(req, res);
  if (!auth) return;
  const { env, volunteer } = auth;

  const body = jsonBody(req);
  if (!body) return send(res, 400, { error: 'Request body must be JSON.' });

  // A pass is identified EITHER by the opaque token the QR carries, or by the
  // short reference printed on it, which is what a volunteer can type.
  const token = typeof body.token === 'string' ? body.token : '';
  const reference =
    typeof body.reference === 'string'
      ? body.reference.trim().toUpperCase()
      : '';
  const byToken = /^[A-Za-z0-9_-]{20,64}$/.test(token);
  const byReference = REFERENCE_PATTERN.test(reference);
  if (!byToken && !byReference) {
    await recordVerification(env, {
      volunteer,
      action: 'lookup_failed',
      reference: reference || null,
      result: 'malformed',
    });
    return send(res, 404, { result: 'invalid', error: 'Pass not found.' });
  }

  const lookup = () =>
    byToken ? findPassByToken(env, token) : findPassByReference(env, reference);
  const action =
    body.action === 'checkin'
      ? 'checkin'
      : body.action === 'undo'
        ? 'undo'
        : 'verify';

  // Undoing a check-in reverses a decision someone already made at the gate,
  // so it is an administrator action. Volunteers verify and admit; only an
  // admin can put a pass back.
  if (action === 'undo' && volunteer.role !== 'admin') {
    return send(res, 403, {
      error: 'Only an administrator can undo a check-in.',
    });
  }

  try {
    const pass = await lookup();
    if (!pass) {
      await recordVerification(env, {
        volunteer,
        action: 'lookup_failed',
        reference: byReference ? reference : null,
        result: 'not_found',
      });
      return send(res, 404, { result: 'invalid', error: 'Pass not found.' });
    }

    const presentation = await presentationOf(env, pass);
    const audit = (result: string) =>
      recordVerification(env, {
        volunteer,
        action: action === 'verify' ? 'verify' : action,
        passId: pass.id,
        reference: pass.pass_reference,
        result,
      });

    if (action === 'verify') {
      if (pass.status === 'valid') {
        await audit('valid');
        return send(res, 200, { result: 'valid', pass: presentation });
      }
      if (pass.status === 'checked_in') {
        await audit('already_checked_in');
        return send(res, 409, {
          result: 'already_checked_in',
          pass: presentation,
        });
      }
      await audit('cancelled');
      return send(res, 410, { result: 'cancelled', pass: presentation });
    }

    if (action === 'undo') {
      // Conditional on the pass still being checked in, so two admins undoing
      // at once cannot double-apply.
      const undoUrl = `${env.url}/rest/v1/passes?id=eq.${pass.id}&status=eq.checked_in`;
      const undo = await fetch(undoUrl, {
        method: 'PATCH',
        headers: { ...env.headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'valid',
          checked_in_at: null,
          checked_in_by: null,
          undone_by: volunteer.id,
          undone_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!undo.ok) {
        console.error(`[verify] stage=undo supabase_status=${undo.status}`);
        return send(res, 503, { error: 'Verification service unavailable.' });
      }
      const undone = (await undo.json()) as unknown[];
      if (undone.length === 0) {
        // Not checked in any more: someone else undid it, or it was cancelled.
        const fresh = await lookup();
        return send(res, 409, {
          result: fresh?.status === 'valid' ? 'valid' : 'cancelled',
          pass: fresh ? await presentationOf(env, fresh) : presentation,
        });
      }
      await audit('undone');
      return send(res, 200, {
        result: 'undone',
        pass: { ...presentation, checked_in_at: null, checked_in_by: null },
      });
    }

    // Check-in: conditional update so a pass moves valid -> checked_in
    // exactly once, no matter how many volunteers scan simultaneously.
    const updateUrl = `${env.url}/rest/v1/passes?id=eq.${pass.id}&status=eq.valid`;
    const update = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        // The volunteer's ID is the source of truth; their name is joined.
        checked_in_by: volunteer.id,
        undone_by: null,
        undone_at: null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!update.ok) {
      console.error(`[verify] stage=checkin supabase_status=${update.status}`);
      return send(res, 503, { error: 'Verification service unavailable.' });
    }
    const updated = (await update.json()) as Array<{ checked_in_at: string }>;

    if (updated.length === 0) {
      // Someone got there first, or the pass was cancelled meanwhile.
      const fresh = await lookup();
      const freshPresentation = fresh
        ? await presentationOf(env, fresh)
        : { ...presentation, checked_in_at: null, checked_in_by: null };
      if (fresh?.status === 'checked_in') {
        await audit('already_checked_in');
        return send(res, 409, {
          result: 'already_checked_in',
          pass: freshPresentation,
        });
      }
      await audit('cancelled');
      return send(res, 410, { result: 'cancelled', pass: freshPresentation });
    }

    await audit('checked_in');
    return send(res, 200, {
      result: 'checked_in',
      pass: {
        ...presentation,
        checked_in_at: updated[0].checked_in_at,
        checked_in_by: volunteer.full_name,
      },
    });
  } catch (error) {
    // Dependency failure (Supabase unreachable, lookup threw). Never let
    // this read as an invalid pass.
    console.error(
      `[verify] stage=lookup error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 503, { error: 'Verification service unavailable.' });
  }
}
