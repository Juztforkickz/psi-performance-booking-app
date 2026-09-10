import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Customer Cars for Sale stays opt-in and separates preview data from live listings', async () => {
  const [screen, listings, home] = await Promise.all([
    read('../mobile/src/app/customer-cars-for-sale.tsx'),
    read('../mobile/src/lib/customer-cars-for-sale.ts'),
    read('../mobile/src/app/(tabs)/index.tsx'),
  ]);

  assert.match(home, /label="Customer Cars for Sale"/u);
  assert.match(home, /tile-customer-cars-for-sale-blue-silver\.jpg/u);
  assert.match(screen, /A listing appears only after the owner gives permission/u);
  assert.match(screen, /Buyers should confirm the sale terms and arrange their own inspection/u);
  assert.match(screen, /Ask PSI to list my car/u);
  assert.match(screen, /Enquire through PSI/u);
  assert.match(screen, /Preview data only · this vehicle is not for sale/u);
  assert.match(listings, /CUSTOMER_CARS_FOR_SALE: readonly CustomerCarListing\[\] = \[\]/u);
  assert.match(listings, /PREVIEW_CUSTOMER_CARS_FOR_SALE/u);
  assert.doesNotMatch(listings, /customer_id|email|phone|storage|supabase/iu);
});
