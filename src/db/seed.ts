import type { Category, Item, Photo } from '../types';

/**
 * Contenus de départ : des inspirations proposées pour commencer.
 * Aucun prix marchand, aucune possession ni information personnelle n'est inventé.
 * Chaque identifiant est stable : un exemple supprimé n'est jamais réinjecté.
 */

export const SEED_CATEGORIES: Category[] = [
  { id: 'cat-deco-salon', section: 'deco', name: 'Salon', order: 1 },
  { id: 'cat-deco-chambre', section: 'deco', name: 'Chambre', order: 2 },
  { id: 'cat-deco-cuisine', section: 'deco', name: 'Cuisine', order: 3 },
  { id: 'cat-deco-sdb', section: 'deco', name: 'Salle de bain', order: 4 },
  { id: 'cat-deco-exterieur', section: 'deco', name: 'Extérieur', order: 5 },
  { id: 'cat-deco-details', section: 'deco', name: 'Détails déco', order: 6 },

  { id: 'cat-dress-hauts', section: 'dressing', name: 'Hauts', order: 1 },
  { id: 'cat-dress-mailles', section: 'dressing', name: 'Mailles', order: 2 },
  { id: 'cat-dress-bas', section: 'dressing', name: 'Bas', order: 3 },
  { id: 'cat-dress-robes', section: 'dressing', name: 'Robes', order: 4 },
  { id: 'cat-dress-vestes', section: 'dressing', name: 'Manteaux & vestes', order: 5 },
  { id: 'cat-dress-chaussures', section: 'dressing', name: 'Chaussures', order: 6 },
  { id: 'cat-dress-accessoires', section: 'dressing', name: 'Sacs & accessoires', order: 7 },

  { id: 'cat-classe-inspirations', section: 'classe', name: 'Inspirations de classes', order: 1 },
  { id: 'cat-classe-amenagement', section: 'classe', name: 'Aménagement et organisation', order: 2 },
  { id: 'cat-classe-affichages', section: 'classe', name: 'Affichages pédagogiques', order: 3 },
  { id: 'cat-classe-activites', section: 'classe', name: 'Idées d’activités', order: 4 },
  { id: 'cat-classe-ecoles', section: 'classe', name: 'Écoles inspirantes', order: 5 },
  { id: 'cat-classe-objectifs', section: 'classe', name: 'Objectifs professionnels', order: 6 },
  { id: 'cat-classe-future', section: 'classe', name: 'Ma future classe', order: 7 },
];

const img = (key: string): Photo[] => [{ id: `p-${key}`, kind: 'seed', ref: key }];

type Partial0 = Partial<Item> & Pick<Item, 'id' | 'type' | 'title'>;

function make(p: Partial0): Item {
  return {
    universe: 'cocon',
    zone: '',
    x: 0,
    y: 0,
    description: '',
    notes: '',
    tags: [],
    favorite: false,
    photos: [],
    links: [],
    categoryId: null,
    price: null,
    seed: true,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  };
}

/** Disposition en grille à l'intérieur d'une zone. */
function grid(startX: number, startY: number, cols: number, dx: number, dy: number) {
  return (i: number) => ({
    x: startX + (i % cols) * dx + ((Math.floor(i / cols) % 2) * dx) / 6,
    y: startY + Math.floor(i / cols) * dy,
  });
}

