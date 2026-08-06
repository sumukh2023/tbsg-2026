/**
 * What one ticket-holder is, and what they are called.
 *
 * Apart from the component that renders them so the form file can import the
 * shape and the noun without dragging a component in, and so fast refresh
 * keeps working on `AttendeeFields`.
 */

export type AttendeeDraft = {
  name: string;
  usn: string;
  studentClass: string;
  section: string;
};

export type AttendeeErrors = Partial<Record<keyof AttendeeDraft, string>>;

export const emptyAttendee = (): AttendeeDraft => ({
  name: '',
  usn: '',
  studentClass: '',
  section: '',
});

/** What one ticket-holder is called on screen, by category. */
export function attendeeNoun(visitorType: string): string {
  if (visitorType === 'student') return 'Student';
  if (visitorType === 'parent') return 'Parent';
  return 'Visitor';
}
