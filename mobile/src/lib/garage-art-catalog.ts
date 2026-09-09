export type GarageArtEntry = {
  id: string;
  make: string;
  model: string;
  generation: string;
  aliases: string;
};

// IDs are saved per vehicle. Preserve existing IDs when improving display names.
export const GARAGE_ART_CATALOG: GarageArtEntry[] = [
  { id: 'porsche', make: 'Porsche', model: '911 GT3', generation: '992', aliases: '911 coupe' },
  { id: 'hsv-gts', make: 'Holden / HSV', model: 'HSV GTS', generation: 'Gen-F2 · VF', aliases: 'holden commodore hsv vf vf2 gts gen f genf' },
  { id: 'holden-commodore-vf', make: 'Holden / HSV', model: 'Commodore SS V', generation: 'VF · Redline', aliases: 'holden commodore vf vf2 ss ssv sedan redline' },
  { id: 'hsv-vs-gts', make: 'Holden / HSV', model: 'HSV GTS', generation: 'VS', aliases: 'holden commodore hsv vs gts 1995 1996 1997' },
  { id: 'hsv-gts-ve', make: 'Holden / HSV', model: 'HSV GTS', generation: 'VE', aliases: 'holden commodore hsv ve gts e series sedan' },
  { id: 'hsv-clubsport-vt', make: 'Holden / HSV', model: 'HSV Clubsport', generation: 'VT', aliases: 'holden commodore hsv vt clubsport club sport r8 sedan' },
  { id: 'hsv-senator-vt', make: 'Holden / HSV', model: 'HSV Senator', generation: 'VT', aliases: 'holden commodore hsv vt senator signature sedan' },
  { id: 'hsv-senator-vz', make: 'Holden / HSV', model: 'HSV Senator', generation: 'VZ', aliases: 'holden commodore hsv vz senator signature sedan' },
  { id: 'hsv-tourer-vf', make: 'Holden / HSV', model: 'HSV Tourer', generation: 'Gen-F · VF', aliases: 'holden commodore hsv vf vf2 genf gen f lsa tourer wagon sportwagon' },
  { id: 'holden-torana', make: 'Holden / HSV', model: 'Torana A9X', generation: 'LX · Hatch', aliases: 'holden torana lx a9x' },
  { id: 'holden-monaro', make: 'Holden / HSV', model: 'Monaro CV8', generation: 'V2', aliases: 'holden monaro cv8 coupe v2' },
  { id: 'holden-commodore-vn-ss', make: 'Holden / HSV', model: 'Commodore SS', generation: 'VN', aliases: 'holden commodore vn ss sedan 1989 1990 1991' },
  { id: 'holden-commodore-ve', make: 'Holden / HSV', model: 'Commodore SS', generation: 'VE', aliases: 'holden commodore ve ss sedan' },
  { id: 'holden-commodore-vy', make: 'Holden / HSV', model: 'Commodore SS', generation: 'VY', aliases: 'holden commodore vy ss sedan' },
  { id: 'holden-commodore-vz-ss', make: 'Holden / HSV', model: 'Commodore SS', generation: 'VZ', aliases: 'holden commodore vz ss sedan' },
  { id: 'holden-commodore-vx', make: 'Holden / HSV', model: 'Commodore', generation: 'VX', aliases: 'holden commodore vx ss sedan' },
  { id: 'holden-commodore-vf-storm', make: 'Holden / HSV', model: 'Commodore Storm', generation: 'VF', aliases: 'holden commodore vf storm sedan sv6 ss' },
  { id: 'holden-commodore-ve-ssv-wagon', make: 'Holden / HSV', model: 'Commodore SS V Sportwagon', generation: 'VE', aliases: 'holden commodore ve ssv ss v sportwagon wagon van' },
  { id: 'holden-calais-vy', make: 'Holden / HSV', model: 'Calais', generation: 'VY', aliases: 'holden commodore calais vy sedan' },
  { id: 'holden-calais-vf', make: 'Holden / HSV', model: 'Calais V', generation: 'VF', aliases: 'holden commodore calais vf sedan' },
  { id: 'holden-calais-vz', make: 'Holden / HSV', model: 'Calais', generation: 'VZ', aliases: 'holden commodore calais vz sedan' },
  { id: 'hsv-clubsport-vz', make: 'Holden / HSV', model: 'HSV Clubsport', generation: 'VZ · 2005', aliases: 'holden hsv clubsport club sport r8 vz 2005' },
  { id: 'holden-ute-ve', make: 'Holden / HSV', model: 'SS Ute', generation: 'VE', aliases: 'holden commodore ute utility ve ss' },
  { id: 'holden-ute-vz', make: 'Holden / HSV', model: 'SS Ute', generation: 'VZ', aliases: 'holden commodore ute utility vz ss' },
  { id: 'holden-ute-vu', make: 'Holden / HSV', model: 'SS Ute', generation: 'VU', aliases: 'holden commodore ute utility vu ss' },
  { id: 'hsv-maloo-vf', make: 'Holden / HSV', model: 'HSV Maloo R8', generation: 'Gen-F · VF', aliases: 'holden hsv maloo r8 ute utility genf gen f vf' },
  { id: 'hsv-grange-wk', make: 'Holden / HSV', model: 'HSV Grange', generation: 'WK', aliases: 'holden hsv grange statesman wk' },
  { id: 'holden-caprice-wm', make: 'Holden / HSV', model: 'Caprice', generation: 'WM', aliases: 'holden caprice statesman wm' },
  { id: 'hsv-gto-vz', make: 'Holden / HSV', model: 'HSV GTO Coupe', generation: 'VZ', aliases: 'holden monaro hsv gto coupe vz' },
  { id: 'ford-fpv', make: 'Ford / FPV', model: 'FPV GT-F 351', generation: 'FG', aliases: 'ford falcon fpv fg gtf gt f 351 boss' },
  { id: 'ford-mustang', make: 'Ford / FPV', model: 'Mustang GT', generation: 'S550', aliases: 'ford mustang gt fastback s550' },
  { id: 'ford-escort', make: 'Ford / FPV', model: 'Escort RS2000', generation: 'Mk2', aliases: 'ford escort rs2000 mk2 mark 2' },
  { id: 'hyundai-veloster', make: 'Hyundai', model: 'Veloster Turbo', generation: 'FS', aliases: 'hyundai veloster turbo fs hatch' },
  { id: 'hyundai-i30n', make: 'Hyundai', model: 'i30 N', generation: 'PD · Hatch', aliases: 'hyundai i30n i30 n pd hatchback' },
  { id: 'toyota-supra', make: 'Toyota', model: 'Supra', generation: 'A80 · Mk4', aliases: 'toyota supra a80 jza80 mk4 mark 4' },
  { id: 'mclaren', make: 'McLaren', model: '720S', generation: 'Super Series', aliases: 'mclaren 720s coupe' },
  { id: 'nissan-skyline', make: 'Nissan', model: 'Skyline GT-R', generation: 'R34', aliases: 'nissan skyline gtr gt r r34 bnr34' },
  { id: 'nissan-370z-z34', make: 'Nissan', model: '370Z', generation: 'Z34', aliases: 'nissan 370z 370 z z34 coupe fairlady' },
  { id: 'honda-nsx', make: 'Honda', model: 'NSX', generation: 'NA1', aliases: 'honda acura nsx na1' },
  { id: 'subaru-wrx', make: 'Subaru', model: 'WRX STI', generation: 'GD · 2005', aliases: 'subaru impreza wrx sti gd blobeye' },
  { id: 'chevrolet-impala', make: 'Chevrolet', model: 'Impala', generation: '1964', aliases: 'chevrolet chevy impala 1964 64' },
  { id: 'chevrolet-bel-air-1955', make: 'Chevrolet', model: 'Bel Air', generation: '1955', aliases: 'chevrolet chevy belair bel air 1955 55' },
  { id: 'corvette', make: 'Chevrolet', model: 'Corvette Z06', generation: 'C7', aliases: 'chevrolet chevy corvette c7 z06' },
  { id: 'chevrolet-corvette-c5', make: 'Chevrolet', model: 'Corvette', generation: 'C5', aliases: 'chevrolet chevy corvette c5 coupe' },
  { id: 'chevrolet-camaro', make: 'Chevrolet', model: 'Camaro ZL1', generation: 'Sixth generation', aliases: 'chevrolet chevy camaro zl1 gen6 gen 6' },
  { id: 'bmw-m3', make: 'BMW', model: 'M3', generation: 'E46', aliases: 'bmw m3 e46 coupe' },
  { id: 'mercedes-amg', make: 'Mercedes-Benz', model: 'AMG GT', generation: 'C190', aliases: 'mercedes benz amg gt c190 coupe' },
  { id: 'mercedes-amg-e63s-w213', make: 'Mercedes-Benz', model: 'AMG E63 S', generation: 'W213', aliases: 'mercedes benz amg e63 e63s e 63 s w213 sedan' },
  { id: 'mercedes-amg-c63s-c205', make: 'Mercedes-Benz', model: 'AMG C63 S Coupe', generation: 'C205', aliases: 'mercedes benz amg c63 c63s c 63 s c205 coupe' },
  { id: 'audi-rs', make: 'Audi', model: 'RS6 Avant', generation: 'C8', aliases: 'audi rs6 rs 6 c8 wagon avant' },
  { id: 'audi-s3', make: 'Audi', model: 'S3', generation: 'Performance Sedan', aliases: 'audi s3 sedan quattro' },
  { id: 'ram-1500-dt', make: 'RAM', model: '1500', generation: 'DT · 2022', aliases: 'ram dodge 1500 dt hemi crew cab pickup truck 2022' },
  { id: 'mitsubishi-evo', make: 'Mitsubishi', model: 'Lancer Evolution IX', generation: 'CT9A', aliases: 'mitsubishi lancer evo evolution 9 ix ct9a' },
  { id: 'mazda-rx7', make: 'Mazda', model: 'RX-7', generation: 'FD', aliases: 'mazda rx7 rx 7 fd fd3s' },
  { id: 'nissan-patrol-y62', make: 'Nissan', model: 'Patrol', generation: 'Y62 · Series 5', aliases: 'nissan patrol y62 series 5 v8 four wheel drive 4wd suv wagon' },
  { id: 'toyota-landcruiser-300', make: 'Toyota', model: 'LandCruiser', generation: '300 Series', aliases: 'toyota land cruiser landcruiser lc300 300 series four wheel drive 4wd suv wagon' },
  { id: 'audi-rsq3-f3', make: 'Audi', model: 'RS Q3', generation: 'F3', aliases: 'audi rsq3 rs q3 f3 quattro performance suv' },
  { id: 'tesla-model-y', make: 'Tesla', model: 'Model Y', generation: '2026 · Juniper', aliases: 'tesla model y juniper electric ev suv' },
  { id: 'toyota-rav4', make: 'Toyota', model: 'RAV4', generation: '2026 · GR Sport', aliases: 'toyota rav 4 rav4 gr sport hybrid phev suv' },
  { id: 'toyota-hilux', make: 'Toyota', model: 'HiLux', generation: '2026 · Double Cab', aliases: 'toyota hilux hi lux dual cab double cab ute pickup four wheel drive 4wd' },
  { id: 'toyota-prado-250', make: 'Toyota', model: 'LandCruiser Prado', generation: '250 Series', aliases: 'toyota land cruiser prado lc250 250 series four wheel drive 4wd suv wagon' },
  { id: 'ford-ranger', make: 'Ford / FPV', model: 'Ranger', generation: 'P703 · Double Cab', aliases: 'ford ranger p703 dual cab double cab ute pickup raptor wildtrak four wheel drive 4wd' },
  { id: 'byd-sealion-7', make: 'BYD', model: 'Sealion 7', generation: 'Electric SUV', aliases: 'byd sealion seal lion 7 electric ev suv' },
  { id: 'chery-tiggo-4-pro', make: 'Chery', model: 'Tiggo 4 Pro', generation: 'Compact SUV', aliases: 'chery tiggo4 tiggo 4 pro compact suv' },
  { id: 'geely-ex5', make: 'Geely', model: 'EX5', generation: 'Electric SUV', aliases: 'geely ex 5 ex5 electric ev suv' },
  { id: 'gwm-haval-jolion', make: 'GWM / Haval', model: 'Haval Jolion', generation: 'Compact SUV', aliases: 'gwm great wall haval jolion hybrid suv' },
  { id: 'zeekr-7x', make: 'Zeekr', model: '7X', generation: 'Electric SUV', aliases: 'zeekr 7x electric ev suv' },
  { id: 'ford-falcon-xc-sedan', make: 'Ford / FPV', model: 'Falcon', generation: 'XC · Sedan', aliases: 'ford falcon xc sedan four door 1976 1977 1978 1979 classic' },
  { id: 'ford-falcon-xc-coupe', make: 'Ford / FPV', model: 'Falcon Hardtop', generation: 'XC · Coupe', aliases: 'ford falcon xc coupe hardtop two door 1976 1977 1978 classic' },
  { id: 'nissan-qashqai-j12', make: 'Nissan', model: 'Qashqai', generation: 'J12', aliases: 'nissan qashqai cashkai j12 compact suv crossover' },
  { id: 'jeep-grand-cherokee-wk2', make: 'Jeep', model: 'Grand Cherokee', generation: 'WK2 · SRT / Trackhawk', aliases: 'jeep grand cherokee grandcherokee wk2 srt srt8 trackhawk hemi performance suv' },
];

