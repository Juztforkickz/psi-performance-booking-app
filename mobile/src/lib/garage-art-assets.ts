import type { ImageSourcePropType } from 'react-native';
import { GARAGE_ART_CATALOG, garageArtLabel } from '@/lib/garage-art-catalog';

// Static requires keep Metro's native/offline asset resolution intact.
const images: Record<string, { source: ImageSourcePropType; thumbnail: ImageSourcePropType }> = {
  'porsche': { source: require('../../assets/images/garage-vehicles/porsche.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/porsche.jpg') },
  'hsv-gts': { source: require('../../assets/images/garage-vehicles/hsv-gts.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hsv-gts.jpg') },
  'holden-commodore-vf': { source: require('../../assets/images/garage-vehicles/holden-commodore-vf.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-commodore-vf.jpg') },
  'hsv-vs-gts': { source: require('../../assets/images/garage-vehicles/hsv-vs-gts.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hsv-vs-gts.jpg') },
  'holden-torana': { source: require('../../assets/images/garage-vehicles/holden-torana.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-torana.jpg') },
  'holden-monaro': { source: require('../../assets/images/garage-vehicles/holden-monaro.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-monaro.jpg') },
  'holden-commodore-ve': { source: require('../../assets/images/garage-vehicles/holden-commodore-ve.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-commodore-ve.jpg') },
  'holden-commodore-vy': { source: require('../../assets/images/garage-vehicles/holden-commodore-vy.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-commodore-vy.jpg') },
  'holden-commodore-vx': { source: require('../../assets/images/garage-vehicles/holden-commodore-vx.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-commodore-vx.jpg') },
  'holden-calais-vf': { source: require('../../assets/images/garage-vehicles/holden-calais-vf.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-calais-vf.jpg') },
  'holden-calais-vz': { source: require('../../assets/images/garage-vehicles/holden-calais-vz.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-calais-vz.jpg') },
  'hsv-clubsport-vz': { source: require('../../assets/images/garage-vehicles/hsv-clubsport-vz.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hsv-clubsport-vz.jpg') },
  'holden-ute-ve': { source: require('../../assets/images/garage-vehicles/holden-ute-ve.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-ute-ve.jpg') },
  'holden-ute-vz': { source: require('../../assets/images/garage-vehicles/holden-ute-vz.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-ute-vz.jpg') },
  'holden-ute-vu': { source: require('../../assets/images/garage-vehicles/holden-ute-vu.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-ute-vu.jpg') },
  'hsv-maloo-vf': { source: require('../../assets/images/garage-vehicles/hsv-maloo-vf.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hsv-maloo-vf.jpg') },
  'hsv-grange-wk': { source: require('../../assets/images/garage-vehicles/hsv-grange-wk.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hsv-grange-wk.jpg') },
  'holden-caprice-wm': { source: require('../../assets/images/garage-vehicles/holden-caprice-wm.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/holden-caprice-wm.jpg') },
  'hsv-gto-vz': { source: require('../../assets/images/garage-vehicles/hsv-gto-vz.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hsv-gto-vz.jpg') },
  'ford-fpv': { source: require('../../assets/images/garage-vehicles/ford-fpv.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/ford-fpv.jpg') },
  'ford-mustang': { source: require('../../assets/images/garage-vehicles/ford-mustang.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/ford-mustang.jpg') },
  'ford-escort': { source: require('../../assets/images/garage-vehicles/ford-escort.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/ford-escort.jpg') },
  'hyundai-veloster': { source: require('../../assets/images/garage-vehicles/hyundai-veloster.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hyundai-veloster.jpg') },
  'hyundai-i30n': { source: require('../../assets/images/garage-vehicles/hyundai-i30n.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/hyundai-i30n.jpg') },
  'toyota-supra': { source: require('../../assets/images/garage-vehicles/toyota-supra.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/toyota-supra.jpg') },
  'mclaren': { source: require('../../assets/images/garage-vehicles/mclaren.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/mclaren.jpg') },
  'nissan-skyline': { source: require('../../assets/images/garage-vehicles/nissan-skyline.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/nissan-skyline.jpg') },
  'honda-nsx': { source: require('../../assets/images/garage-vehicles/honda-nsx.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/honda-nsx.jpg') },
  'subaru-wrx': { source: require('../../assets/images/garage-vehicles/subaru-wrx.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/subaru-wrx.jpg') },
  'chevrolet-impala': { source: require('../../assets/images/garage-vehicles/chevrolet-impala.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/chevrolet-impala.jpg') },
  'chevrolet-bel-air-1955': { source: require('../../assets/images/garage-vehicles/chevrolet-bel-air-1955.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/chevrolet-bel-air-1955.jpg') },
  'corvette': { source: require('../../assets/images/garage-vehicles/corvette.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/corvette.jpg') },
  'chevrolet-camaro': { source: require('../../assets/images/garage-vehicles/chevrolet-camaro.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/chevrolet-camaro.jpg') },
  'bmw-m3': { source: require('../../assets/images/garage-vehicles/bmw-m3.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/bmw-m3.jpg') },
  'mercedes-amg': { source: require('../../assets/images/garage-vehicles/mercedes-amg.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/mercedes-amg.jpg') },
  'audi-rs': { source: require('../../assets/images/garage-vehicles/audi-rs.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/audi-rs.jpg') },
  'mitsubishi-evo': { source: require('../../assets/images/garage-vehicles/mitsubishi-evo.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/mitsubishi-evo.jpg') },
  'mazda-rx7': { source: require('../../assets/images/garage-vehicles/mazda-rx7.jpg'), thumbnail: require('../../assets/images/garage-vehicles/thumbs/mazda-rx7.jpg') },
};

export const GARAGE_ART = GARAGE_ART_CATALOG.map(entry => ({ ...entry, label: garageArtLabel(entry), ...images[entry.id] }));
export const garageArtById = (id: string) => GARAGE_ART.find(entry => entry.id === id) ?? GARAGE_ART[0];
