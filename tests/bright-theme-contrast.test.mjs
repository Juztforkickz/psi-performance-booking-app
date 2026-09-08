import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("home weather and workshop details follow the active theme", async () => {
  const home = await read("../mobile/src/app/(tabs)/index.tsx");

  assert.match(home, /Ionicons color=\{theme\.accent\} name=\{weather\.current\.icon\}/u);
  assert.match(home, /styles\.logo, compact && styles\.logoCompact, \{ tintColor: theme\.text \}/u);
  assert.doesNotMatch(home, /logoBright/u);
  assert.match(home, /styles\.homeWeatherTemp, \{ color: theme\.text \}/u);
  assert.match(home, /styles\.homeWeatherDate, \{ color: theme\.textMuted \}/u);
  assert.match(home, /styles\.homeWeatherError, \{ color: theme\.textMuted \}/u);
  assert.match(home, /styles\.workshopFactValue, \{ color: theme\.text \}/u);
  assert.doesNotMatch(home, /styles\.workshopFactValue, \{ color: colors\.white \}/u);
});