export type GarageArtVehicle = { make: string; model: string; year?: number };
const words = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const searchable = (entry: GarageArtEntry) => words(`${entry.make} ${entry.model} ${entry.generation} ${entry.aliases}`);

export function garageArtLabel(entry: GarageArtEntry) {
  const make = entry.make === 'Holden / HSV' ? (entry.model.startsWith('HSV') ? '' : 'Holden')
    : entry.make === 'Ford / FPV' ? 'Ford' : entry.make;
  return `${make} ${entry.model}`.trim();
}

export function garageArtMakeForVehicle(vehicle?: GarageArtVehicle) {
  const make = words(vehicle?.make ?? '');
  if (['holden', 'hsv', 'holden special vehicles'].includes(make)) return 'Holden / HSV';
  if (['ford', 'fpv', 'ford performance vehicles'].includes(make)) return 'Ford / FPV';
  if (['mercedes', 'mercedes benz', 'mercedes amg'].includes(make)) return 'Mercedes-Benz';
  if (['ram', 'dodge', 'dodge ram'].includes(make)) return 'RAM';
  if (['gwm', 'haval', 'great wall', 'great wall motors'].includes(make)) return 'GWM / Haval';
  if (make === 'chevy') return 'Chevrolet';
  return GARAGE_ART_CATALOG.find(entry => words(entry.make) === make)?.make;
}

// Suggestions change ordering only. A customer always chooses their own artwork.
export function findGarageArtwork(query: string, make = '', vehicle?: GarageArtVehicle) {
  const tokens = words(query).split(' ').filter(Boolean);
  const vehicleMake = garageArtMakeForVehicle(vehicle);
  const modelTokens = words(vehicle?.model ?? '').split(' ').filter(token => token.length > 1);
  const score = (entry: GarageArtEntry) => {
    if (entry.make !== vehicleMake) return 0;
    const text = searchable(entry).split(' ');
    return 10 + modelTokens.filter(token => text.includes(token)).length * 3;
  };
  return GARAGE_ART_CATALOG.filter(entry => {
    if (make && entry.make !== make) return false;
    const terms = searchable(entry).split(' ');
    return tokens.every(token => terms.some(term => term.startsWith(token)));
  }).sort((a, b) => score(b) - score(a) || garageArtLabel(a).localeCompare(garageArtLabel(b)) || a.generation.localeCompare(b.generation));
}

export const GARAGE_ART_MAKES = [...new Set(GARAGE_ART_CATALOG.map(entry => entry.make))].sort();
