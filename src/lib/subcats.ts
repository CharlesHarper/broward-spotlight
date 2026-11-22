// Sub-categories inside each category. County records describe businesses in free text
// ("Window Tint", "Mobile Window Tinting", "Autopaint & Body/Window Tint"…), so each sub-category
// is a set of phrases matched against the business type and name. Phrases are matched against
// " <type> <name> " in lowercase with / & - turned into spaces, so a leading space means "starts a word".

export interface Subcat { slug: string; label: string; kw: string[] }

export const SUBCATS: Record<string, Subcat[]> = {
  auto: [
    { slug: 'repair', label: 'Repair & maintenance', kw: ['repair', ' mechanic', ' garage', 'oil change', ' lube', 'transmission', ' muffler', ' brake', ' diagnostic'] },
    { slug: 'body-paint', label: 'Body & paint', kw: [' body shop', 'autobody', 'auto body', 'autopaint', 'collision', 'paint & body', 'paint and body', ' dent '] },
    { slug: 'tint-wraps', label: 'Tint, wraps & PPF', kw: [' tint', 'vinyl wrap', 'vehicle wrap', 'car wrap', ' wraps ', 'protection film', ' ppf', 'window film', 'ceramic coat'] },
    { slug: 'detailing', label: 'Detailing & car washes', kw: [' detail', 'car wash', 'carwash', 'auto wash', ' hand wash'] },
    { slug: 'tires', label: 'Tires & wheels', kw: [' tire', ' tires', ' wheel', ' rims'] },
    { slug: 'dealers', label: 'Car dealers', kw: ['dealer', 'used car', 'car sales', 'auto sales', 'automobile sales', 'automotive sales', 'motor vehicle sales', 'used auto', ' car lot'] },
    { slug: 'towing', label: 'Towing & roadside', kw: [' towing', ' tow ', ' tow truck', 'roadside', 'wrecker'] },
    { slug: 'parts', label: 'Parts & accessories', kw: ['auto parts', 'automotive parts', ' parts', 'accessor', 'car audio', ' stereo', ' battery', ' batteries'] },
    { slug: 'glass', label: 'Auto glass', kw: ['auto glass', 'windshield', 'autoglass'] },
    { slug: 'rentals', label: 'Rentals & leasing', kw: ['car rental', 'auto rental', 'rent a car', 'rent-a-car', ' leasing', 'vehicle rental', 'truck rental'] },
    { slug: 'motorcycles', label: 'Motorcycles', kw: ['motorcycle', 'harley', ' scooter'] },
    { slug: 'marine', label: 'Boats & marine', kw: [' boat', ' yacht', ' marine', ' marina', ' vessel', ' charter'] },
    { slug: 'transport', label: 'Transport & delivery', kw: ['courier', 'delivery', 'transport', 'trucking', ' limo', ' hauling', ' freight', ' shuttle', ' taxi'] },
  ],
  'home-services': [
    { slug: 'general-contractors', label: 'General contractors', kw: ['general contractor', 'building contractor', 'gen contractor', 'remodel', 'renovation', 'construction'] },
    { slug: 'electricians', label: 'Electricians', kw: ['electric'] },
    { slug: 'plumbers', label: 'Plumbers', kw: ['plumb'] },
    { slug: 'roofing', label: 'Roofing', kw: [' roof'] },
    { slug: 'hvac', label: 'A/C & HVAC', kw: [' hvac', 'air condition', ' a c ', 'heating', 'mechanical contractor'] },
    { slug: 'lawn-landscaping', label: 'Lawn & landscaping', kw: [' lawn', 'landscap', ' tree ', ' tree trim', 'irrigation', 'sprinkler'] },
    { slug: 'cleaning', label: 'Cleaning & janitorial', kw: ['cleaning service', 'janitorial', 'maid', 'house clean', 'cleaning'] },
    { slug: 'pressure-cleaning', label: 'Pressure cleaning', kw: ['pressure clean', 'pressure wash', 'power wash'] },
    { slug: 'pools', label: 'Pools', kw: [' pool'] },
    { slug: 'pest-control', label: 'Pest control', kw: [' pest', 'exterminat', 'termite'] },
    { slug: 'handyman', label: 'Handyman', kw: ['handyman', 'handy man'] },
    { slug: 'painting', label: 'Painting', kw: [' painting', ' painter', 'paint contractor'] },
    { slug: 'flooring', label: 'Flooring & tile', kw: [' floor', ' tile', ' carpet', 'marble'] },
    { slug: 'locksmiths', label: 'Locksmiths', kw: ['locksmith'] },
    { slug: 'movers', label: 'Movers', kw: [' moving', ' movers'] },
    { slug: 'fences-screens', label: 'Fences, screens & windows', kw: [' fence', ' screen', ' window', ' shutter', ' door'] },
  ],
  beauty: [
    { slug: 'hair-salons', label: 'Hair salons', kw: [' hair', 'cosmetology salon', 'beauty salon', ' salon'] },
    { slug: 'barbers', label: 'Barbers', kw: [' barber'] },
    { slug: 'nails', label: 'Nails', kw: [' nail'] },
    { slug: 'braiding', label: 'Braiding', kw: [' braid'] },
    { slug: 'lashes-brows', label: 'Lashes, brows & waxing', kw: [' lash', ' brow', ' wax', 'threading'] },
    { slug: 'skin-spa', label: 'Skin care & spas', kw: [' spa', 'facial', ' skin', 'esthetic', 'aesthetic'] },
    { slug: 'makeup', label: 'Makeup', kw: ['makeup', 'make up'] },
    { slug: 'tattoo', label: 'Tattoo & piercing', kw: ['tattoo', 'piercing'] },
    { slug: 'beauty-supply', label: 'Beauty supply', kw: ['beauty suppl'] },
  ],
  health: [
    { slug: 'doctors', label: 'Doctors & clinics', kw: ['medical doctor', 'physician', 'medical office', ' clinic', ' md ', 'urgent care'] },
    { slug: 'dentists', label: 'Dentists', kw: ['dentist', 'dental', 'orthodont'] },
    { slug: 'chiropractors', label: 'Chiropractors', kw: ['chiropract'] },
    { slug: 'massage', label: 'Massage', kw: ['massage'] },
    { slug: 'physical-therapy', label: 'Physical therapy', kw: ['physical therap', 'rehab'] },
    { slug: 'mental-health', label: 'Mental health & counseling', kw: ['mental health', 'counsel', 'psycholog', 'psychiatr', 'therapist', 'social worker'] },
    { slug: 'eye-care', label: 'Eye care', kw: ['optomet', 'optical', 'ophthalm', ' eye'] },
    { slug: 'pharmacies', label: 'Pharmacies', kw: ['pharmac'] },
    { slug: 'home-health', label: 'Home health', kw: ['home health', 'home care', 'assisted living', 'nurs'] },
    { slug: 'med-spas', label: 'Med spas & wellness', kw: ['med spa', 'medspa', 'iv therapy', 'wellness', 'weight loss', 'acupunct'] },
  ],
  restaurants: [
    { slug: 'sit-down', label: 'Sit-down restaurants', kw: ['restaurant with seating'] },
    { slug: 'takeout', label: 'Take-out & counter', kw: ['take out', 'counter service'] },
    { slug: 'caterers', label: 'Caterers', kw: ['caterer', 'catering'] },
    { slug: 'pizza', label: 'Pizza', kw: [' pizz'] },
    { slug: 'cafes-bakeries', label: 'Cafés, coffee & bakeries', kw: [' cafe', ' café', ' coffee', ' bakery', ' bakeries', ' donut', ' bagel', ' pastr'] },
    { slug: 'mexican', label: 'Mexican & tacos', kw: [' taco', ' mexican', ' burrito', ' cantina', ' taqueria'] },
    { slug: 'asian', label: 'Asian & sushi', kw: [' sushi', ' chinese', ' thai', ' japanese', ' ramen', ' pho ', ' wok', ' hibachi', ' asian', ' china', ' korean', ' vietnam'] },
    { slug: 'latin', label: 'Cuban & Latin', kw: [' cuban', ' latin', ' peruvian', ' colombian', ' venezuelan', ' empanada', ' arepa', ' brazil'] },
    { slug: 'caribbean', label: 'Caribbean', kw: [' caribbean', ' jamaican', ' haitian', ' island'] },
    { slug: 'burgers-wings', label: 'Burgers, wings & chicken', kw: [' burger', ' wing', ' chicken'] },
    { slug: 'seafood', label: 'Seafood', kw: [' seafood', ' fish', ' crab', ' oyster', ' lobster'] },
    { slug: 'italian', label: 'Italian', kw: [' italian', ' trattoria', ' ristorante', ' pasta', ' osteria'] },
    { slug: 'bars-grills', label: 'Bars & grills', kw: [' bar ', ' grill', ' pub', ' tavern', ' saloon', ' brewing', ' brewery'] },
  ],
  fitness: [
    { slug: 'gyms', label: 'Gyms & health clubs', kw: [' gym', 'health studio', 'health club', 'fitness'] },
    { slug: 'personal-training', label: 'Personal training', kw: ['personal train'] },
    { slug: 'yoga-pilates', label: 'Yoga & Pilates', kw: [' yoga', 'pilates'] },
    { slug: 'martial-arts', label: 'Martial arts & boxing', kw: ['martial', 'karate', 'jiu', ' judo', 'taekwondo', ' boxing', ' mma', 'kickbox'] },
    { slug: 'dance', label: 'Dance', kw: [' dance', ' dancing'] },
  ],
  professional: [
    { slug: 'law', label: 'Lawyers', kw: ['attorney', ' law ', ' law firm', ' law office', ' lawyer', 'legal'] },
    { slug: 'accounting', label: 'Accounting & tax', kw: ['account', ' tax', ' cpa', ' c p a', 'bookkeep', 'payroll'] },
    { slug: 'insurance', label: 'Insurance', kw: ['insurance', 'adjust'] },
    { slug: 'marketing', label: 'Marketing & design', kw: ['marketing', 'advertis', 'design', ' web ', 'graphic', ' media'] },
    { slug: 'consulting', label: 'Consulting', kw: ['consult'] },
    { slug: 'engineering', label: 'Engineering & architecture', kw: ['engineer', 'architect', 'surveyor'] },
    { slug: 'finance', label: 'Mortgages, loans & finance', kw: ['mortgage', ' loan', 'financ', 'stockbroker', ' bank', 'investment'] },
    { slug: 'it', label: 'IT & tech', kw: [' computer', ' software', ' it ', 'technology', 'tech support', 'telecommunication'] },
    { slug: 'online-sales', label: 'Online businesses', kw: ['online', 'internet', 'e commerce', 'ecommerce'] },
  ],
  education: [
    { slug: 'child-care', label: 'Child care & preschool', kw: ['child care', 'childcare', 'day care', 'daycare', 'preschool', 'pre school', 'nurser', 'vpk'] },
    { slug: 'tutoring', label: 'Tutoring', kw: ['tutor'] },
    { slug: 'schools', label: 'Private schools', kw: ['private school', ' academy', ' school'] },
    { slug: 'driving', label: 'Driving schools', kw: ['driving'] },
    { slug: 'music-arts', label: 'Music & art lessons', kw: [' music', ' piano', ' guitar', ' art class', ' art lesson', ' lessons'] },
  ],
  events: [
    { slug: 'photo-video', label: 'Photography & video', kw: [' photo', ' video', 'film'] },
    { slug: 'planners', label: 'Event planners', kw: ['event plan', 'party plan', 'planner', 'wedding'] },
    { slug: 'party-rentals', label: 'Party rentals', kw: ['party rental', 'rental', 'bounce', 'tent'] },
    { slug: 'djs-entertainment', label: 'DJs & entertainment', kw: [' dj ', 'entertain', ' music', ' band'] },
    { slug: 'venues', label: 'Venues & nightlife', kw: ['venue', 'banquet', ' hall', 'theat', 'night club', 'nightclub', 'dancing'] },
    { slug: 'event-food', label: 'Event food service', kw: ['temporary event'] },
  ],
  'real-estate': [
    { slug: 'brokers', label: 'Brokers & agencies', kw: ['broker', 'real estate corp', 'realty', 'real estate co', 'real estate office', 'branch'] },
    { slug: 'appraisers', label: 'Appraisers', kw: ['apprais'] },
    { slug: 'property-management', label: 'Property management', kw: ['property manage', 'management'] },
  ],
  retail: [
    { slug: 'clothing', label: 'Clothing & shoes', kw: ['clothing', ' shoe', 'boutique', 'apparel'] },
    { slug: 'jewelry', label: 'Jewelry', kw: ['jewel'] },
    { slug: 'florists', label: 'Florists', kw: ['florist', ' flower'] },
    { slug: 'furniture', label: 'Furniture & home', kw: ['furniture', 'mattress', 'appliance', 'home decor'] },
    { slug: 'smoke-vape', label: 'Smoke & vape', kw: ['smoke', ' vape', 'tobacco', 'cigar', 'hookah'] },
    { slug: 'convenience', label: 'Convenience & grocery', kw: ['convenience', 'grocery', 'market', 'food store'] },
    { slug: 'pawn', label: 'Pawn shops', kw: ['pawn'] },
    { slug: 'eyewear', label: 'Eyewear', kw: ['eyeglass', 'eyewear', 'optical'] },
    { slug: 'flea-markets', label: 'Flea markets & vendors', kw: ['flea', 'itinerant'] },
    { slug: 'online', label: 'Online shops', kw: ['online', 'internet', 'e commerce'] },
  ],
  pets: [
    { slug: 'vets', label: 'Veterinarians', kw: ['veterin', ' vet ', 'animal hospital', 'animal clinic'] },
    { slug: 'grooming', label: 'Grooming', kw: ['groom'] },
    { slug: 'pet-stores', label: 'Pet stores & supplies', kw: ['pet shop', 'pet store', 'pet suppl', 'aquarium'] },
    { slug: 'training', label: 'Training', kw: ['training', 'trainer'] },
    { slug: 'sitting-boarding', label: 'Sitting, walking & boarding', kw: ['sitting', 'sitter', 'boarding', 'kennel', 'walking', 'daycare', 'day care'] },
  ],
  hotels: [
    { slug: 'hotels', label: 'Hotels', kw: [' hotel', ' inn ', ' suites', ' resort'] },
    { slug: 'motels', label: 'Motels', kw: [' motel'] },
  ],
  'food-trucks': [
    { slug: 'trucks', label: 'Food trucks', kw: ['mobile food'] },
    { slug: 'carts', label: 'Hot dog & food carts', kw: [' cart'] },
  ],
};

