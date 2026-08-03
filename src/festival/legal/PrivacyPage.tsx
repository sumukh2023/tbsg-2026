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
            'Booking confirmations and operational emails about your registration are always sent.',
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
            'It is never sold or shared with sponsors and other unrelated third parties.',
          ]}
        />
      </Clause>

      <Clause title="How long we keep it">
        <p>
          Personal information collected for Flash @ Brigade 2026 is retained
          only for as long as it is needed to operate the event, and will be
          deleted after the event, unless we are legally required to retain it
          for longer.
        </p>
      </Clause>

      <Clause title="Donor recognition">
        <p>
          If you make a donation through this website, you may choose whether
          your name is publicly acknowledged or kept anonymous. If you select
          Anonymous donation, your name will not be publicly associated with
          your donation. Your information will still be retained internally for
          administrative, accounting and legal purposes in accordance with this
          Privacy Policy.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>For any question about this policy or your information:</p>
        <ContactBlock />
      </Clause>

      <Clause title="Governing law">
        <p>
          This policy is governed by the laws of India. The courts at Bengaluru,
          Karnataka have exclusive jurisdiction over any dispute arising from
          them.
        </p>
      </Clause>
    </LegalPage>
  );
}
