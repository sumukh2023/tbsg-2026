import { ComingSoonPage } from './ComingSoonPage';
import { CHAPTERS } from './chapters';

export default function GalleryPage() {
  return (
    <ComingSoonPage
      chapter={CHAPTERS[3]}
      eyebrow="Ricordi"
      title="Gallery"
      lede="Rangeelo Rajasthan filled a school with colour for one day. The photographs from that edition, and from this one, will live here."
      note="Photographs from Flash 1.0 are being selected now; the 2026 gallery fills through the day itself."
      previews={[
        {
          title: 'Flash 1.0 · 2023',
          body: 'Rangeelo Rajasthan in 2023, from the opening hour to the last stall closing.',
        },
        {
          title: 'Building the piazza',
          body: 'The weeks before — sets, rehearsals and the work nobody sees.',
        },
        {
          title: 'The day itself',
          body: 'Filled live on 14 November 2026, as the carnival runs.',
        },
      ]}
    />
  );
}
