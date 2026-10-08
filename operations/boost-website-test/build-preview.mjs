import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const directory = path.dirname(fileURLToPath(import.meta.url));
export async function buildFragment() {
  const [markup, engine, view, image] = await Promise.all([
    readFile(path.join(directory, 'preview.fragment.html'), 'utf8'),
    readFile(path.join(directory, 'engine.cjs'), 'utf8'),
    readFile(path.join(directory, 'view.js'), 'utf8'),
    readFile(path.resolve(directory, '../../mobile/assets/images/boost-assistant.png')),
  ]);
  new vm.Script(engine); new vm.Script(view);
  const fragment = markup.replace('__BOOST_IMAGE__', 'data:image/png;base64,' + image.toString('base64'))
    .replace('/*__BOOST_ENGINE__*/', engine.replaceAll('</script', '<\\/script'))
    .replace('/*__BOOST_VIEW__*/', view.replaceAll('</script', '<\\/script'));
  if (Buffer.byteLength(fragment) >= 1_000_000) throw new Error('Preview exceeds the inline size limit.');
  if (/__(BOOST_IMAGE)__|\/\*__BOOST_(ENGINE|VIEW)__\*\//.test(fragment)) throw new Error('Unresolved preview placeholder.');
  return fragment;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = path.resolve(process.argv[2] || path.join(directory, '../../artifacts/boost-website-test/boost-website-test.html'));
  await mkdir(path.dirname(destination), { recursive: true });
  const fragment = await buildFragment();
  await writeFile(destination, fragment);
  console.log(JSON.stringify({ path: destination, bytes: Buffer.byteLength(fragment), externalMessaging: false }));
}
