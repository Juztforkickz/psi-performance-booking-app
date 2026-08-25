import { createHash } from 'node:crypto';
import {
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

const distDirectory = resolve(process.argv[2] ?? 'dist');
const bundleDirectory = join(distDirectory, '_expo', 'static', 'js', 'web');
const entryBundles = readdirSync(bundleDirectory)
  .filter((name) => /^entry-.*\.js$/u.test(name));

if (entryBundles.length !== 1) {
  throw new Error(`Expected exactly one Expo web entry bundle in ${bundleDirectory}; found ${entryBundles.length}.`);
}

const currentName = entryBundles[0];
const currentPath = join(bundleDirectory, currentName);
const contentHash = createHash('sha256')
  .update(readFileSync(currentPath))
  .digest('hex')
  .slice(0, 32);
const cacheSafeName = `entry-${contentHash}.js`;
const cacheSafePath = join(bundleDirectory, cacheSafeName);

if (currentName !== cacheSafeName) {
  renameSync(currentPath, cacheSafePath);
}

const htmlFiles = findHtmlFiles(distDirectory);
let updatedReferences = 0;

for (const htmlFile of htmlFiles) {
  const currentHtml = readFileSync(htmlFile, 'utf8');
  const nextHtml = currentHtml.split(currentName).join(cacheSafeName);
  if (nextHtml !== currentHtml) {
    writeFileSync(htmlFile, nextHtml, 'utf8');
    updatedReferences += 1;
  }
}

const missingReferences = htmlFiles.filter((htmlFile) => (
  !readFileSync(htmlFile, 'utf8').includes(cacheSafeName)
));

if (missingReferences.length > 0) {
  throw new Error(`Cache-safe bundle reference is missing from ${missingReferences.length} exported HTML file(s).`);
}

console.log(`Cache-safe Expo bundle: ${basename(cacheSafePath)}`);
console.log(`Verified ${htmlFiles.length} HTML routes; updated ${updatedReferences}.`);

function findHtmlFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      files.push(...findHtmlFiles(entryPath));
    } else if (entry.endsWith('.html')) {
      files.push(entryPath);
    }
  }
  return files;
}