// ---------------------------------------------------------------- Décoration
const decoPos = grid(130, 270, 5, 285, 330);
const DECO: Item[] = [
  {
    key: 'deco-salon-boheme',
    title: 'Salon bohème lumineux',
    description: 'Matières naturelles, coussins moelleux, plantes et lumière douce.',
    cat: 'cat-deco-salon',
    tags: ['bohème', 'plantes', 'lin'],
  },
  {
    key: 'deco-salon-provencal',
    title: 'Salon de maison provençale',
    description: 'Murs chaulés, poutres, tomettes et meubles chinés : le charme d’une maison qui a une histoire.',
    cat: 'cat-deco-salon',
    tags: ['provençal', 'ancien'],
  },
  {
    key: 'deco-coin-lecture',
    title: 'Coin lecture près de la fenêtre',
    description: 'Un fauteuil enveloppant, un plaid, une petite lampe : l’endroit pour ralentir.',
    cat: 'cat-deco-salon',
    tags: ['cosy', 'lecture'],
  },
  {
    key: 'deco-chambre-lin',
    title: 'Chambre en lin naturel',
    description: 'Linge de lit froissé, tons crème et sable, peu d’objets et beaucoup de calme.',
    cat: 'cat-deco-chambre',
    tags: ['lin', 'minimaliste', 'crème'],
  },
  {
    key: 'deco-chambre-campagne',
    title: 'Chambre de maison de campagne',
    description: 'Tête de lit ancienne, tissus fleuris discrets et bois clair.',
    cat: 'cat-deco-chambre',
    tags: ['campagne', 'romantique'],
  },
  {
    key: 'deco-cuisine-provencale',
    title: 'Cuisine provençale',
    description: 'Faïence, carreaux, bois patiné et vaisselle à portée de main.',
    cat: 'cat-deco-cuisine',
    tags: ['provençal', 'carreaux'],
  },
  {
    key: 'deco-cuisine-famille',
    title: 'Cuisine de maison de famille',
    description: 'Une grande table en bois, des étagères ouvertes, une cuisine où l’on a envie de rester.',
    cat: 'cat-deco-cuisine',
    tags: ['bois', 'convivial'],
  },
  {
    key: 'deco-sdb',
    title: 'Salle de bain à l’ancienne',
    description: 'Baignoire sur pieds, tons doux et confort moderne.',
    cat: 'cat-deco-sdb',
    tags: ['baignoire', 'rétro'],
  },
  {
    key: 'deco-terrasse',
    title: 'Terrasse ombragée',
    description: 'Repas dehors à l’ombre d’une treille ou d’une pergola.',
    cat: 'cat-deco-exterieur',
    tags: ['extérieur', 'été'],
  },
  {
    key: 'deco-mas-lavande',
    title: 'Mas et lavande',
    description: 'Pierres claires, volets colorés et jardin parfumé.',
    cat: 'cat-deco-exterieur',
    tags: ['provençal', 'jardin'],
  },
  {
    key: 'deco-fleurs-sechees',
    title: 'Bouquets et fleurs séchées',
    description: 'Des bouquets simples dans des vases dépareillés.',
    cat: 'cat-deco-details',
    tags: ['fleurs', 'détails'],
  },
  {
    key: 'deco-tissus',
    title: 'Tissus provençaux',
    description: 'Imprimés traditionnels pour nappes, coussins ou rideaux.',
    cat: 'cat-deco-details',
    tags: ['tissus', 'provençal'],
  },
].map((d, i) =>
  make({
    id: `seed-${d.key}`,
    type: 'deco',
    universe: 'cocon',
    zone: 'deco',
    ...decoPos(i),
    title: d.title,
    description: d.description,
    categoryId: d.cat,
    tags: d.tags,
    photos: img(d.key),
    decoStatus: 'inspiration',
  }),
);

// ---------------------------------------------------------------- Dressing
const dressPos = grid(1750, 270, 4, 215, 290);
const DRESS: Item[] = [
  { key: 'dress-chemise-lin', title: 'Chemise en lin', cat: 'cat-dress-hauts', color: 'Blanc cassé', season: 'Printemps-été' },
  { key: 'dress-tshirt', title: 'T-shirt blanc essentiel', cat: 'cat-dress-hauts', color: 'Blanc', season: 'Toutes saisons' },
  { key: 'dress-cardigan', title: 'Cardigan doux', cat: 'cat-dress-mailles', color: 'Rose poudré', season: 'Mi-saison' },
  { key: 'dress-pull', title: 'Pull en maille', cat: 'cat-dress-mailles', color: 'Crème', season: 'Automne-hiver' },
  { key: 'dress-jean', title: 'Jean droit', cat: 'cat-dress-bas', color: 'Bleu clair', season: 'Toutes saisons' },
  { key: 'dress-jupe-midi', title: 'Jupe plissée midi', cat: 'cat-dress-bas', color: 'Sauge', season: 'Mi-saison' },
  { key: 'dress-robe-fleurie', title: 'Robe fleurie', cat: 'cat-dress-robes', color: 'Lilas', season: 'Printemps-été' },
  { key: 'dress-trench', title: 'Trench', cat: 'cat-dress-vestes', color: 'Beige', season: 'Mi-saison' },
  { key: 'dress-ballerines', title: 'Ballerines', cat: 'cat-dress-chaussures', color: 'Nude', season: 'Printemps-été' },
  { key: 'dress-baskets', title: 'Baskets blanches', cat: 'cat-dress-chaussures', color: 'Blanc', season: 'Toutes saisons' },
  { key: 'dress-panier', title: 'Panier en paille', cat: 'cat-dress-accessoires', color: 'Naturel', season: 'Printemps-été' },
  { key: 'dress-foulard', title: 'Foulard en soie', cat: 'cat-dress-accessoires', color: 'Bleu ciel', season: 'Toutes saisons' },
].map((d, i) =>
  make({
    id: `seed-${d.key}`,
    type: 'vetement',
    universe: 'cocon',
    zone: 'dressing',
    ...dressPos(i),
    title: d.title,
    categoryId: d.cat,
    color: d.color,
    season: d.season,
    photos: img(d.key),
    vetementStatus: 'envie',
    notes: 'Inspiration de départ : à garder, modifier ou supprimer.',
  }),
);

