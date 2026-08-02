import { Link } from 'react-router-dom';
import { Clause, ContactBlock, LegalPage, Points } from './LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="Updated 1 August 2026">
      <Clause title="What we collect">
        <p>
          When you reserve passes for Flash @ Brigade 2026 we collect only what
          the booking needs:
        </p>
        <Points
          items={[
            'Full name.',
            'Email address.',
            'Mobile number.',
            'Visitor category.',
            'Student details, where they apply: name, USN, class and section.',
            'Booking information, including the number of passes and anything you tell us in the accessibility or comments fields.',
            'QR pass information, used to issue and verify your pass.',
          ]}
        />
      </Clause>

      <Clause title="Why we collect it">
        <p>Only to run the event:</p>
        <Points
          items={[
            'Process your booking.',
            'Generate your QR pass.',
            'Verify attendees at the gate on the day.',
            'Communicate updates about your booking.',
            'Send Flash @ Brigade updates, if you have opted in.',
            'Maintain event security.',
            'Prevent fraudulent or duplicate registrations.',
            'Respond to your support enquiries.',
          ]}
        />
      </Clause>

      <Clause title="Email communication">
        <Points
          items={[
            'Booking confirmations and operational emails about your registration are always sent — they are part of holding a pass.',
            'Optional Flash @ Brigade updates are sent only if you opted in when booking.',
          ]}
        />
        <p>
          You can change your mind at any time by writing to the address below.
        </p>
      </Clause>

      <Clause title="Who can see it">
        <Points
          items={[
            'Your information is accessible only to authorised school management, for operating the event.',
            'It is never sold.',
            'It is never shared with sponsors or with unrelated third parties.',
          ]}
        />
      </Clause>

      <Clause title="How long we keep it">
        <p>
          Personal information collected for Flash @ Brigade 2026 is retained
          only for as long as it is needed to operate the event, and will be
          permanently deleted on{' '}
          <strong className="font-medium text-foreground">
            15 November 2026
          </strong>
          , unless we are legally required to retain it for longer.
        </p>
      </Clause>

      <Clause title="Security">
        <p>
          We use reasonable technical and organisational safeguards to protect
          your information. Pass verification runs entirely on the server, and
          the QR code on your pass carries an opaque token rather than your
          personal details — only a hash of that token is stored, so the pass
          itself reveals nothing about you.
        </p>
        <p>
          No system can be guaranteed completely secure, and we cannot promise
          absolute security, but we take the protection of this information
          seriously and limit both what we collect and how long we keep it.
        </p>
      </Clause>

      <Clause title="Your choices">
        <p>
          You can ask us what we hold about you, ask for it to be corrected, or
          ask for it to be deleted before the retention date above, by writing
          to the address below. Deleting a booking also cancels the passes
          issued against it. Our <Link to="/terms">Terms of Service</Link>{' '}
          govern the booking itself.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>For any question about this policy or your information:</p>
        <ContactBlock />
      </Clause>

      <Clause title="Governing law">
        <p>
          This policy is governed by the laws of India, with jurisdiction at
          Bengaluru, Karnataka.
        </p>
      </Clause>
    </LegalPage>
  );
}
