import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Home shortcuts expose every tile and persist only a device-local identifier list', async () => {
  const [home, preferences] = await Promise.all([
    read('../mobile/src/app/(tabs)/index.tsx'),
    read('../mobile/src/lib/home-shortcut-preferences.ts'),
  ]);

  for (const id of ['garage', 'bookings', 'book-ahead', 'alerts', 'dyno', 'reports', 'plan-build', 'trusted-partners']) {
    assert.match(preferences, new RegExp(`'${id}'`, 'u'));
  }
  assert.match(home, /Customise Home shortcuts/u);
  assert.match(home, /router\.push\('\/trusted-partners'\)/u);
  assert.match(preferences, /AsyncStorage\.setItem\(STORAGE_KEY, JSON\.stringify/u);
  assert.match(preferences, /current\.length === 1/u);
  assert.doesNotMatch(preferences, /fetch|EXPO_PUBLIC_API_BASE_URL|customer|booking draft|vehicleId/iu);
});

test('Trusted Partners is a public referral directory with ten approved shortest-first categories', async () => {
  const [partners, screen] = await Promise.all([
    read('../mobile/src/lib/trusted-partners.ts'),
    read('../mobile/src/app/trusted-partners.tsx'),
  ]);

  const categories = [
    'Auto Electrical',
    'Car Audio & Security',
    'Paint & Bodywork',
    'Window Tinting',
    'Towing & Transport',
    'Vinyl Wrapping & PPF',
    'Automotive Photography',
    'Upholstery & Interior Work',
    'Detailing & Ceramic Coating',
    'Performance Fluids & Lubricants',
  ];
  for (const category of categories) assert.match(partners, new RegExp(`category: '${category}'`, 'u'));
  assert.equal((partners.match(/id: '/gu) ?? []).length, 10);
  assert.doesNotMatch(partners, /raceline|Motorsport Apparel/iu);
  assert.match(partners, /left\.category\.length - right\.category\.length/u);
  assert.match(partners, /id: 'dark-side-film',[\s\S]*phoneDisplay: '0426 246 001',[\s\S]*phoneUrl: 'tel:\+61426246001'/u);
  assert.match(partners, /id: 'eye-candy',[\s\S]*phoneDisplay: '0414 544 317',[\s\S]*phoneUrl: 'tel:\+61414544317'/u);
  assert.match(partners, /id: 'trb-visuals',[\s\S]*phoneDisplay: '0493 530 347',[\s\S]*email: 'trbvisualsphotography@gmail\.com'/u);
  assert.match(partners, /id: 'martini-racing-products',[\s\S]*phoneDisplay: '03 9763 0977',[\s\S]*email: 'sales@martiniracing\.com\.au'/u);
  assert.match(partners, /id: 'fab-car-audio',[\s\S]*phoneDisplay: '0423 522 124',[\s\S]*email: 'sales@fabcaraudio\.com\.au'/u);
  assert.match(screen, /Contact partners directly/u);
  assert.match(screen, /Referrals are not PSI bookings or quotes/u);
  assert.match(screen, /trb-visuals\.jpg/u);
  assert.match(screen, /martini-racing-products\.jpg/u);
  assert.match(screen, /fab-car-audio\.jpg/u);
  assert.match(screen, /'martini-racing-products': 1\.38/u);
  assert.match(screen, /'fab-car-audio': 0\.9/u);
  assert.match(screen, /'fab-car-audio': colors\.white/u);
  assert.match(screen, /TRUSTED_PARTNERS\.map/u);
  assert.doesNotMatch(`${partners}\n${screen}`, /fetch|AsyncStorage|EXPO_PUBLIC_API_BASE_URL|supabase|upload/iu);
});
