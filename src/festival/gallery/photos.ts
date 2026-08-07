/**
 * The Gallery's catalogue. One record per photograph, and the only place any
 * of them is described.
 *
 * ADDING A PHOTOGRAPH IS ONE RECORD. Drop the file in `public/rangeelo/`, add
 * an entry here with its intrinsic width and height, and it appears in the
 * mosaic, the wall and the lightbox with its categories already counted. No
 * component knows how many photographs there are.
 *
 * WHY WIDTH AND HEIGHT ARE STORED. They are not decoration: every frame
 * reserves its exact aspect ratio before the file arrives, which is what
 * stops the masonry re-flowing as images decode. A record without them would
 * reintroduce the layout shift the whole wall is built to avoid, so they are
 * required rather than optional.
 *
 * `src` IS OPTIONAL, deliberately. A plate with no file renders the same
 * material frame the rest of the site uses for photographs it is waiting for
 * (see MissionPage's RANGEELO). That is what lets a section be laid out
 * correctly today and become richer as the archive is digitised, instead of
 * shipping a broken image.
 */

/** The filter vocabulary, in the order the chips appear. */
export const CATEGORIES = [
  'Stage',
  'Culture',
  'Food',
  'Performances',
  'Behind the Scenes',
  'Volunteers',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Photo = {
  id: string;
  /** Absent while the archive is still being digitised. */
  src?: string;
  /** What the photograph shows. Never displayed; this is the accessible name. */
  alt: string;
  /** Shown in the lightbox and on hover. A sentence, not a filename. */
  caption: string;
  categories: readonly Category[];
  /** Intrinsic pixels. Required: see the note above about layout shift. */
  width: number;
  height: number;
};

/**
 * Flash 1.0, Rangeelo Rajasthan, 2023.
 *
 * Eight photographs, which is the whole of what survives in the repository.
 * They are ordered as the day ran rather than by filename, so the mosaic in
 * section 01 reads as an arc from the ribbon to the evening.
 */
export const FLASH_ONE: Photo[] = [
  {
    id: 'ribbon',
    src: '/rangeelo/1.jpg',
    alt: 'Guests cutting a pink ribbon at the entrance to open the carnival',
    caption: 'The ribbon falls, and Rangeelo Rajasthan begins',
    categories: ['Culture'],
    width: 1400,
    height: 844,
  },
  {
    id: 'ground',
    src: '/rangeelo/7.jpg',
    alt: 'Aerial view of the school ground filled with visitors around the stage and stalls',
    caption: 'The whole ground, an hour after the gates opened',
    categories: ['Stage', 'Food'],
    width: 2000,
    height: 1128,
  },
  {
    id: 'stage-wide',
    src: '/rangeelo/8.jpg',
    alt: 'The main stage with the painted Rangeelo Rajasthan backdrop and student musicians',
    caption: 'The main stage, painted end to end for the theme',
    categories: ['Stage'],
    width: 2000,
    height: 1116,
  },
  {
    id: 'choir',
    src: '/rangeelo/2.jpg',
    alt: 'A student choir and band performing on the main stage under the marquee',
    caption: 'The school choir opens the programme',
    categories: ['Stage', 'Performances'],
    width: 1400,
    height: 668,
  },
  {
    id: 'folk-band',
    src: '/rangeelo/4.jpg',
    alt: 'Rajasthani folk musicians singing on stage in embroidered jackets',
    caption: 'Folk musicians from Rajasthan, mid-song',
    categories: ['Performances', 'Culture'],
    width: 1400,
    height: 794,
  },
  {
    id: 'mass-dance',
    src: '/rangeelo/3.jpg',
    alt: 'Aerial view of hundreds of students dancing in formation on the ground',
    caption: 'Four hundred dancers, one formation, from above',
    categories: ['Performances'],
    width: 1400,
    height: 783,
  },
  {
    id: 'crowd',
    src: '/rangeelo/5.jpg',
    alt: 'Visitors dancing together among the stall canopies',
    caption: 'The moment the crowd stopped watching and joined in',
    categories: ['Culture', 'Food'],
    width: 1400,
    height: 793,
  },
  {
    id: 'decorations',
    src: '/rangeelo/6.jpg',
    alt: 'Teachers seated on steps beside hand-painted Rajasthani panels and drums',
    caption: 'Every panel on the ground was painted by hand, in school',
    categories: ['Behind the Scenes', 'Volunteers'],
    width: 1400,
    height: 811,
  },
];

/**
 * Every photograph the wall in section 04 can show.
 *
 * One list, because there is one archive. An earlier draft kept a second
 * list for the work-before-the-day and it immediately went wrong: the
 * photograph of the painted panels belongs to both, so it existed twice with
 * two ids, and the lightbox counted it twice on the way past.
 */
export const CATALOGUE: Photo[] = FLASH_ONE;

/** How many photographs a category actually has. Drives the chip counts. */
export function countFor(category: Category, photos = CATALOGUE): number {
  return photos.filter((p) => p.src && p.categories.includes(category)).length;
}

/**
 * The films, as preview cards.
 *
 * NOT EMBEDDED. An iframe per video is two player bundles, a set of cookies
 * from a third party and a layout the page does not control, on a page whose
 * whole job is photographs. A card that opens the video where it lives costs
 * one image.
 */
export type Film = {
  id: string;
  youtubeId: string;
  url: string;
  title: string;
  blurb: string;
  duration?: string;
  /** Vertical films need a portrait card, or the thumbnail is pillarboxed. */
  orientation: 'landscape' | 'portrait';
};

export const FILMS: Film[] = [
  {
    id: 'aftermovie',
    youtubeId: '6pGq-5082n4',
    url: 'https://www.youtube.com/watch?v=6pGq-5082n4',
    title: 'Rangeelo Rajasthan, the film',
    blurb:
      'The official film of Flash 1.0, from the ribbon at the gate to the last stall closing after dark.',
    orientation: 'landscape',
  },
  {
    id: 'short',
    youtubeId: 'Sq9WJ0H_pE8',
    url: 'https://www.youtube.com/shorts/Sq9WJ0H_pE8',
    title: 'One minute on the ground',
    blurb:
      'A vertical cut made for a phone: the colour, the noise and the crowd, at the pace it happened.',
    orientation: 'portrait',
  },
];

/**
 * YouTube's own still for a video.
 *
 * `hqdefault` rather than `maxresdefault`: the high-resolution still only
 * exists for videos uploaded above a certain size and 404s silently for the
 * rest, which would leave a card with a hole in it. This one always exists.
 */
export function thumbnailFor(youtubeId: string): string {
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}
