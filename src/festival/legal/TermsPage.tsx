import { Link } from 'react-router-dom';
import { Clause, ContactBlock, LegalPage, Points } from './LegalPage';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Updated 1 August 2026">
      <Clause title="Acceptance">
        <p>
          Using this website or booking tickets for Flash @ Brigade 2026
          constitutes acceptance of these Terms of Service and of our{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </Clause>

      <Clause title="Eligibility">
        <p>
          Visitors under 18 years of age must have their registration completed
          or authorised by a parent or legal guardian. By registering on behalf
          of a child, the parent or guardian accepts these Terms for that
          attendee.
        </p>
      </Clause>

      <Clause title="Ticket usage">
        <Points
          items={[
            'Tickets are issued as digital passes accessible on this website. There is no physical ticket.',
            'Registrations are non-transferable and non-refundable unless the organisers specify otherwise.',
            'A QR pass is valid only for the attendee(s) registered to.',
            'Misuse of a QR pass or the booking system may result in that pass or booking being invalidated.',
          ]}
        />
      </Clause>

      <Clause title="Entry">
        <Points
          items={[
            'Once a QR pass has been checked in at the gate it cannot be used again.',
            <>
              A pass you cannot find can be recovered with{' '}
              <Link to="/pass">Your Bookings</Link>, using the email
              address and mobile number the booking was made with.
            </>,
          ]}
        />
      </Clause>

      <Clause title="Photography and videography">
        <p>
          Photographs, video and other media recordings are captured throughout
          the carnival. By attending, participants grant the organisers
          permission to use such material for promotional, documentation and
          communication purposes, without further consent and without
          compensation.
        </p>
      </Clause>

      <Clause title="Organisers' rights">
        <p>The organisers reserve the right to:</p>
        <Points
          items={[
            'Refuse entry.',
            'Cancel bookings.',
            'Modify the programme.',
            'Close stalls.',
            'Postpone, suspend or cancel the carnival because of weather, safety concerns or other unforeseen circumstances.',
          ]}
        />
      </Clause>

      <Clause title="Liability">
        <p>
          Flash @ Brigade 2026 is a student-run school carnival held on school
          premises. Attendees take part at their own risk and are responsible
          for their own belongings and, where applicable, for the children in
          their care.
        </p>
        <p>
          To the extent permitted by law, the organisers, The Brigade School @
          Malleswaram and its staff and volunteers are not liable for loss,
          damage to property, or injury arising from attendance, from
          participation in activities, or from food and goods purchased at
          stalls.
        </p>
      </Clause>

      <Clause title="Donations">
        <Points
          items={[
            'Donations made through this website are voluntary and support the charitable objectives of Flash @ Brigade 2026 and The Brigade Foundation.',
            'Donations are non-refundable except where required by applicable law or in the event of a duplicate or erroneous transaction.',
            'Online donations are processed through authorised third-party payment providers. The organisers do not store payment card or banking information.',
          ]}
        />
      </Clause>

      <Clause title="Contact">
        <p>For anything relating to these Terms or to your booking:</p>
        <ContactBlock />
      </Clause>

      <Clause title="Governing law">
        <p>
          These Terms are governed by the laws of India. The courts at
          Bengaluru, Karnataka have exclusive jurisdiction over any dispute
          arising from them.
        </p>
      </Clause>
    </LegalPage>
  );
}
