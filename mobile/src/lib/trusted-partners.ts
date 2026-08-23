export type TrustedPartner = {
  address?: string;
  businessName: string;
  category: string;
  email?: string;
  emailUrl?: string;
  id: string;
  instagramUrl?: string;
  phoneDisplay?: string;
  phoneUrl?: string;
  summary: string;
  websiteUrl?: string;
};

const PARTNERS: readonly TrustedPartner[] = [
  {
    id: 'dark-side-film',
    category: 'Window Tinting',
    businessName: 'Dark Side of the Film',
    summary: 'Automotive tint, PPF, ceramic coating and dash camera installation.',
    address: '24 Bravo Loop, Pakenham VIC 3810',
    phoneDisplay: '0426 246 001',
    phoneUrl: 'tel:+61426246001',
    websiteUrl: 'https://www.darksideofthefilm.com.au/',
    instagramUrl: 'https://www.instagram.com/tintby_darkside/',
  },
  {
    id: 'race-wires',
    category: 'Auto Electrical',
    businessName: 'Race Wires Auto Electrics',
    summary: 'Performance, street and race-car electrical systems and aftermarket ECU installations.',
    address: 'Unit 6, 18 Sette Circuit, Pakenham VIC 3810',
    phoneDisplay: '0407 257 079',
    phoneUrl: 'tel:+61407257079',
    email: 'racewires@live.com',
    emailUrl: 'mailto:racewires@live.com',
    websiteUrl: 'https://racewires.com.au/',
  },
  {
    id: 'elite-autobody',
    category: 'Paint & Bodywork',
    businessName: 'Elite Autobody',
    summary: 'Automotive paint, restoration, fabrication and coach building.',
    address: '19 Exchange Drive, Pakenham VIC 3810',
    phoneDisplay: '0435 494 108',
    phoneUrl: 'tel:+61435494108',
    email: 'admin@eliteautobody.com.au',
    emailUrl: 'mailto:admin@eliteautobody.com.au',
    websiteUrl: 'https://eliteautobody.com.au/',
    instagramUrl: 'https://www.instagram.com/eliteautobodyvic/',
  },
  {
    id: 'kng-tow',
    category: 'Towing & Transport',
    businessName: 'KNG TOW',
    summary: 'Vehicle towing and transport for prestige, trade, machinery and breakdown work.',
    phoneDisplay: '0438 888 575',
    phoneUrl: 'tel:+61438888575',
    email: 'kngtowhaulage@gmail.com',
    emailUrl: 'mailto:kngtowhaulage@gmail.com',
    instagramUrl: 'https://www.instagram.com/kng_tow_haulage/',
  },
  {
    id: 'raceline',
    category: 'Motorsport Apparel',
    businessName: 'Raceline Motorsport Racewear',
    summary: 'Motorsport and karting racewear, helmets, safety equipment and custom race suits.',
    phoneDisplay: '0428 887 223',
    phoneUrl: 'tel:+61428887223',
    email: 'sales@raceline-racewear.com.au',
    emailUrl: 'mailto:sales@raceline-racewear.com.au',
    websiteUrl: 'https://raceline-racewear.com.au/',
    instagramUrl: 'https://www.instagram.com/racelinemr/',
  },
  {
    id: 'eye-candy',
    category: 'Vinyl Wrapping & PPF',
    businessName: 'EyeCandy Motorsports Melbourne',
    summary: 'Colour-change vinyl, paint protection film, blackouts and custom vehicle graphics.',
    address: '5 Colemans Road, Carrum Downs VIC 3201',
    phoneDisplay: '0414 544 317',
    phoneUrl: 'tel:+61414544317',
    websiteUrl: 'https://eyecandymotorsports.com.au/',
    instagramUrl: 'https://www.instagram.com/eyecandymotorsportsmelbourne/',
  },
  {
    id: 'luxe-interiors',
    category: 'Upholstery & Interior Work',
    businessName: 'Luxe Automotive Interiors',
    summary: 'Custom automotive upholstery, trims, roof liners, interior blackouts and carpets.',
    address: '4/20 Colemans Road, Carrum Downs VIC 3201',
    phoneDisplay: '0428 674 081',
    phoneUrl: 'tel:+61428674081',
    email: 'automotiveaesthetic@outlook.com',
    emailUrl: 'mailto:automotiveaesthetic@outlook.com',
    instagramUrl: 'https://www.instagram.com/luxeautomotiveinteriors/',
  },
  {
    id: 'elite-detailing',
    category: 'Detailing & Ceramic Coating',
    businessName: 'Elite Car Detailing Studio',
    summary: 'Paint correction, ceramic coating, new-vehicle protection and detailing.',
    address: '10 Arrow Court, Pakenham VIC 3810',
    phoneDisplay: '0411 758 482',
    phoneUrl: 'tel:+61411758482',
    email: 'info@elitemcd.com.au',
    emailUrl: 'mailto:info@elitemcd.com.au',
    websiteUrl: 'https://www.elitedetailingstudio.com.au/',
    instagramUrl: 'https://www.instagram.com/elitecardetailingstudio_/',
  },
];

export const TRUSTED_PARTNERS: readonly TrustedPartner[] = [...PARTNERS].sort(
  (left, right) => left.category.length - right.category.length || left.category.localeCompare(right.category),
);
