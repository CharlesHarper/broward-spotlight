/**
 * City photos and short histories for city pages.
 * Photos are free-licensed Wikimedia Commons images, credited on the page and cached in R2 by /img/city/<slug>.jpg.
 * Histories are written in our own words from each city's Wikipedia article (linked as the source) and the city's own site.
 */
export interface CityPhoto { file: string; credit: string; license: string; alt: string }
export interface CityInfo { photo?: CityPhoto; history: string[]; wiki: string; incorporated?: string }

const w = (t: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;

export const CITY_INFO: Record<string, CityInfo> = {
  'coconut-creek': {
    wiki: w('Coconut Creek, Florida'), incorporated: '1967',
    photo: { file: 'A_typical_residential_neighborhood_street_in_Coconut_Creek.jpg', credit: 'Faisal0926', license: 'CC0', alt: 'Tree-lined residential street in Coconut Creek' },
    history: [
      'Coconut Creek grew out of land that was once part of Pompano Beach and became its own city in the 1960s. Developer Robert E. Bateman picked the name by blending Indian Creek, a village in Miami-Dade, with Miami\'s Coconut Grove; the coconut palms early developers planted made it fit.',
      'It was laid out as a planned community, with landscaped roads, waterways and butterfly gardens woven through its neighborhoods. Butterfly World, a large butterfly aviary, earned it the nickname "Butterfly Capital of the World," and it was the first city in Florida certified as a Community Wildlife Habitat.',
    ],
  },
  'cooper-city': {
    wiki: w('Cooper City, Florida'), incorporated: '1959',
    photo: { file: 'Coopercity_cityhall.jpg', credit: 'Z thomas', license: 'CC BY-SA 4.0', alt: 'Cooper City City Hall' },
    history: [
      'Cooper City takes its name from Morris Cooper, who founded the community in 1959 on farmland in southwest Broward.',
      'It has stayed a compact residential city, about eight square miles, wedged between Davie, Pembroke Pines, Hollywood and Southwest Ranches. In 2006 it grew by annexing the former Waldrep Dairy Farm.',
    ],
  },
  'coral-springs': {
    wiki: w('Coral Springs, Florida'), incorporated: '1963',
    photo: { file: 'Coral_Springs_downtown_January_2019.jpg', credit: 'Jedi94', license: 'CC BY-SA 4.0', alt: 'Downtown Coral Springs' },
    history: [
      'Before it was a city, most of Coral Springs was marshland owned by Henry Lyons, who bought about 20,000 acres between 1911 and 1939. Once flood-control canals drained the area after the floods of 1947, the land was farmed for beans and later cattle.',
      'In 1961 Coral Ridge Properties bought 3,869 acres from the Lyons family for $1 million, and the city was chartered on July 10, 1963. Names like "Pompano Springs" were considered first. The landmark covered bridge went up in 1964 to promote the new town, the first lots sold that year, and Coral Square mall opened in 1984.',
      'The Sawgrass Expressway brought another wave of growth after 1986. The city reached residential build-out in 2003.',
    ],
  },
  'dania-beach': {
    wiki: w('Dania Beach, Florida'), incorporated: '1904',
    photo: { file: 'Dania_Beach_FL_Nyberg-Swanson_House_ChofComm01.jpg', credit: 'Ebyabe', license: 'CC BY-SA 3.0', alt: 'Historic Nyberg-Swanson House in Dania Beach' },
    history: [
      'Dania Beach is the oldest city in Broward County. It began as a farm settlement called Modello and was incorporated in November 1904 as the Town of Dania, named for the Danish roots of most of its 35 residents.',
      'In 1926 Dania voted to join Hollywood, but after that September\'s hurricane most of it broke away again and reincorporated, which is why its borders are still uneven today. Once known as the "Tomato Capital of the World," it later became the "Antique Capital of the South" for the antique shops along Federal Highway. It took the name Dania Beach in 1998.',
    ],
  },
  davie: {
    wiki: w('Davie, Florida'), incorporated: '1925',
    photo: { file: 'Town_Hall_(Davie,_Florida).jpg', credit: 'Tamanoeconomico', license: 'CC BY-SA 4.0', alt: 'Davie Town Hall' },
    history: [
      'Long before the town existed, the Tequesta people lived here. Campsites and graves at Pine Island Ridge date back 5,000 to 7,000 years.',
      'When Florida drained Everglades swampland in the early 1900s, businessman Robert Parsell Davie bought 44 square miles to start farms and a town called Zona. Within a few years residents renamed it Davie in his honor.',
    ],
  },
  'deerfield-beach': {
    wiki: w('Deerfield Beach, Florida'), incorporated: '1925',
    photo: { file: 'Deerfield_Resort_Photo_Don_Ramey_Logan.jpg', credit: 'Don Ramey Logan', license: 'CC BY-SA 3.0', alt: 'Oceanfront resort in Deerfield Beach' },
    history: [
      'Deerfield Beach traces back to 1890, when a small settlement grew along the Hillsboro River. By 1898 it had its own post office and a new name, Deerfield, for the deer that grazed by the river.',
      'The Florida East Coast Railway brought more settlers, mostly farmers growing pineapples, tomatoes, beans and squash. The town added "Beach" to its name in 1939 to tell tourists about its shoreline, and the first wooden pier went up in 1952. Many of its oldest buildings, from the 1920s, are in the Mediterranean Revival style.',
    ],
  },
  'fort-lauderdale': {
    wiki: w('Fort Lauderdale, Florida'), incorporated: '1911',
    photo: { file: 'Skyline_of_Fort_Lauderdale,_Nov-15.jpg', credit: 'KeanoManu', license: 'CC BY-SA 4.0', alt: 'Fort Lauderdale skyline along the New River' },
    history: [
      'The Tequesta people lived along this coast for at least 2,000 years. By the 1830s about 70 settlers farmed along the New River, but they fled in 1836 during the Second Seminole War. The Army built a stockade called Fort Lauderdale in 1838 and abandoned it in 1842.',
      'Settlement returned in the 1890s. Frank Stranahan ran a ferry across the New River starting in 1893, and the Florida East Coast Railway opened the area to growth. Fort Lauderdale was incorporated in 1911 and became the seat of the new Broward County in 1915.',
    ],
  },
  'hallandale-beach': {
    wiki: w('Hallandale Beach, Florida'), incorporated: '1927',
    photo: { file: 'Hallandale_Beach_sunset.JPG', credit: 'Florida guy 128', license: 'Public domain', alt: 'Sunset over Hallandale Beach' },
    history: [
      'Railroad builder Henry Flagler recruited Luther Halland to start a settlement south of Dania. Halland opened a trading post and became the first postmaster, and with Swedish immigrant Olaf Zetterlund promoted the area\'s frost-free farmland. By 1900 about a dozen families lived there.',
      'Hallandale was incorporated on May 14, 1927, the eighth municipality in Broward. It reincorporated as a city in 1947 so it could annex land along the ocean, and changed its name to Hallandale Beach in 1999.',
    ],
  },
  'hillsboro-beach': {
    wiki: w('Hillsboro Beach, Florida'), incorporated: '1939',
    photo: { file: 'Aerial_Shot_of_Le_Palais_Royale.jpg', credit: 'Yanjipy', license: 'CC BY-SA 4.0', alt: 'Aerial view of the Hillsboro Beach coastline' },
    history: [
      'The town is named for the Earl of Hillsborough, who held large British land grants in Florida in the 1700s. Its first permanent structure was the Hillsboro Inlet Lighthouse, built in 1907. In the 1920s Herbert L. Malcolm built a school next to it that became the Hillsboro Club hotel.',
      'Hillsboro Beach was first incorporated in 1939 and became fully active in 1947. The whole town lines a 3.2-mile stretch of A1A known as the "Hillsboro Mile," and its population roughly doubles in winter.',
    ],
  },
  hollywood: {
    wiki: w('Hollywood, Florida'), incorporated: '1925',
    photo: { file: 'HollywoodBM.jpg', credit: 'Ven-Lib', license: 'CC BY-SA 4.0', alt: 'Hollywood, Florida' },
    history: [
      'Joseph Wesley Young platted "Hollywood by the Sea" in 1921 as a planned city of the Florida land boom. It was incorporated in 1925 with Young as its first mayor. Builders dredged two yacht basins linked to the Intracoastal, and the story goes that when the city lights first came on, ships at sea reported Miami was on fire.',
      'The 1926 hurricane hit Hollywood harder than almost anywhere but Miami. The city recovered as a winter home for "snowbirds" and by 1960 had more than 2,400 hotel units. The Seminole Tribe of Florida, federally recognized in 1957, has its headquarters here, and the Seminole Hard Rock Hotel & Casino opened in 2004.',
    ],
  },
  'lauderdale-by-the-sea': {
    wiki: w('Lauderdale-by-the-Sea, Florida'),
    photo: { file: "Lauderdale_By_The_Sea_-_Anglin's_Pier_9_of_9_(50661033743).jpg", credit: 'Rob Olivera', license: 'CC BY 2.0', alt: "Anglin's Fishing Pier in Lauderdale-By-The-Sea" },
    history: [
      'Lauderdale-By-The-Sea sits on a narrow barrier island between the Intracoastal and the ocean, centered on Commercial Boulevard and A1A. Anglin\'s Fishing Pier at the end of Commercial is named for the town\'s first mayor, Melvin Anglin.',
      'Tourism has always driven the town, and many of its older hotels show mid-century modern design. With a coral reef about 100 yards offshore, the Florida Legislature recognized it in 2016 as Florida\'s Beach Diving Capital. The town doubled in size in 2001 by annexing the area to its north.',
    ],
  },
  'lauderdale-lakes': {
    wiki: w('Lauderdale Lakes, Florida'), incorporated: '1961',
    history: [
      'Lauderdale Lakes was incorporated on June 22, 1961, and first drew retirees and winter residents. By the end of the 20th century it had become a largely Caribbean and African American community.',
    ],
  },
  lauderhill: {
    wiki: w('Lauderhill, Florida'),
    photo: { file: 'Lauderhill_City_Hall.jpg', credit: 'RTMGterra', license: 'CC BY-SA 4.0', alt: 'Lauderhill City Hall' },
    history: [
      'Lauderhill started with an unusual idea: homes sold off the shelf at Macy\'s. Developer Herbert Sadkin built Andrew Geller-designed houses that came furnished down to the toothbrushes, for roughly $13,000 to $17,000.',
      'The Inverrary Country Club opened in 1970, and from 1972 to 1983 it hosted the Jackie Gleason Inverrary Classic on the PGA Tour. Gleason built his last home on the course. Once a retirement and snowbird town, Lauderhill is now home to a large Jamaican and West Indian community.',
    ],
  },
  'lazy-lake': {
    wiki: w('Lazy Lake, Florida'), incorporated: '1953',
    history: [
      'Lazy Lake was built after 1946 by developer Hal Ratliff around an old rock quarry that filled with water. A friend remarked that the lake looked "so lazy and peaceful," and the name stuck.',
      'When Wilton Manors incorporated, residents chose to form their own village instead, on June 3, 1953. It began with 13 homes on 13 acres and is the smallest municipality in Broward by area. In 1995 residents put the entire village up for sale for $15 million; it drew national attention but no buyer.',
    ],
  },
  'lighthouse-point': {
    wiki: w('Lighthouse Point, Florida'),
    photo: { file: "Bateau_pénétrant_dans_l'Inlet_de_Lighthouse_Point,_Florida._Boat_sailing_in_the_Inlet_-_panoramio.jpg", credit: 'Richard Mc Neil', license: 'CC BY 3.0', alt: 'Boat entering the Hillsboro Inlet near Lighthouse Point' },
    history: [
      'Lighthouse Point is named for the Hillsboro Inlet Lighthouse across the Intracoastal in Hillsboro Beach.',
      'Most of the city was built on canals dug in the 1950s and 1960s, which gave it an unusual amount of waterfront housing and made boating part of everyday life. Through the Hillsboro Inlet, boaters can reach Bimini, about 40 miles away.',
    ],
  },
  margate: {
    wiki: w('Margate, Florida'), incorporated: '1961',
    photo: { file: 'Calypso_Cove_Aquatic_Facility.jpg', credit: 'City of Margate', license: 'CC BY 4.0', alt: 'Calypso Cove aquatic center in Margate' },
    history: [
      'Margate was founded in the 1950s on land that was still Everglades or farmland. Its name blends the first letters of founder Jack Marqusee\'s last name with "gate," since it was seen as the gateway to western Broward.',
      'It became a town in 1955 and was incorporated as a city in 1961. Today it is known for the Calypso Cove water park and the Oriole golf club.',
    ],
  },
  miramar: {
    wiki: w('Miramar, Florida'), incorporated: '1955',
    photo: { file: 'Miramar,_Florida_neighborhood.png', credit: 'AccuTour Digital Media Solutions', license: 'CC BY 3.0', alt: 'Neighborhood in Miramar' },
    history: [
      'Miramar was incorporated on May 26, 1955, and named for the Miramar neighborhood of Havana, Cuba. The governor appointed its first mayor and council, and residents held their first city elections in 1959.',
      'Today it is home to regional offices including the FBI\'s Miami field office.',
    ],
  },
  'north-lauderdale': {
    wiki: w('North Lauderdale, Florida'), incorporated: '1963',
    photo: { file: 'North Lauderdale, FL, USA - panoramio.jpg', credit: 'Panoramio contributor', license: 'CC BY-SA 3.0', alt: 'Street view in North Lauderdale' },
    history: [
      'When North Lauderdale was created in 1963, it was mostly dairy pasture and a string-bean farm on the western edge of development. Architect Morris Lapidus, famous for Miami Beach\'s Fontainebleau and Eden Roc hotels, planned it as "The City of Tomorrow," the first city he laid out. His curving Boulevard of Champions is still there.',
      'In the 1970s affordable homes brought a ten-year building boom, as families moved in neighborhood by neighborhood.',
    ],
  },
  'oakland-park': {
    wiki: w('Oakland Park, Florida'), incorporated: '1929',
    photo: { file: 'OaklandPkWaterways.jpg', credit: 'Jpkolo', license: 'CC BY-SA 3.0', alt: 'Waterway through a residential neighborhood in Oakland Park' },
    history: [
      'Oakland Park started out as Floranada, a blend of "Florida" and "Canada," but the 1926 hurricane pushed the town into bankruptcy. When it reincorporated in 1929, residents voted to become a city named Oakland Park.',
      'Its borders were redrawn much smaller than Floranada\'s, then grew again over time through annexations such as Twin Lakes South and North Andrews Gardens.',
    ],
  },
  parkland: {
    wiki: w('Parkland, Florida'), incorporated: '1963',
    photo: { file: 'Water Control Gates - panoramio.jpg', credit: 'MikesMegapixels', license: 'CC BY 3.0', alt: 'Water control gates near Parkland' },
    history: [
      'Parkland was the idea of farmer and rancher Bruce Blount, who wanted a rural, open town away from Broward\'s building boom. The Legislature approved its charter in July 1963, and Governor Farris Bryant recognized it as a city on August 12, 1963. Blount, a former Pompano Beach mayor, became its first mayor.',
      'The city has kept its low-density, park-like character as it grew in Broward\'s northwest corner.',
    ],
  },
  'pembroke-park': {
    wiki: w('Pembroke Park, Florida'), incorporated: '1957',
    history: [
      'Pembroke Park is a small town of about 6,000 people in southeast Broward, named for its location along Pembroke Road. It was incorporated in December 1957, and many of its residents live in mobile-home communities.',
    ],
  },
  'pembroke-pines': {
    wiki: w('Pembroke Pines, Florida'), incorporated: '1960',
    photo: { file: 'Pembroke_Pines,_Florida.jpg', credit: 'LittleT889', license: 'CC BY-SA 4.0', alt: 'Pembroke Pines' },
    history: [
      'Pembroke Pines was incorporated on January 16, 1960. Its name goes back to Sir Edward J. Reed, a British member of Parliament for Pembroke, whose land company bought huge tracts of South Florida swampland in 1882. A road through one tract became Pembroke Road, and first mayor Walter Kipnis added "Pines" for the pine trees nearby.',
      'The area began as dairy farms, including the Waldrep Dairy Farm, where Pembroke Lakes Mall stands today. The first city was less than a square mile, hemmed in by North Perry Airport, until annexations let it grow west into one of Broward\'s largest cities.',
    ],
  },
  plantation: {
    wiki: w('Plantation, Florida'), incorporated: '1953',
    photo: { file: 'Plantation_FL_Hist_Museum01.jpg', credit: 'Ebyabe', license: 'CC BY-SA 3.0', alt: 'Plantation Historical Museum' },
    history: [
      'Until the early 1900s this land was Everglades, usually under two to three feet of water. Drainage canals dug from 1906 onward opened it up, and the Everglades Plantation Company, formed in 1909, gave the area its name.',
      'In 1941 Frederick Peters, heir to a shoe business, bought about 10,000 acres here for his cattle. He later turned to building a planned community, with a master plan by architect Russell Pancoast and a water control district chartered in 1946. Plantation was incorporated on April 23, 1953, with about 300 residents.',
    ],
  },
  'pompano-beach': {
    wiki: w('Pompano Beach, Florida'), incorporated: '1908',
    photo: { file: 'Pompano_Beach,_Florida.jpg', credit: 'Quintin Soloviev', license: 'CC BY 4.0', alt: 'Pompano Beach' },
    history: [
      'Pompano Beach is named for the Florida pompano, a fish found off the coast. The story goes that railway surveyor Frank Sheen wrote the name of his dinner on his survey map. Sheen and George Butler arrived with their families in 1896, the same year the first train reached the settlement.',
      'The Town of Pompano was incorporated on July 3, 1908, with John R. Mizell as its first mayor. Within eight years it had been part of three counties: Dade, Palm Beach and finally Broward. In 1947 it merged with the new town on the beach to become Pompano Beach.',
    ],
  },
  'sea-ranch-lakes': {
    wiki: w('Sea Ranch Lakes, Florida'), incorporated: '1959',
    photo: { file: 'SeaRanchLakesSept07GuardhouseMotorcycle.jpg', credit: 'Infrogmation of New Orleans', license: 'CC BY-SA 1.0', alt: 'Gatehouse at the entrance to Sea Ranch Lakes' },
    history: [
      'Newspaper owner R.H. Gore bought this oceanfront tract during the Great Depression and opened the Sea Ranch Cabana Club in 1939, followed by the Sea Ranch Hotel in 1940.',
      'A gated residential community around two man-made lakes was developed in 1956, and the Village of Sea Ranch Lakes was incorporated on October 6, 1959. Its gatehouse on Gatehouse Drive doubles as the village police station.',
    ],
  },
  'southwest-ranches': {
    wiki: w('Southwest Ranches, Florida'), incorporated: '2000',
    photo: { file: 'Southwest_Ranches,_Florida_-_with_view_of_Sheridan_Street.png', credit: 'Rey Valls', license: 'CC BY 3.0', alt: 'Sheridan Street in Southwest Ranches' },
    history: [
      'Archaeologists have found a Tequesta burial site here more than a thousand years old, on what was once an Everglades tree island.',
      'In 1996 Pembroke Pines moved to annex the area. Hundreds of residents packed the hearing to fight it, and in March 2000 they voted to form their own town to protect its rural, ranch-style way of life. Southwest Ranches became Broward\'s 30th municipality.',
    ],
  },
  sunrise: {
    wiki: w('Sunrise, Florida'),
    photo: { file: 'Sunrise_Civic_Center,_Sunrise_Florida_33351.jpg', credit: 'LTreadwell', license: 'CC0', alt: 'Sunrise Civic Center' },
    history: [
      'In 1960 developer Norman Johnson paid $9 million for 2,650 acres in southwest Broward. The community was nearly called Sunset Village, but residents thought "sunset" sounded too final. To draw buyers, Johnson built a furnished "upside-down house" that became a national attraction.',
      'Sunrise Golf Village became a self-governing city in 1967 and shortened its name to Sunrise in 1971. Annexations then grew it to more than 18 square miles, reaching the edge of the Everglades.',
    ],
  },
  tamarac: {
    wiki: w('Tamarac, Florida'), incorporated: '1963',
    photo: { file: 'Rear-canal2.JPG', credit: 'Tamarac', license: 'CC BY-SA 3.0', alt: 'Canal behind homes in Tamarac' },
    history: [
      'In the early 1960s developer Ken Behring arrived from the Midwest and built an active-adult community of maintenance-free two-bedroom homes. He named it after the nearby Tamarac Country Club.',
      'The first section, Tamarac Lakes, went up east of State Road 7 in 1963, followed by neighborhoods such as the Mainlands and the Woodlands. Early leaders wanted a quiet bedroom community, so the city\'s borders largely followed wherever Behring built.',
    ],
  },
  'west-park': {
    wiki: w('West Park, Florida'), incorporated: '2005',
    history: [
      'West Park is one of Broward\'s newest cities. Residents of these unincorporated neighborhoods voted 3,400 to 956 in November 2004 to incorporate, making it the county\'s 31st city.',
      'Its first mayor, Eric H. Jones Jr., and four commissioners were sworn in in March 2005. The working name West Park was meant to be temporary, but it stuck.',
    ],
  },
  weston: {
    wiki: w('Weston, Florida'), incorporated: '1996',
    photo: { file: 'Weston,_Florida_-_Aerial.jpg', credit: 'formulanone', license: 'CC BY-SA 2.0', alt: 'Aerial view of Weston' },
    history: [
      'In the 1950s industrialist Arthur Vining Davis controlled about 15,000 acres here. His company, Arvida, later developed most of it as a master-planned community first called Indian Trace. The name changed to Weston in the early 1980s, and the first homes were finished in 1984.',
      'Rather than be annexed by a neighbor, residents voted to incorporate, and Weston became a city on September 3, 1996, with about 90 percent of voters in favor.',
    ],
  },
  'wilton-manors': {
    wiki: w('Wilton Manors, Florida'), incorporated: '1947',
    photo: { file: 'City_Hall_on_Wilton_Drive.jpeg', credit: 'Jessica Chesler', license: 'CC BY-SA 4.0', alt: 'City Hall on Wilton Drive' },
    history: [
      'In the early 1900s this area was called Colohatchee, after a stop on the Florida East Coast Railway. Developer Ned Willingham coined the name Wilton Manors in 1925, and the city was incorporated in 1947.',
      'Since the late 1990s, Wilton Drive has become an arts and entertainment district full of restaurants, bars and shops, many LGBTQ+-owned. In 2018 Wilton Manors became the first city in Florida with an all-LGBTQ+ city commission.',
    ],
  },
  'unincorporated-broward': {
    wiki: w('Broward County, Florida'),
    photo: { file: 'Florida-Hollywood-Water_Tank.jpg', credit: 'Marine 69-71', license: 'CC BY-SA 4.0', alt: 'Water tower in Broward County' },
    history: [
      'Broward County was created on April 30, 1915, from land given by Palm Beach and Dade counties. It was almost named Everglades County, but was named instead for Governor Napoleon Bonaparte Broward, who championed draining the Everglades.',
      'Unincorporated Broward covers the pockets of the county that belong to no city and are served directly by the county.',
    ],
  },
};

/** Where the cached photo is served from. */
export const cityPhotoUrl = (slug: string) => (CITY_INFO[slug]?.photo ? `/img/city/${slug}.jpg` : null);
