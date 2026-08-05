/**
 * The exhibit's content: sixteen places on the map, and what each one has to
 * say.
 *
 * WHY LANDMARKS ARE NOT MARKERS. The brief lists nineteen landmarks as well
 * as seventeen cities. Eight of those landmarks are in Rome — the Colosseum,
 * the Forum, the Trevi, the Pantheon, and the four inside the Vatican — and
 * the Vatican is an enclave two kilometres from the Roman Forum. This map
 * draws about 1,200km of Italy across 1,000 units, so those eight landmarks
 * and the two cities they sit in occupy the same one and a half pixels. Eight
 * markers there would not be a dense cluster; they would be one illegible
 * blot, and the same is true of Venice's three and Florence's three.
 *
 * So the CITY is the marker and its landmarks are what the card reveals. That
 * is the "cluster nearby landmarks intelligently" the brief asks for, and it
 * is also the better exhibit: you are not told everything at once, you open a
 * city and find what is in it.
 *
 * Vatican City is listed among the cities and has no marker of its own for
 * the same reason — it is inside Rome, and it appears there, named.
 *
 * Coordinates are real. `project()` in geometry.ts is the transform the
 * outline itself came out of, so nothing here is positioned by eye.
 */
import { project } from './geometry';

/** The seven kinds of thing a card can tell you, in the order they read. */
export type FacetKind =
  | 'history'
  | 'art'
  | 'architecture'
  | 'cuisine'
  | 'festivals'
  | 'fact'
  | 'travel';

export type Facet = { kind: FacetKind; body: string };

export type Place = {
  slug: string;
  name: string;
  /** The epithet under the name. Not a description — a title. */
  epithet: string;
  lat: number;
  lon: number;
  /**
   * Which side of the marker its label sits on. Hand-tuned: Tuscany puts
   * Florence, Siena and Pisa within sixty units of each other, and the north
   * puts Milan and Como within thirty-five.
   */
  side: 'left' | 'right';
  /** Nudge, in view units, for the few that would still collide. */
  nudge?: { x?: number; y?: number };
  /** What stands here. Shown inside the card, never on the map. */
  landmarks?: string[];
  /** The opening line of the card, under the epithet. */
  lede: string;
  facets: Facet[];
  /**
   * Two colours that stand for the place — the plate behind the card is built
   * from them. See `backdrop.ts` for what happens when a photograph exists.
   */
  palette: [string, string];
};

