import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const directory = path.dirname(fileURLToPath(import.meta.url));
export async function buildWebsiteFragment() {
  const files = {
    markup: ['website.fragment.html', 'utf8'],
    engine: ['engine.cjs', 'utf8'],
    view: ['website-view.js', 'utf8'],
    image: ['assets/boost-display.webp'],
    hero: ['assets/homepage-hero.webp'],
    logo: ['../../public/psi-logo.png'],
    font: ['../../public/ethnocentric.woff2'],
  };
  const entries = await Promise.all(Object.entries(files).map(async ([key, [name, encoding]]) => [key, await readFile(path.resolve(directory, name), encoding)]));
  const resources = Object.fromEntries(entries);
  new vm.Script(resources.engine); new vm.Script(resources.view);
  const fragment = resources.markup
    .replace('__PSI_FONT__', 'data:font/woff2;base64,' + resources.font.toString('base64'))
    .replace('__PSI_HERO__', 'data:image/webp;base64,' + resources.hero.toString('base64'))
    .replace('__PSI_LOGO__', 'data:image/png;base64,' + resources.logo.toString('base64'))
    .replace('__BOOST_PREVIEW_IMAGE__', 'data:image/webp;base64,' + resources.image.toString('base64'))
    .replace('/*__BOOST_ENGINE__*/', resources.engine.replaceAll('</script', '<\\/script'))
    .replace('/*__WEBSITE_VIEW__*/', resources.view.replaceAll('</script', '<\\/script'));
  if (Buffer.byteLength(fragment) >= 1_000_000) throw new Error('Website preview exceeds inline size limit.');
  if (/__(?:PSI|BOOST|WEBSITE)_[A-Z_]+__/.test(fragment)) throw new Error('Unresolved website preview placeholder.');
  return fragment;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = path.resolve(process.argv[2] || path.join(directory, '../../artifacts/boost-website-test/boost-website-placement.html'));
  await mkdir(path.dirname(destination), { recursive: true });
  const fragment = await buildWebsiteFragment();
  await writeFile(destination, fragment);
  console.log(JSON.stringify({ path: destination, bytes: Buffer.byteLength(fragment), liveWebsiteChanged: false }));
}
