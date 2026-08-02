import { Link } from 'react-router-dom';
import { Clause, ContactBlock, LegalPage, Points } from './LegalPage';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Updated 1 August 2026">
      <Clause title="Acceptance">
        <p>
          Using this website or booking tickets for Flash @ Brigade 2026
          constitutes acceptance of these Terms of Service and of our{' '}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree with
          them, please do not book a pass or use the site.
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

      <Clause title="Ticket booking">
        <Points
          items={[
            'Tickets are issued digitally. There is no physical ticket.',
            'Ticket limits apply by visitor category, and are shown in the booking form.',
            'The organisers may reject or cancel bookings that breach those limits or that misuse the booking system.',
          ]}
        />
      </Clause>

      <Clause title="Ticket usage">
        <Points
          items={[
            'Registrations are non-transferable.',
            'Registrations are non-refundable unless the organisers specify otherwise.',
            'A QR pass is valid only for the attendee it was registered to.',
            'Misuse of a QR pass may result in that pass being invalidated.',
          ]}
        />
      </Clause>

      <Clause title="Entry">
        <Points
          items={[
            'Once a QR pass has been checked in at the gate it cannot be used again.',
            <>
              A pass you cannot find can be recovered with{' '}
              <Link to="/pass">Retrieve Your Passes</Link>, using the email
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
        <p>
          If you would prefer a particular photograph or recording not to be
          used, write to us at the address below and we will do our best to
          accommodate the request.
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
          stalls, except where such loss or injury results from their own
          negligence. Nothing in these Terms limits any liability that cannot
          lawfully be limited.
        </p>
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