const PLACES_RAW: Omit<Place, 'x' | 'y'>[] = [
  {
    slug: 'roma',
    name: 'Rome',
    epithet: 'The Eternal City',
    lat: 41.9028,
    lon: 12.4964,
    side: 'left',
    landmarks: [
      'The Colosseum',
      'The Roman Forum',
      'The Trevi Fountain',
      'The Pantheon',
      'Vatican City · St Peter’s Basilica',
      'Vatican City · the Vatican Museums',
      'Vatican City · the Sistine Chapel',
    ],
    lede: 'Three thousand years of a city that never stopped being used.',
    facets: [
      {
        kind: 'history',
        body: 'Founded, by its own account, in 753 BC. It has been a kingdom, a republic, an empire and the seat of a church, and it never emptied out between any of them — which is why the layers are stacked rather than buried.',
      },
      {
        kind: 'art',
        body: 'Michelangelo spent four years on his back painting the Sistine Chapel ceiling and complained about it in verse. Caravaggio’s paintings still hang in the churches he painted them for, lit by coin-operated lights.',
      },
      {
        kind: 'architecture',
        body: 'The Pantheon’s dome has stood unreinforced since AD 126 and is still the largest of its kind on earth. The Romans thinned their concrete as it rose, ending in pumice light enough to hold itself up.',
      },
      {
        kind: 'cuisine',
        body: 'Four pastas and an argument about each: carbonara, cacio e pepe, gricia, amatriciana. All of them are poor food, built from cured pork, hard cheese and pepper.',
      },
      {
        kind: 'festivals',
        body: 'Natale di Roma on 21 April, when the city celebrates its own birthday with people in legionary kit marching past the Circus Maximus.',
      },
      {
        kind: 'fact',
        body: 'Roughly €3,000 lands in the Trevi Fountain every day. It is collected each night and goes to a Catholic charity that runs supermarkets for the poor.',
      },
      {
        kind: 'travel',
        body: 'Drinking water is free and everywhere: some 2,500 cast-iron nasoni run cold all day. Block the spout with a finger and it arches up to drink from.',
      },
    ],
    palette: ['#C4703A', '#6B3A1E'],
  },
  {
    slug: 'venezia',
    name: 'Venice',
    epithet: 'La Serenissima',
    lat: 45.4408,
    lon: 12.3155,
    side: 'right',
    landmarks: ['The Grand Canal', 'The Rialto Bridge', 'St Mark’s Basilica'],
    lede: 'A city built on millions of wooden piles driven into a lagoon.',
    facets: [
      {
        kind: 'history',
        body: 'A republic for 1,100 years, run by merchants who elected their own head of state. It outlasted every other Italian state and was finally handed to Austria by Napoleon in 1797.',
      },
      {
        kind: 'art',
        body: 'Titian, Tintoretto and Veronese worked here in the same decades. Venetian painters got their colour from the pigment trade the city itself controlled.',
      },
      {
        kind: 'architecture',
        body: 'St Mark’s is Byzantine, not Italian — modelled on a church in Constantinople and covered in mosaics that use gold leaf sandwiched inside glass.',
      },
      {
        kind: 'cuisine',
        body: 'Cicchetti: small plates eaten standing at a bàcaro with a glass of wine. Sarde in saor — sardines with onions, pine nuts and raisins — is sailors’ food from the days of long voyages.',
      },
      {
        kind: 'festivals',
        body: 'Carnevale, whose masks once let anyone talk to anyone. The Regata Storica in September still races boats the republic would recognise.',
      },
      {
        kind: 'fact',
        body: 'The piles under the city have not rotted in 1,300 years. Submerged in mud with no oxygen, the wood slowly turned to something close to stone.',
      },
      {
        kind: 'travel',
        body: 'The vaporetto is the bus. A gondola crossing of the Grand Canal — the traghetto — costs about two euros and is how Venetians use them.',
      },
    ],
    palette: ['#2F6E86', '#123A4C'],
  },
  {
    slug: 'firenze',
    name: 'Florence',
    epithet: 'The Cradle of the Renaissance',
    lat: 43.7696,
    lon: 11.2558,
    side: 'right',
    landmarks: [
      'The Duomo · Santa Maria del Fiore',
      'The Ponte Vecchio',
      'The Uffizi Gallery',
    ],
    lede: 'A banking town that spent its money on artists and changed everything.',
    facets: [
      {
        kind: 'history',
        body: 'The Medici ran Florence for three centuries, mostly without holding office. Their bank invented much of modern accounting and paid for most of what is now in the Uffizi.',
      },
      {
        kind: 'art',
        body: 'Botticelli, Leonardo, Michelangelo and Donatello all worked within a few streets. The David was carved from a block two other sculptors had already given up on.',
      },
      {
        kind: 'architecture',
        body: 'Brunelleschi’s dome was raised without scaffolding from below, using a herringbone brick pattern that holds itself as it goes. Nobody had built one that wide since Rome.',
      },
      {
        kind: 'cuisine',
        body: 'Bistecca alla fiorentina, served rare and sold by weight. Tuscan bread has no salt, which is why the local soups exist to soak it.',
      },
      {
        kind: 'festivals',
        body: 'Calcio Storico in June: a 16th-century game between the city’s four quarters, played in sand, with rules that permit almost anything.',
      },
      {
        kind: 'fact',
        body: 'The Ponte Vecchio has held shops since the 13th century. They were butchers until 1593, when a Medici duke — whose private corridor ran overhead — replaced them with goldsmiths over the smell.',
      },
      {
        kind: 'travel',
        body: 'The Uffizi and the Accademia sell timed tickets in advance. Without one the queue is measured in hours.',
      },
    ],
    palette: ['#B9873F', '#5A3A22'],
  },
  {
    slug: 'milano',
    name: 'Milan',
    epithet: 'Italy at work',
    lat: 45.4642,
    lon: 9.19,
    side: 'left',
    landmarks: ['The Duomo di Milano', 'The Galleria Vittorio Emanuele II'],
    lede: 'The country’s money, its fashion and its most ornate cathedral.',
    facets: [
      {
        kind: 'history',
        body: 'Capital of the Western Roman Empire before Rome was, and the city where Constantine’s edict made Christianity legal in 313.',
      },
      {
        kind: 'art',
        body: 'Leonardo’s Last Supper is painted on a refectory wall in a technique that began failing almost immediately. Twenty-five people at a time are let in, for fifteen minutes.',
      },
      {
        kind: 'architecture',
        body: 'The Duomo took nearly six centuries and carries 3,400 statues. You can walk on the roof, among the spires.',
      },
      {
        kind: 'cuisine',
        body: 'Risotto alla milanese, yellow with saffron, and cotoletta. Panettone is Milanese and is properly eaten over the whole of Christmas, not on the day.',
      },
      {
        kind: 'festivals',
        body: 'Fashion Week twice a year, and the Salone del Mobile each April, which turns the entire city into a design exhibition.',
      },
      {
        kind: 'fact',
        body: 'The Galleria’s mosaic floor has a bull with a hole worn through it, from the local custom of spinning on your heel there for luck.',
      },
      {
        kind: 'travel',
        body: 'Aperitivo here means a drink that comes with enough food to be dinner, from about six in the evening.',
      },
    ],
    palette: ['#8A8F76', '#3A3F30'],
  },
  {
    slug: 'napoli',
    name: 'Naples',
    epithet: 'Under the volcano',
    lat: 40.8518,
    lon: 14.2681,
    side: 'right',
    landmarks: ['Pompeii', 'Mount Vesuvius', 'The Naples Underground'],
    lede: 'Loud, ancient, and the birthplace of the pizza.',
    facets: [
      {
        kind: 'history',
        body: 'Greek before it was Roman — the name is Neápolis, "new city". Vesuvius buried Pompeii and Herculaneum in AD 79 and preserved them exactly.',
      },
      {
        kind: 'art',
        body: 'The Veiled Christ in the Sansevero Chapel is a single block of marble carved so that the shroud appears to be a separate, thinner material.',
      },
      {
        kind: 'architecture',
        body: 'A second city runs beneath this one: Greek quarries, Roman aqueducts and wartime shelters, forty metres down.',
      },
      {
        kind: 'cuisine',
        body: 'Pizza was invented here as street food for the poor. The margherita is said to be named for a queen, in the colours of the flag — tomato, mozzarella, basil.',
      },
      {
        kind: 'festivals',
        body: 'Three times a year the city gathers to watch a sealed vial of San Gennaro’s blood, and waits to see whether it liquefies.',
      },
      {
        kind: 'fact',
        body: 'Caffè sospeso — a "suspended coffee" — is one you pay for and leave behind at the bar for whoever next needs one. The custom started here.',
      },
      {
        kind: 'travel',
        body: 'Pompeii is half an hour by the Circumvesuviana. Go early: there is almost no shade on the site.',
      },
    ],
    palette: ['#A44A38', '#3E2320'],
  },
  {
    slug: 'pisa',
    name: 'Pisa',
    epithet: 'The tower that would not fall',
    lat: 43.7228,
    lon: 10.4017,
    side: 'left',
    nudge: { y: -2 },
    landmarks: ['The Leaning Tower', 'The Piazza dei Miracoli'],
    lede: 'A maritime republic remembered for a mistake in its foundations.',
    facets: [
      {
        kind: 'history',
        body: 'One of the four great maritime republics, with a fleet that reached the Levant, until Genoa broke its navy in 1284.',
      },
      {
        kind: 'architecture',
        body: 'The tower began leaning when the third floor went up, on soft ground three metres deep. Builders tried to correct it by curving the upper storeys — which is why it is slightly banana-shaped.',
      },
      {
        kind: 'fact',
        body: 'It was stabilised between 1993 and 2001 by removing soil from the high side. It now leans about four degrees, and is expected to stand for another three centuries.',
      },
      {
        kind: 'travel',
        body: 'Tower climbs are timed and capped at forty-five people. Book them; the piazza itself is free and the cathedral beside it is the better building.',
      },
    ],
    palette: ['#B8A57A', '#5F5238'],
  },
  {
    slug: 'verona',
    name: 'Verona',
    epithet: 'The city of the balcony',
    lat: 45.4384,
    lon: 10.9916,
    side: 'left',
    nudge: { y: 8 },
    landmarks: ['The Arena di Verona', 'Juliet’s House'],
    lede: 'A Roman arena that has been in use for two thousand years.',
    facets: [
      {
        kind: 'history',
        body: 'A Roman colony on the road north, walled by the Scaligeri in the Middle Ages and Venetian for four centuries after that.',
      },
      {
        kind: 'architecture',
        body: 'The Arena predates the Colosseum and still seats 15,000. Its acoustics are good enough that opera is performed there without amplification.',
      },
      {
        kind: 'festivals',
        body: 'The opera festival runs through the summer. The audience is handed candles at dusk, and the whole bowl lights up before the first note.',
      },
      {
        kind: 'fact',
        body: 'Juliet’s balcony was added in the 1930s to a house that had nothing to do with anyone in the play. Several thousand people a day photograph it.',
      },
      {
        kind: 'travel',
        body: 'Bring a cushion for the Arena’s stone steps, or rent one at the gate.',
      },
    ],
    palette: ['#9E5C48', '#432722'],
  },
  {
    slug: 'torino',
    name: 'Turin',
    epithet: 'Baroque and chocolate',
    lat: 45.0703,
    lon: 7.6869,
    side: 'left',
    landmarks: ['The Mole Antonelliana', 'The Egyptian Museum'],
    lede: 'The first capital of a united Italy, under the Alps.',
    facets: [
      {
        kind: 'history',
        body: 'The seat of the House of Savoy and Italy’s capital from 1861 to 1865, before the title moved to Florence and then Rome.',
      },
      {
        kind: 'art',
        body: 'Its Egyptian Museum is the oldest in the world and second in size only to Cairo’s.',
      },
      {
        kind: 'cuisine',
        body: 'Gianduja — chocolate cut with hazelnut — was invented here when Napoleon’s blockade made cocoa scarce. Bicerin is coffee, chocolate and cream in a glass, in that order, unstirred.',
      },
      {
        kind: 'fact',
        body: 'Eighteen kilometres of arcaded pavement mean you can cross much of the centre in the rain without an umbrella.',
      },
      {
        kind: 'travel',
        body: 'The Mole’s glass lift runs up the middle of the dome to a view of the whole Alpine arc.',
      },
    ],
    palette: ['#7C6A93', '#332B44'],
  },
  {
    slug: 'bologna',
    name: 'Bologna',
    epithet: 'La Grassa, La Dotta, La Rossa',
    lat: 44.4949,
    lon: 11.3426,
    side: 'right',
    landmarks: ['The Two Towers', 'The Portico di San Luca'],
    lede: 'The fat, the learned and the red: food, the oldest university, and brick.',
    facets: [
      {
        kind: 'history',
        body: 'Its university has taught continuously since 1088 and is the oldest in the world still running.',
      },
      {
        kind: 'architecture',
        body: 'Nearly forty kilometres of porticoes, built so the city could add upper storeys for students without narrowing the streets. They are now a World Heritage site.',
      },
      {
        kind: 'cuisine',
        body: 'Tagliatelle al ragù — never spaghetti, and never called bolognese here. Tortellini are meant to be eaten in broth.',
      },
      {
        kind: 'fact',
        body: 'The official width of a tagliatella is registered in gold at the chamber of commerce: eight millimetres, cooked.',
      },
      {
        kind: 'travel',
        body: 'The portico to San Luca is 3.8km and 666 arches uphill, and is the best hour you can spend here.',
      },
    ],
    palette: ['#A65A3C', '#472317'],
  },
  {
    slug: 'siena',
    name: 'Siena',
    epithet: 'The shell-shaped square',
    lat: 43.3188,
    lon: 11.3308,
    side: 'right',
    nudge: { y: 12 },
    landmarks: ['The Piazza del Campo', 'The Torre del Mangia'],
    lede: 'A medieval city that stopped growing in 1348 and never restarted.',
    facets: [
      {
        kind: 'history',
        body: 'Florence’s great rival until the Black Death took perhaps half its people. What was left is a 14th-century city, largely intact.',
      },
      {
        kind: 'architecture',
        body: 'The Campo slopes like a shell, divided into nine parts for the nine merchants who governed. The cathedral is banded in black and white marble, the city’s colours.',
      },
      {
        kind: 'festivals',
        body: 'The Palio, twice each summer: seventeen contrade, ten horses, three laps of the Campo, and a year of feeling about it either way.',
      },
      {
        kind: 'fact',
        body: 'A horse can win the Palio without its rider. It happens often enough to have a name — cavallo scosso.',
      },
      {
        kind: 'travel',
        body: 'The Campo is where everyone sits on the paving in the late afternoon. Join them; nobody minds.',
      },
    ],
    palette: ['#C08A46', '#5B3A1C'],
  },
  {
    slug: 'palermo',
    name: 'Palermo',
    epithet: 'Sicily, layered',
    lat: 38.1157,
    lon: 13.3615,
    side: 'right',
    landmarks: [
      'The Cappella Palatina',
      'The Ballarò market',
      'The Valley of the Temples, at Agrigento',
    ],
    lede: 'Phoenician, Greek, Arab, Norman and Spanish, all still visible.',
    facets: [
      {
        kind: 'history',
        body: 'Under Norman kings in the 12th century it was one of Europe’s richest cities, governed in three languages at once.',
      },
      {
        kind: 'architecture',
        body: 'The Cappella Palatina has Islamic muqarnas on the ceiling, Byzantine mosaics on the walls and a Norman king’s throne beneath. Nobody built like that before or since.',
      },
      {
        kind: 'cuisine',
        body: 'The best street food in Italy: arancine, panelle, sfincione. Cannoli are filled to order, or the shell goes soft.',
      },
      {
        kind: 'fact',
        body: 'The Valley of the Temples, two hours south, holds Greek temples better preserved than most in Greece.',
      },
      {
        kind: 'travel',
        body: 'The markets — Ballarò, Vucciria, Capo — are loudest and best before noon.',
      },
    ],
    palette: ['#C98B3A', '#4E3218'],
  },
  {
    slug: 'genova',
    name: 'Genoa',
    epithet: 'La Superba',
    lat: 44.4056,
    lon: 8.9463,
    side: 'left',
    landmarks: ['The Via Garibaldi palaces', 'The old port'],
    lede: 'A republic that ran the Mediterranean, folded into a hillside.',
    facets: [
      {
        kind: 'history',
        body: 'A maritime republic and a banking power; its Banco di San Giorgio, founded in 1407, was among the first modern banks. Columbus was born here.',
      },
      {
        kind: 'architecture',
        body: 'The old town has some of the densest medieval street plan in Europe — caruggi so narrow that daylight reaches the ground only at noon.',
      },
      {
        kind: 'cuisine',
        body: 'Pesto is Genoese and is properly made in a marble mortar. Focaccia here is eaten at breakfast, dipped in cappuccino.',
      },
      {
        kind: 'fact',
        body: 'Forty-two of its palaces are a World Heritage site: a register of grand houses that took turns hosting visiting heads of state.',
      },
      {
        kind: 'travel',
        body: 'Public lifts and funiculars count as city transport and climb the hill for the price of a bus ticket.',
      },
    ],
    palette: ['#4E7A78', '#20393B'],
  },
  {
    slug: 'cinque-terre',
    name: 'Cinque Terre',
    epithet: 'Five villages on a cliff',
    lat: 44.1461,
    lon: 9.6543,
    side: 'left',
    nudge: { y: 16 },
    landmarks: ['Vernazza', 'Manarola', 'The Sentiero Azzurro'],
    lede: 'Painted houses stacked above the sea, held up by dry stone.',
    facets: [
      {
        kind: 'history',
        body: 'Farmed since the 11th century on terraces cut into the cliff. The dry-stone walls that hold them up run to nearly 7,000km — comparable to the Great Wall.',
      },
      {
        kind: 'architecture',
        body: 'The houses are painted in strong colours so that fishermen could pick out their own from the water.',
      },
      {
        kind: 'cuisine',
        body: 'Anchovies from Monterosso, salted; and Sciacchetrà, a sweet wine from grapes dried on the terraces.',
      },
      {
        kind: 'fact',
        body: 'There is no coast road between the villages. They are joined by a railway in a tunnel, by boat, and on foot.',
      },
      {
        kind: 'travel',
        body: 'The coastal path needs a card and closes in bad weather. The higher paths are free and quieter.',
      },
    ],
    palette: ['#D08A4E', '#3E5A62'],
  },
  {
    slug: 'costiera-amalfitana',
    name: 'Amalfi Coast',
    epithet: 'The Divine Coast',
    lat: 40.634,
    lon: 14.6027,
    side: 'right',
    nudge: { y: 28 },
    landmarks: ['Positano', 'Ravello', 'The Blue Grotto, on Capri'],
    lede: 'Fifty kilometres of cliff with towns wedged into it.',
    facets: [
      {
        kind: 'history',
        body: 'Amalfi was the first of the maritime republics and wrote a maritime code used across the Mediterranean for centuries.',
      },
      {
        kind: 'architecture',
        body: 'Positano is built in tiers down a ravine; you arrive at the top and walk down to the sea through it.',
      },
      {
        kind: 'cuisine',
        body: 'Lemons the size of a fist, grown on terraces under chestnut pergolas, and limoncello made from their skins alone.',
      },
      {
        kind: 'fact',
        body: 'The Blue Grotto on Capri glows because sunlight enters through a second opening below the waterline, and the water filters out everything but blue.',
      },
      {
        kind: 'travel',
        body: 'The coast road is one lane of hairpins in each direction. The ferry is faster, cheaper and better to look at.',
      },
    ],
    palette: ['#2F7E9B', '#1B3F55'],
  },
  {
    slug: 'lago-di-como',
    name: 'Lake Como',
    epithet: 'Villas and water',
    lat: 45.9852,
    lon: 9.2578,
    side: 'right',
    nudge: { y: -14 },
    landmarks: ['Villa del Balbianello', 'Bellagio', 'Varenna'],
    lede: 'A glacial lake shaped like an inverted Y, under the Alps.',
    facets: [
      {
        kind: 'history',
        body: 'Roman senators built here for the summer. Pliny the Younger had two villas on the lake and wrote about which he preferred.',
      },
      {
        kind: 'architecture',
        body: 'The villas are the point: Balbianello on its promontory, Carlotta with its terraced gardens, both open to the public.',
      },
      {
        kind: 'fact',
        body: 'At more than 400 metres it is one of the deepest lakes in Europe — its floor is well below sea level.',
      },
      {
        kind: 'travel',
        body: 'Cross by ferry rather than driving round. Bellagio to Varenna takes fifteen minutes and is the best view of the lake there is.',
      },
    ],
    palette: ['#3F6E63', '#1B3630'],
  },
  {
    slug: 'dolomiti',
    name: 'The Dolomites',
    epithet: 'The pale mountains',
    lat: 46.4102,
    lon: 11.8441,
    side: 'right',
    nudge: { y: -10 },
    landmarks: ['Tre Cime di Lavaredo', 'The Alpe di Siusi'],
    lede: 'Vertical limestone towers that turn pink at sunset.',
    facets: [
      {
        kind: 'history',
        body: 'The front line ran through these peaks in the First World War. Tunnels and galleries cut into the rock are now walking routes.',
      },
      {
        kind: 'fact',
        body: 'The enrosadira — the alpenglow that turns the rock rose and violet at dawn and dusk — comes from the dolomite itself, the mineral the range is named after.',
      },
      {
        kind: 'cuisine',
        body: 'Half Austrian: canederli, speck and strudel. Much of the region speaks German first, and some valleys speak Ladin.',
      },
      {
        kind: 'travel',
        body: 'Rifugi — mountain huts — serve lunch and let rooms, so a walk across the range needs no tent.',
      },
    ],
    palette: ['#8E93A8', '#333A4C'],
  },
];

export type PlacedPlace = Place & { x: number; y: number };

/**
 * Positions resolved once, at module load. Nothing downstream needs to know
 * that a place has a latitude.
 */
export const PLACES: readonly PlacedPlace[] = PLACES_RAW.map((place) => {
  const { x, y } = project(place.lat, place.lon);
  return {
    ...place,
    x: x + (place.nudge?.x ?? 0),
    y: y + (place.nudge?.y ?? 0),
  };
});

export const FACET_LABELS: Record<FacetKind, string> = {
  history: 'History',
  art: 'Art & Culture',
  architecture: 'Architecture',
  cuisine: 'Local Cuisine',
  festivals: 'Festivals',
  fact: 'Fun Fact',
  travel: 'Travel Tip',
};
