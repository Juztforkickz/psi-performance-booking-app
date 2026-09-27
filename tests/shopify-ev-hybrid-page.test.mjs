import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("EV and Hybrid Shopify page is self contained and responsive", async () => {
  const liquid = await read("shopify/psi-ev-hybrid-page.liquid");
  const schemaMatch = liquid.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/u);

  assert.ok(schemaMatch, "section schema is present");
  const schema = JSON.parse(schemaMatch[1]);
  assert.equal(schema.name, "PSI EV and Hybrid");
  assert.deepEqual(schema.presets, [{ name: "PSI EV and Hybrid" }]);

  assert.match(liquid, /Modern cars\.[\s\S]*Modern care\.[\s\S]*Same PSI\./u);
  assert.match(liquid, /ev-byd-porsche-workshop-v4\.png/u);
  assert.match(liquid, /ev-charging-tesla-v2\.png/u);
  assert.match(liquid, /@media\(max-width:980px\)/u);
  assert.match(liquid, /@media\(max-width:620px\)/u);
  assert.doesNotMatch(liquid, /\.psi-ev__power:after/u);
  assert.doesNotMatch(liquid, /powertrain on|power-grid[^}]+selected/iu);
});

test("EV and Hybrid page template points only to the new section", async () => {
  const template = JSON.parse(await read("shopify/page.psi-ev-hybrid.json"));
  assert.equal(template.sections.psi_ev_hybrid.type, "psi-ev-hybrid-page");
  assert.deepEqual(template.order, ["psi_ev_hybrid"]);
});

test("EV and Hybrid Shopify image assets are present", async () => {
  for (const path of [
    "shopify/assets/ev-byd-porsche-workshop-v4.png",
    "shopify/assets/ev-charging-tesla-v2.png",
  ]) {
    const details = await stat(new URL(`../${path}`, import.meta.url));
    assert.ok(details.size > 100_000, `${path} contains a production image`);
  }
});
