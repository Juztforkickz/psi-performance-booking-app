import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Authenticator heading remains a complete single line on narrow screens', async () => {
  const screen = await read('../mobile/src/app/staff-security.tsx');

  assert.match(
    screen,
    /<Text adjustsFontSizeToFit minimumFontScale=\{0\.72\} numberOfLines=\{1\} style=\{styles\.title\}>Authenticators<\/Text>/u,
  );
  assert.match(screen, /title: \{[^}]*lineHeight: 44,[^}]*width: '100%'/u);
});
