import { memo } from 'react';
import { FloatingInput, FloatingSelect } from './fields';
import { attendeeNoun, type AttendeeDraft, type AttendeeErrors } from './attendee';

/**
 * One block of fields per ticket, because one QR code per ticket needs one
 * NAME per ticket.
 *
 * A booking used to collect the purchaser and a number, and everyone in the
 * party shared a single code. Now each ticket becomes its own pass, and a
 * pass with nobody's name on it cannot be checked in against anybody, so the
 * form has to ask. This is the only new thing the visitor is asked for.
 *
 * WHAT IS ASKED FOR DIFFERS BY CATEGORY, and it is not an inconsistency:
 *
 *   students  three tickets are three different pupils, so each carries its
 *             own name, USN, class and section
 *   parents   two tickets are one child's two parents: each parent is named
 *             here, and the child is named once in the section above
 *   others    a name, and nothing else there is any reason to hold
 */

export const AttendeeFields = memo(function AttendeeFields({
  visitorType,
  attendees,
  errors,
  onChange,
  classes,
  sections,
}: {
  visitorType: string;
  attendees: AttendeeDraft[];
  errors: AttendeeErrors[];
  onChange: (index: number, patch: Partial<AttendeeDraft>) => void;
  classes: readonly string[];
  sections: readonly string[];
}) {
  if (attendees.length === 0) return null;
  const noun = attendeeNoun(visitorType);
  const isStudent = visitorType === 'student';
  // With one ticket there is nothing to number, and "Visitor 1" beside a
  // single field reads like a form that expected more of you.
  const numbered = attendees.length > 1;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl font-medium text-foreground">
          {numbered ? `Who the ${attendees.length} passes are for` : 'Who the pass is for'}
        </h3>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          {numbered
            ? 'Each person gets their own pass and their own QR code, so each can arrive separately.'
            : 'This name goes on the pass and is what the gate checks you in against.'}
        </p>
      </div>

      <div className="space-y-5">
        {attendees.map((attendee, index) => (
          <div
            key={index}
            className={
              numbered
                ? 'rounded-xl border border-border/60 bg-background/30 p-4'
                : ''
            }
          >
            {numbered && (
              <p className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {noun} {index + 1}
              </p>
            )}
            <div className="space-y-2">
              <FloatingInput
                id={`attendee-${index}-name`}
                label={numbered ? `${noun} ${index + 1} name` : `${noun} name`}
                value={attendee.name}
                onChange={(v) => onChange(index, { name: v })}
                error={errors[index]?.name}
                maxLength={120}
                autoComplete="off"
              />
              {isStudent && (
                <>
                  {/* A USN is A-Z and 0-9 and nothing else, so the field
                      simply cannot hold anything else: lowercase is
                      upper-cased as it is typed and punctuation is dropped.
                      Correcting the input beats an error message for a rule
                      the reader cannot usefully break. */}
                  <FloatingInput
                    id={`attendee-${index}-usn`}
                    label="USN"
                    value={attendee.usn}
                    onChange={(v) =>
                      onChange(index, {
                        usn: v.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                    error={errors[index]?.usn}
                    maxLength={20}
                    autoComplete="off"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FloatingSelect
                      id={`attendee-${index}-class`}
                      label="Class"
                      value={attendee.studentClass}
                      onChange={(v) => onChange(index, { studentClass: v })}
                      error={errors[index]?.studentClass}
                      options={classes}
                    />
                    <FloatingSelect
                      id={`attendee-${index}-section`}
                      label="Section"
                      value={attendee.section}
                      onChange={(v) => onChange(index, { section: v })}
                      error={errors[index]?.section}
                      options={sections}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
