// Shared constants and helpers. The importer worker imports this file too.

export const CATEGORIES: { slug: string; label: string; blurb: string }[] = [
  { slug: 'restaurants', label: 'Restaurants & food', blurb: 'Restaurants, cafés, bars that serve food and caterers, with state inspection history.' },
  { slug: 'food-trucks', label: 'Food trucks', blurb: 'Licensed mobile food vehicles that operate in Broward.' },
  { slug: 'auto', label: 'Auto services', blurb: 'Repair, tint, detailing, wraps, tires and car washes.' },
  { slug: 'home-services', label: 'Home services', blurb: 'Roofers, plumbers, HVAC, electricians, pool and lawn care.' },
  { slug: 'beauty', label: 'Beauty & barber', blurb: 'Salons, barbershops, nails, lashes and spas.' },
  { slug: 'health', label: 'Health & wellness', blurb: 'Clinics, dentists, chiropractors, therapy and med spas.' },
  { slug: 'fitness', label: 'Fitness', blurb: 'Gyms, studios, trainers and martial arts.' },
  { slug: 'professional', label: 'Professional services', blurb: 'Law, accounting, insurance, marketing and consulting.' },
  { slug: 'retail', label: 'Shops & retail', blurb: 'Boutiques, specialty stores and local makers.' },
  { slug: 'real-estate', label: 'Real estate', blurb: 'Agents, brokerages, property management and title.' },
  { slug: 'pets', label: 'Pets', blurb: 'Vets, groomers, boarding and pet supply.' },
  { slug: 'events', label: 'Events & venues', blurb: 'Venues, DJs, photographers, rentals and planners.' },
  { slug: 'education', label: 'Education & childcare', blurb: 'Tutoring, daycare, schools and classes.' },
  { slug: 'hotels', label: 'Hotels & lodging', blurb: 'Hotels, motels and inns.' },
  { slug: 'other', label: 'Other local businesses', blurb: 'Everything else that serves Broward customers.' },
];
export const categoryLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.label ?? 'Local business';

export const CITY_NAMES: Record<string, string> = {
  'coconut-creek': 'Coconut Creek', 'cooper-city': 'Cooper City', 'coral-springs': 'Coral Springs', 'dania-beach': 'Dania Beach',
  davie: 'Davie', 'deerfield-beach': 'Deerfield Beach', 'fort-lauderdale': 'Fort Lauderdale', 'hallandale-beach': 'Hallandale Beach',
  'hillsboro-beach': 'Hillsboro Beach', hollywood: 'Hollywood', 'lauderdale-by-the-sea': 'Lauderdale-By-The-Sea', 'lauderdale-lakes': 'Lauderdale Lakes',
  lauderhill: 'Lauderhill', 'lazy-lake': 'Lazy Lake', 'lighthouse-point': 'Lighthouse Point', margate: 'Margate', miramar: 'Miramar',
  'north-lauderdale': 'North Lauderdale', 'oakland-park': 'Oakland Park', parkland: 'Parkland', 'pembroke-park': 'Pembroke Park',
  'pembroke-pines': 'Pembroke Pines', plantation: 'Plantation', 'pompano-beach': 'Pompano Beach', 'sea-ranch-lakes': 'Sea Ranch Lakes',
  'southwest-ranches': 'Southwest Ranches', sunrise: 'Sunrise', tamarac: 'Tamarac', 'west-park': 'West Park', weston: 'Weston',
  'wilton-manors': 'Wilton Manors',
};

// Spellings that show up in state records, mapped to the city slug.
const CITY_ALIASES: Record<string, string> = {
  'FT LAUDERDALE': 'fort-lauderdale', 'FT. LAUDERDALE': 'fort-lauderdale', 'FORT LAUDERDALE': 'fort-lauderdale',
  'LAUDERDALE BY THE SEA': 'lauderdale-by-the-sea', 'LAUD BY THE SEA': 'lauderdale-by-the-sea', 'LAUDERDALE-BY-THE-SEA': 'lauderdale-by-the-sea',
  'N LAUDERDALE': 'north-lauderdale', 'NORTH LAUDERDALE': 'north-lauderdale', 'HALLANDALE': 'hallandale-beach',
  'POMPANO BCH': 'pompano-beach', 'POMPANO': 'pompano-beach', 'DEERFIELD BCH': 'deerfield-beach', 'DEERFIELD': 'deerfield-beach',
  'DANIA': 'dania-beach', 'PEMBROKE PNES': 'pembroke-pines', 'SW RANCHES': 'southwest-ranches', 'LIGHTHOUSE PT': 'lighthouse-point',
  'CORAL SPGS': 'coral-springs', 'OAKLAND PK': 'oakland-park',
};

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Map a city as written in a record to a known Broward city. Unknown cities keep their own slug. */
export function normalizeCity(raw: string | null | undefined): { name: string; slug: string } | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!up) return null;
  const alias = CITY_ALIASES[up];
  if (alias) return { slug: alias, name: CITY_NAMES[alias] };
  const s = slugify(up);
  if (CITY_NAMES[s]) return { slug: s, name: CITY_NAMES[s] };
  return { slug: s, name: titleCase(up) };
}

