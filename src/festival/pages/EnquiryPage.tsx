import { ComingSoonPage } from './ComingSoonPage';
import { CHAPTERS } from './chapters';

export default function EnquiryPage() {
  return (
    <ComingSoonPage
      chapter={CHAPTERS[4]}
      eyebrow="Front desk"
      title="Enquiry"
      lede="Questions about passes, stalls, partnering or supporting the carnival — and, closer to the day, how to give directly."
      note="An enquiry form is on its way. Until it lands, the front desk details in the footer reach a person who can help."
      previews={[
        {
          title: 'General enquiries',
          body: 'Anything about the day itself: timings, access, what to expect.',
        },
        {
          title: 'Partner with us',
          body: 'For organisations who want to support Flash @ Brigade 2026.',
        },
        {
          title: 'Support Us',
          body: 'Direct giving to Passion with Compassion, opening closer to the day.',
        },
      ]}
    />
  );
}