const TENUE = make({
  id: 'seed-tenue-printemps',
  type: 'tenue',
  universe: 'cocon',
  zone: 'tenues',
  x: 1770,
  y: 1530,
  title: 'Exemple de tenue douce',
  occasion: 'Balade de printemps',
  notes: 'Exemple de composition à partir des inspirations du dressing. Modifiez-la librement.',
  itemIds: ['seed-dress-chemise-lin', 'seed-dress-jupe-midi', 'seed-dress-ballerines', 'seed-dress-panier'],
});

const CAPSULE = make({
  id: 'seed-capsule-pastel',
  type: 'capsule',
  universe: 'cocon',
  zone: 'tenues',
  x: 2080,
  y: 1540,
  title: 'Exemple de capsule pastel',
  description: 'Quelques pièces qui se marient toutes entre elles.',
  itemIds: [
    'seed-dress-tshirt',
    'seed-dress-cardigan',
    'seed-dress-jean',
    'seed-dress-jupe-midi',
    'seed-dress-trench',
    'seed-dress-baskets',
  ],
});

const NOTES_COCON: Item[] = [
  make({
    id: 'seed-note-bienvenue-cocon',
    type: 'note',
    universe: 'cocon',
    zone: 'notes-cocon',
    x: 150,
    y: 1530,
    title: 'Bienvenue dans ton cocon',
    notes:
      'Glisse un doigt pour te promener, pince pour zoomer. Touche une carte pour l’ouvrir, appuie longuement pour la déplacer. Le bouton + ajoute une idée dans la zone où tu te trouves.',
    noteColor: 'cream',
  }),
  make({
    id: 'seed-note-envies-cocon',
    type: 'note',
    universe: 'cocon',
    zone: 'notes-cocon',
    x: 440,
    y: 1560,
    title: 'Ce que j’aime',
    notes: 'Lumière naturelle, matières douces, objets qui ont une histoire…',
    noteColor: 'sage',
  }),
];

// ---------------------------------------------------------------- Maîtresse
const classePos = grid(130, 270, 6, 260, 330);
const CLASSE: Item[] = [
  {
    key: 'classe-coin-lecture',
    title: 'Un coin lecture accueillant',
    description: 'Tapis, coussins, bacs d’albums rangés face visible : un espace où l’on a envie de lire.',
    cat: 'cat-classe-inspirations',
    tags: ['lecture', 'coin calme'],
  },
  {
    key: 'classe-americaine',
    title: 'Classe colorée à l’américaine',
    description: 'Murs très habillés mais organisés par zones, couleurs repères et coins bien identifiés.',
    cat: 'cat-classe-inspirations',
    tags: ['couleurs', 'organisation'],
  },
  {
    key: 'classe-rangements',
    title: 'Rangements étiquetés',
    description: 'Bacs et casiers de couleur, étiquettes avec mot et image pour l’autonomie des élèves.',
    cat: 'cat-classe-amenagement',
    tags: ['rangement', 'autonomie'],
  },
  {
    key: 'classe-ilots',
    title: 'Tables en îlots',
    description: 'Des îlots pour travailler en groupe et un espace regroupement près du tableau.',
    cat: 'cat-classe-amenagement',
    tags: ['aménagement', 'coopération'],
  },
  {
    key: 'classe-affichages',
    title: 'Affichages structurés',
    description: 'Un tableau d’affichage par domaine, des titres lisibles et des fonds unis pour garder une vue claire.',
    cat: 'cat-classe-affichages',
    tags: ['affichage', 'repères'],
  },
  {
    key: 'classe-calendrier',
    title: 'Rituels et repères du quotidien',
    description: 'Calendrier, météo, alphabet et frise numérique à hauteur d’enfant.',
    cat: 'cat-classe-affichages',
    tags: ['rituels', 'affichage'],
  },
  {
    key: 'classe-ecole',
    title: 'Une école qui donne envie',
    description: 'Bâtiment lumineux, cour arborée : garder en tête ce qui rend une école chaleureuse.',
    cat: 'cat-classe-ecoles',
    tags: ['école', 'inspiration'],
  },
  {
    key: 'classe-materiel',
    title: 'Matériel coloré bien rangé',
    description: 'Crayons triés par couleur dans des pots : pratique et joyeux.',
    cat: 'cat-classe-amenagement',
    tags: ['matériel', 'couleurs'],
  },
].map((d, i) =>
  make({
    id: `seed-${d.key}`,
    type: 'classe',
    format: 'fiche',
    universe: 'horizons',
    zone: 'classe',
    ...classePos(i),
    title: d.title,
    description: d.description,
    categoryId: d.cat,
    tags: d.tags,
    photos: img(d.key),
  }),
);

