import { ComingSoonPage } from './ComingSoonPage';
import { CHAPTERS } from './chapters';

export default function PartnersPage() {
  return (
    <ComingSoonPage
      chapter={CHAPTERS[2]}
      eyebrow="Insieme"
      title="Partners"
      lede="Brigade Foundation looks for partners rather than patrons — people and organisations who share the concern and want to put weight behind it."
      note="Partner listings and the ways to work with us are being confirmed ahead of the day."
      previews={[
        {
          title: 'Who stands with us',
          body: 'The organisations backing Flash @ Brigade 2026, and what each one makes possible.',
        },
        {
          title: 'Ways to partner',
          body: 'Sponsorship, in-kind support and stalls — what is involved in each.',
        },
        {
          title: 'Where it goes',
          body: 'How partner contributions reach Passion with Compassion, in full.',
        },
      ]}
    />
  );
}
