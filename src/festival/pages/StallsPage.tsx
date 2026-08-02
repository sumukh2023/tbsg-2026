import { ComingSoonPage } from './ComingSoonPage';
import { CHAPTERS } from './chapters';

export default function StallsPage() {
  return (
    <ComingSoonPage
      chapter={CHAPTERS[1]}
      eyebrow="Il Mercato"
      title="Stalls"
      lede="Forty-two of them, run start to finish by students — food from six regions, craft you can take home, and games that are harder than they look."
      note="The full list of stalls, what each one sells and where to find it goes up as the mercato is finalised."
      previews={[
        {
          title: 'The food streets',
          body: 'Region by region, with what is cooked fresh on the day and what to queue for first.',
        },
        {
          title: 'Craft and market',
          body: 'Student-made goods, printworks and the makers behind each table.',
        },
        {
          title: 'A map of the piazza',
          body: 'Where every stall stands, so you can plan a route instead of wandering.',
        },
      ]}
    />
  );
}