const ACTIVITES: Item[] = [
  make({
    id: 'seed-activite-album',
    type: 'classe',
    format: 'activite',
    universe: 'horizons',
    zone: 'classe',
    x: 720,
    y: 620,
    title: 'Atelier autour d’un album',
    description: 'Lire un album à voix haute puis imaginer une suite ou une autre fin.',
    categoryId: 'cat-classe-activites',
    level: 'CP – CE1',
    materials: 'Un album de jeunesse, grandes feuilles, crayons de couleur',
    steps: [
      'Lecture offerte de l’album',
      'Discussion : ce qu’on a aimé, ce qu’on a compris',
      'Dessiner et dicter (ou écrire) une nouvelle fin',
      'Présenter son travail au groupe',
    ],
    tags: ['lecture', 'écriture'],
    photos: img('classe-albums'),
  }),
  make({
    id: 'seed-activite-jardin',
    type: 'classe',
    format: 'activite',
    universe: 'horizons',
    zone: 'classe',
    x: 1000,
    y: 650,
    title: 'Jardin de classe',
    description: 'Semer, observer, mesurer la pousse et tenir un carnet d’observation.',
    categoryId: 'cat-classe-activites',
    level: 'Maternelle – CE2',
    materials: 'Graines, terreau, pots ou bac, étiquettes, carnet',
    steps: ['Préparer les pots et semer', 'Arroser à tour de rôle', 'Dessiner les étapes de la pousse chaque semaine'],
    tags: ['sciences', 'nature'],
    photos: img('classe-jardin'),
  }),
];

const OBJECTIFS: Item[] = [
  make({
    id: 'seed-objectif-rentree',
    type: 'classe',
    format: 'objectif',
    universe: 'horizons',
    zone: 'objectifs',
    x: 140,
    y: 1470,
    title: 'Préparer ma future rentrée',
    description: 'Une liste pour avancer sereinement, à adapter.',
    categoryId: 'cat-classe-objectifs',
    projetStatus: 'idee',
    checklist: [
      { id: 'c1', text: 'Imaginer le plan de la classe', done: false },
      { id: 'c2', text: 'Préparer les étiquettes des rangements', done: false },
      { id: 'c3', text: 'Choisir les premiers albums', done: false },
      { id: 'c4', text: 'Préparer le mot de bienvenue', done: false },
    ],
  }),
  make({
    id: 'seed-objectif-coin-lecture',
    type: 'classe',
    format: 'objectif',
    universe: 'horizons',
    zone: 'objectifs',
    x: 440,
    y: 1560,
    title: 'Créer un vrai coin lecture',
    categoryId: 'cat-classe-objectifs',
    projetStatus: 'idee',
    checklist: [
      { id: 'c1', text: 'Lister les albums indispensables', done: false },
      { id: 'c2', text: 'Trouver un tapis et des coussins', done: false },
      { id: 'c3', text: 'Prévoir un bac « coups de cœur »', done: false },
    ],
  }),
];