export const subcatsFor = (category: string) => SUBCATS[category] ?? [];
export const findSubcat = (category: string, slug: string) => subcatsFor(category).find((s) => s.slug === slug) ?? null;

/** The text a business is matched against. */
export const MATCH_TEXT = `(' ' || replace(replace(replace(replace(lower(coalesce(b.subtype, '') || ' ' || b.name), '/', ' '), '&', ' & '), '-', ' '), ',', ' ') || ' ')`;

/** SQL condition (with its bind values) for "this business is in the sub-category". */
export function subcatWhere(sc: Subcat, startAt: number): { sql: string; binds: string[] } {
  return { sql: '(' + sc.kw.map((_, i) => `instr(${MATCH_TEXT}, ?${startAt + i}) > 0`).join(' OR ') + ')', binds: sc.kw };
}

/** How many active listings each sub-category has, cached for six hours. */
export async function subcatCounts(db: D1Database, category: string): Promise<Record<string, number>> {
  const subs = subcatsFor(category);
  if (!subs.length) return {};
  const key = `subcat_counts:${category}`;
  const cached = await db.prepare(`SELECT value, updated_at FROM import_state WHERE key = ?`).bind(key).first<{ value: string; updated_at: string | null }>().catch(() => null);
  if (cached?.value) {
    try {
      const v = JSON.parse(cached.value) as { at: number; counts: Record<string, number> };
      if (Date.now() - v.at < 6 * 3600e3) return v.counts;
    } catch { /* rebuild */ }
  }
  const binds: unknown[] = [category];
  const cols = subs.map((sc) => {
    const w = subcatWhere(sc, binds.length + 1);
    binds.push(...w.binds);
    return `SUM(CASE WHEN ${w.sql} THEN 1 ELSE 0 END) AS "${sc.slug}"`;
  });
  const row = await db.prepare(`SELECT ${cols.join(', ')} FROM businesses b WHERE b.category = ?1 AND b.status = 'active'`).bind(...binds).first<Record<string, number>>();
  const counts: Record<string, number> = {};
  for (const sc of subs) counts[sc.slug] = Number(row?.[sc.slug] ?? 0);
  await db.prepare(`INSERT INTO import_state (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(key, JSON.stringify({ at: Date.now(), counts })).run();
  return counts;
}
