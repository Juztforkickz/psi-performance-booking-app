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

test('Trusted Partners is a public referral directory with eight shortest-first categories', async () => {
  const [partners, screen] = await Promise.all([
    read('../mobile/src/lib/trusted-partners.ts'),
    read('../mobile/src/app/trusted-partners.tsx'),
  ]);

  const categories = [
    'Auto Electrical',
    'Paint & Bodywork',
    'Window Tinting',
    'Motorsport Apparel',
    'Towing & Transport',
    'Vinyl Wrapping & PPF',
    'Upholstery & Interior Work',
    'Detailing & Ceramic Coating',
  ];
  for (const category of categories) assert.match(partners, new RegExp(`category: '${category}'`, 'u'));
  assert.equal((partners.match(/id: '/gu) ?? []).length, 8);
  assert.match(partners, /left\.category\.length - right\.category\.length/u);
  assert.match(screen, /Contact each partner directly/u);
  assert.match(screen, /referral—not a PSI booking, quote or warranty/u);
  assert.match(screen, /TRUSTED_PARTNERS\.map/u);
  assert.doesNotMatch(`${partners}\n${screen}`, /fetch|AsyncStorage|EXPO_PUBLIC_API_BASE_URL|supabase|upload/iu);
});
