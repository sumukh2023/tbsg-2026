import { createContext, useContext } from 'react';

/**
 * Who is signed in to the volunteer portal.
 *
 * The client NEVER holds a credential. The session lives in an HttpOnly
 * cookie the browser attaches automatically and no script can read; this
 * context holds only the profile the server chose to tell us about, and it
 * asks the server again rather than remembering across reloads. Nothing
 * touches localStorage — a token in localStorage is readable by any script
 * that ends up on the page, which is the whole reason the cookie is HttpOnly.
 *
 * Kept apart from session.tsx so that file exports components only, which is
 * what keeps fast refresh working for the portal pages.
 */
export type Volunteer = {
  id: string;
  name: string;
  email: string;
  role: 'volunteer' | 'admin';
  must_change_password: boolean;
};

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'anonymous' }
  | { phase: 'signed-in'; volunteer: Volunteer }
  // The browser could not reach the service at all. Distinct from anonymous:
  // bouncing someone to a login page they also cannot reach helps nobody.
  | { phase: 'offline' };

export type SessionValue = {
  state: SessionState;
  /**
   * Re-ask the server, and RETURN what it said. The return value is what
   * lets the login page distinguish "the password was wrong" from "the
   * password was right and this browser did not keep the cookie" — two
   * failures that otherwise look identical and send you hunting in the
   * wrong place.
   */
  refresh: () => Promise<Volunteer | null>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionValue | null>(null);

export function useVolunteerSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error(
      'useVolunteerSession must be used inside <VolunteerSessionProvider>'
    );
  }
  return value;
}
