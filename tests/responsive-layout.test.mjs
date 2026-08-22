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
    tabsLayout,
    home,
    garage,
    bookings,
    alerts,
    booking,
    account,
    signUp,
    parts,
  ] = await Promise.all([
    read("../mobile/app.json"),
    read("../mobile/src/hooks/use-responsive-layout.ts"),
    read("../mobile/src/app/(tabs)/_layout.tsx"),
    read("../mobile/src/app/(tabs)/index.tsx"),
    read("../mobile/src/app/(tabs)/garage.tsx"),
    read("../mobile/src/app/(tabs)/bookings.tsx"),
    read("../mobile/src/app/(tabs)/alerts.tsx"),
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

  assert.deepEqual(
    [...tabsLayout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/gu)].map((match) => match[1]),
    ["index", "garage", "bookings", "alerts"],
  );

  for (const screen of [home, garage, bookings, alerts]) {
    assert.match(screen, /useResponsiveLayout/);
    assert.match(screen, /edges=\{\['top', 'right', 'left'\]\}/);
  }

  for (const screen of [booking, account, signUp, parts]) {
    assert.match(screen, /useResponsiveLayout/);
    assert.match(screen, /edges=\{\['top', 'right', 'bottom', 'left'\]\}/);
  }

  assert.doesNotMatch(home, /oneColumn/);
  assert.match(home, /tileGrid: \{[^}]*gap: spacing\.xs/);
  assert.match(home, /tileCell: \{[^}]*flexGrow: 0[^}]*minWidth: 0/);
  assert.match(home, /threeColumns = tablet && width >= 780 && !largeText/);
  assert.match(home, /compact && styles\.compactFrame/);
  assert.match(garage, /tablet && !largeText/);
  assert.match(booking, /COMPACT_STEP_LABELS/);
  assert.match(booking, /numberOfLines=\{2\}/);
  assert.match(booking, /tuningOptionScroll:\s*\{\s*flexShrink:\s*1,\s*minHeight:\s*0\s*\}/);
  assert.match(booking, /depositTotalStacked:\s*\{[^}]*flexDirection:\s*'column'/);
  assert.match(booking, /stackDeposit\s*=\s*stackSummary\s*\|\|\s*width\s*<\s*480/);
  assert.match(booking, /minimumFontScale=\{0\.75\}/);
  assert.match(booking, /depositValue:\s*\{[^}]*flexShrink:\s*1/);
  assert.match(booking, /depositCopyStacked:\s*\{[^}]*flex:\s*0[^}]*width:\s*'100%'/);
  assert.match(garage, /dynoImageFrame:\s*\{[^}]*aspectRatio:\s*1\.1/);
  assert.match(garage, /accessibilityLabel="Illustrated diagnostic scan tool[\s\S]*?resizeMode="contain"[\s\S]*?styles\.reportImage/);
  assert.match(garage, /reportImage:\s*\{[\s\S]*?scale:\s*1\.36[\s\S]*?transformOrigin:\s*'top center'/);
  assert.match(parts, /stackAreaCards\s*=\s*compact\s*\|\|\s*largeText/);
  assert.match(parts, /!stackAreaCards\s*&&\s*styles\.areaCardTwoColumn/);
  assert.match(parts, /areaCard:\s*\{[^}]*minHeight:\s*132/);
});