const KEEP_UPPER = new Set(['LLC', 'INC', 'II', 'III', 'IV', 'USA', 'BBQ', 'NY', 'FL', 'USA', 'KFC', 'IHOP', 'TGI', 'CVS', 'DBA', 'PA', 'LLP', 'CPA', 'MD', 'DDS', 'SW', 'NW', 'NE', 'SE', 'N', 'S', 'E', 'W']);
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w) => {
      const up = w.toUpperCase().replace(/[^A-Z]/g, '');
      if (KEEP_UPPER.has(up) && up.length > 0 && w.replace(/[^a-z]/gi, '').length === up.length) return w.toUpperCase();
      if (/^\d+(st|nd|rd|th)$/i.test(w)) return w.toLowerCase(); // 1st, 64th
      if (/\d/.test(w) && /[a-z]/i.test(w)) return w.toUpperCase(); // A1A, I95
      if (/^mc[a-z]/.test(w)) return 'Mc' + w.charAt(2).toUpperCase() + w.slice(3);
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('')
    .replace(/'S\b/g, "'s");
}

export type Tone = 'ok' | 'warn' | 'alert' | 'neutral';
/** Tone for an inspection disposition. The words shown are always the state's own. */
export function dispositionTone(disposition: string | null | undefined): Tone {
  const d = (disposition ?? '').toUpperCase();
  if (!d) return 'neutral';
  if (d.includes('EMERGENCY ORDER')) {
    if (d.includes('NOT COMPLIED')) return 'alert';
    if (d.includes('COMPLIED')) return 'warn';
    return 'alert';
  }
  if (d.includes('NOT COMPLIED')) return 'warn';
  if (d.includes('WARNING') || d.includes('ADMINISTRATIVE COMPLAINT') || d.includes('TIME EXTENSION') || d.includes('CALLBACK') || d.includes('CALL BACK')) {
    if (d.includes('COMPLIED') && !d.includes('NOT COMPLIED')) return 'ok';
    return 'warn';
  }
  if (d.includes('NO FURTHER ACTION') || d.includes('COMPLIED')) return 'ok';
  return 'neutral';
}

/**
 * DBPR rank codes on the food service license file. Only codes we are sure of get a friendly label;
 * everything else shows as "Food service establishment". The importer logs every code it sees in
 * import_runs.note so this list can be extended after the first run.
 */
export const DBPR_RANKS: Record<string, { category: string; subtype: string }> = {
  MFDV: { category: 'food-trucks', subtype: 'Mobile food vehicle' },
  SEAT: { category: 'restaurants', subtype: 'Restaurant with seating' },
};
export function dbprRank(rank: string | null | undefined) {
  return DBPR_RANKS[(rank ?? '').trim().toUpperCase()] ?? { category: 'restaurants', subtype: 'Food service establishment' };
}

/**
 * Broward County Local Business Tax categories mapped to site categories.
 * null = not a customer-facing business we list (vacation rental homes, apartments, vending machines).
 */
const BTR_SKIP = /SINGLE RESORT DWELLING|VACATION RENTAL|APARTMENTS AND ROOMING|MERCHANDISE MACH|AMUSEMENT MACHINES|COIN LAUNDRY MACHINES|CEMETERY|WHOLESALE PETROLEUM|PERMANENT EXHIBIT/;
const BTR_RULES: [RegExp, string][] = [
  [/LUNCH WAGON|STORE ON WHEELS/, 'food-trucks'],
  [/RESTAURANT|FOOD\/BEVERAGE|TAKE OUT FOOD|CATERING|BAKERY|LUNCH COUNTER|CAFETERIA|COMMISSARY/, 'restaurants'],
  [/GARAGE\/AUTO|AUTOPAINT|CAR DETAIL|AUTOMOTIVE|WINDOW TINT|TOWING/, 'auto'],
  [/CONTRACT|CONTRACTR|CTR$|LAWN|LANDSCAPE|TREE TRIM|PEST CONTROL|CLEANING|JANITORIAL|LOCKSMITH|CABINET SHOP|LP GAS/, 'home-services'],
  [/BARBER|BEAUTY|TATTOO|PIERCING/, 'beauty'],
  [/PHYSICIAN|CLINIC|HOSPITAL|DENTIST|MASSAGE|PHYSICAL THERAP|PSYCHOLOGIST|PHD RELATED|PHARMACY|DISPENSARY/, 'health'],
  [/HEALTH CLUB|SPORT SCHOOL|MARTIAL ARTS|DANCE & INSTRUCTION/, 'fitness'],
  [/CHILD CARE|NURSERIES/, 'education'],
  [/REAL ESTATE/, 'real-estate'],
  [/HOTEL|MOTEL/, 'hotels'],
  [/DANCING AND\/OR ENTERTAINMENT|THEATRES|PRIVATE CLUB|POOL\/BILLI/, 'events'],
  [/CLOTHING|SHOE RETAIL|FURNITURE|APPLIANC|JEWELRY|EYEGLASSES|FLORIST|PAWNBROKER|FLEA M|ITINERANT/, 'retail'],
  [/OFFICE\/SALES|BUSINESS\/FINANCIAL|CONSULTANT|ATTORNEY|INSURANCE|C P A|ENGINEER|ARCHITECT|ADVERTISING|MARKETING|MORTGAGE|LOANS|STOCKBROKER|BANKS|SAVINGS & LOAN|TITLE\/COLLECTION|TRAVEL AGENCY|WRITERS|PUBLISHER/, 'professional'],
];
const OCC_RULES: [RegExp, string][] = [
  [/FOOD TRUCK|MOBILE FOOD/, 'food-trucks'],
  [/RESTAURANT|CAFE|PIZZ|GRILL|DELI|BAKERY|CATER|COFFEE|JUICE|SMOOTHIE/, 'restaurants'],
  [/AUTO|CAR WASH|DETAIL|TIRE|TINT|WRAP|TOWING|MECHANIC|COLLISION/, 'auto'],
  [/PET|VETERIN|GROOM|KENNEL|DOG/, 'pets'],
  [/SALON|BARBER|NAIL|LASH|BROW|SPA|BEAUTY|COSMET|WAX|MAKEUP|HAIR/, 'beauty'],
  [/ROOF|PLUMB|ELECTRIC|HVAC|AIR COND|PAINT|POOL|LAWN|LANDSCAP|PEST|CLEAN|HANDYMAN|PRESSURE|REMODEL|FLOOR|FENCE|SCREEN|GUTTER|MOVING/, 'home-services'],
  [/DOCTOR|MEDICAL|CLINIC|CHIRO|DENT|THERAP|PHARM|NURS|HEALTH|ACUPUNC|OPTOM/, 'health'],
  [/GYM|FITNESS|YOGA|PILATES|PERSONAL TRAIN|MARTIAL|BOXING|CROSSFIT/, 'fitness'],
  [/SCHOOL|TUTOR|CHILD|DAY ?CARE|LEARNING|ACADEMY|LESSON/, 'education'],
  [/EVENT|DJ|PHOTO|VIDEO|WEDDING|PARTY|BALLOON/, 'events'],
  [/LAW|ATTORNEY|ACCOUNT|TAX PREP|BOOKKEEP|INSUR|CONSULT|MARKETING|REAL ESTATE/, 'professional'],
  [/RETAIL|STORE|SHOP|BOUTIQUE|SALES/, 'retail'],
];
export function btrCategory(category: string | null | undefined, occupation: string | null | undefined): string | null {
  const c = (category ?? '').toUpperCase();
  const o = (occupation ?? '').toUpperCase();
  if (BTR_SKIP.test(c)) return null;
  if (/VACATION RENTAL|RESORT DWELLING/.test(o)) return null;
  for (const [re, slug] of BTR_RULES) if (re.test(c)) return slug;
  for (const [re, slug] of OCC_RULES) if (re.test(o)) return slug;
  return 'other';
}
/** Categories where the street address is usually a storefront. Others show city and ZIP only until the owner confirms. */
export const STOREFRONT_CATEGORIES = new Set(['restaurants', 'auto', 'beauty', 'health', 'fitness', 'retail', 'hotels', 'pets', 'education']);

export function cleanBizName(raw: string): string {
  return titleCase(raw.replace(/[,.]?\s+(L\.?L\.?C\.?|INC\.?|CORP\.?|CORPORATION|CO\.?|P\.?A\.?|LLP|PLLC|LTD\.?)$/i, '').trim());
}