const ENVIES: Item[] = [
  { title: 'Tapis de regroupement', priority: 'haute' as const },
  { title: 'Bibliothèque basse à présentoir', priority: 'haute' as const },
  { title: 'Bacs de rangement colorés', priority: 'moyenne' as const },
  { title: 'Guirlande et lumière douce pour le coin calme', priority: 'basse' as const },
].map((e, i) =>
  make({
    id: `seed-envie-${i + 1}`,
    type: 'classe',
    format: 'envie',
    universe: 'horizons',
    zone: 'future-classe',
    x: 970 + (i % 3) * 245,
    y: 1470 + Math.floor(i / 3) * 190,
    title: e.title,
    categoryId: 'cat-classe-future',
    priority: e.priority,
  }),
);

const NOTES_HORIZONS: Item[] = [
  make({
    id: 'seed-note-bienvenue-horizons',
    type: 'note',
    universe: 'horizons',
    zone: 'notes-horizons',
    x: 1850,
    y: 1740,
    title: 'Bienvenue dans tes horizons',
    notes:
      'Ici, tes rêves de classe et de voyages. Les destinations proposées sont de simples suggestions : change-les, complète-les ou supprime-les.',
    noteColor: 'yellow',
  }),
];

// ---------------------------------------------------------------- Voyages (suggestions)
const destPos = grid(1850, 480, 3, 300, 330);
const DESTS: Item[] = [
  {
    key: 'dest-lisbonne',
    title: 'Lisbonne',
    country: 'Portugal',
    lat: 38.7223,
    lng: -9.1393,
    desc: 'Tramways jaunes, azulejos et points de vue sur le Tage.',
    todo: ['Monter en tram dans l’Alfama', 'Voir les azulejos', 'Coucher de soleil depuis un miradouro'],
  },
  {
    key: 'dest-santorin',
    title: 'Santorin',
    country: 'Grèce',
    lat: 36.4618,
    lng: 25.3753,
    desc: 'Maisons blanches, dômes bleus et falaises sur la mer.',
    todo: ['Se promener à Oia', 'Se baigner sur une plage de sable noir'],
  },
  {
    key: 'dest-kyoto',
    title: 'Kyoto',
    country: 'Japon',
    lat: 35.0116,
    lng: 135.7681,
    desc: 'Temples, jardins et ruelles traditionnelles.',
    todo: ['Parcourir les torii de Fushimi Inari', 'Visiter un jardin zen'],
  },
  {
    key: 'dest-marrakech',
    title: 'Marrakech',
    country: 'Maroc',
    lat: 31.6295,
    lng: -7.9811,
    desc: 'Jardins colorés, souks et riads.',
    todo: ['Visiter le jardin Majorelle', 'Flâner dans les souks'],
  },
  {
    key: 'dest-copenhague',
    title: 'Copenhague',
    country: 'Danemark',
    lat: 55.6761,
    lng: 12.5683,
    desc: 'Façades colorées, vélos et art de vivre scandinave.',
    todo: ['Se promener à Nyhavn', 'Louer un vélo'],
  },
  {
    key: 'dest-quebec',
    title: 'Québec',
    country: 'Canada',
    lat: 46.8139,
    lng: -71.208,
    desc: 'Vieille ville fortifiée, ruelles et couleurs d’automne.',
    todo: ['Se promener dans le Vieux-Québec', 'Admirer le Château Frontenac'],
  },
].map((d, i) =>
  make({
    id: `seed-${d.key}`,
    type: 'destination',
    universe: 'horizons',
    zone: 'voyages',
    ...destPos(i),
    title: d.title,
    country: d.country,
    lat: d.lat,
    lng: d.lng,
    description: d.desc,
    notes: 'Suggestion de départ : ce n’est pas un voyage prévu. À modifier ou supprimer.',
    photos: img(d.key),
    travelStatus: 'a-decouvrir',
    suggestion: true,
    period: '',
    checklist: d.todo.map((t, j) => ({ id: `t${j}`, text: t, done: false })),
    budget: [
      { id: 'b1', poste: 'Transport', montant: null },
      { id: 'b2', poste: 'Hébergement', montant: null },
      { id: 'b3', poste: 'Repas', montant: null },
      { id: 'b4', poste: 'Activités', montant: null },
    ],
    expenses: [],
  }),
);

export const SEED_ITEMS: Item[] = [
  ...DECO,
  ...DRESS,
  TENUE,
  CAPSULE,
  ...NOTES_COCON,
  ...CLASSE,
  ...ACTIVITES,
  ...OBJECTIFS,
  ...ENVIES,
  ...NOTES_HORIZONS,
  ...DESTS,
];
