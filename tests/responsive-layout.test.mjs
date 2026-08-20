import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("keeps the web and installed PWA at device scale without disabling zoom", async () => {
  const [layout, manifest, css] = await Promise.all([
    read("../app/layout.tsx"),
    read("../app/manifest.ts"),
    read("../app/globals.css"),
  ]);

  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /initialScale:\s*1/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.doesNotMatch(layout, /maximumScale|userScalable:\s*false/);
  assert.match(manifest, /orientation:\s*"any"/);
  assert.match(css, /text-size-adjust:\s*100%/);
  assert.match(css, /font-size:\s*max\(1rem, 16px\)/);
  assert.match(css, /--content-max:\s*1600px/);
  assert.match(css, /env\(safe-area-inset-left/);
  assert.doesNotMatch(css, /overflow-x:\s*hidden/);
});

test("keeps compact web booking controls usable without hidden overflow", async () => {
  const [css, adminCss] = await Promise.all([
    read("../app/globals.css"),
    read("../app/admin/admin.module.css"),
  ]);

  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /--calendar-mobile-width/);
  assert.match(css, /margin-inline:\s*calc\(\(100% - var\(--calendar-mobile-width\)\) \/ 2\)/);
  assert.match(css, /@media \(max-width:\s*360px\)/);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*?\.calendar-grid button\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(adminCss, /\.reference\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(adminCss, /@media \(max-width:\s*430px\)[\s\S]*?\.headerActions button\s*\{[\s\S]*?min-height:\s*44px/);
});

test("uses one native responsive contract across every customer screen", async () => {
  const [
    appConfig,
    hook,
    home,
    booking,
    account,
    signUp,
    parts,
  ] = await Promise.all([
    read("../mobile/app.json"),
    read("../mobile/src/hooks/use-responsive-layout.ts"),
    read("../mobile/src/app/index.tsx"),
    read("../mobile/src/app/booking.tsx"),
    read("../mobile/src/app/account/index.tsx"),
    read("../mobile/src/app/account/sign-up.tsx"),
    read("../mobile/src/app/parts.tsx"),
  ]);

  assert.match(appConfig, /"orientation":\s*"default"/);
  assert.match(appConfig, /"softwareKeyboardLayoutMode":\s*"resize"/);
  assert.match(hook, /useWindowDimensions\(\)/);
  assert.match(hook, /fontScale/);
  assert.match(hook, /shortLandscape/);

  for (const screen of [home, booking, account, signUp, parts]) {
    assert.match(screen, /useResponsiveLayout/);
    assert.match(screen, /edges=\{\['top', 'right', 'bottom', 'left'\]\}/);
  }

  assert.match(home, /stackQr = width < 440 \|\| fontScale > 1\.25/);
  assert.match(home, /accountButtonCompact/);
  assert.match(home, /sheetHeadingCopy/);
  assert.match(booking, /COMPACT_STEP_LABELS/);
  assert.match(booking, /numberOfLines=\{2\}/);
  assert.match(booking, /tuningOptionScroll:\s*\{\s*flexShrink:\s*1,\s*minHeight:\s*0\s*\}/);
  assert.match(booking, /depositTotalStacked:\s*\{[^}]*flexDirection:\s*'column'/);
});
