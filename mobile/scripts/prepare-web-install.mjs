import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, '..');
const repositoryDirectory = resolve(mobileDirectory, '..');
const distDirectory = join(mobileDirectory, 'dist');

const rawBasePath = process.env.WEB_APP_BASE_PATH ?? process.env.GITHUB_PAGES_BASE_PATH ?? '';
const basePathSegments = rawBasePath.split('/').filter(Boolean);
const basePath = basePathSegments.length ? `/${basePathSegments.join('/')}` : '';
const iconVersion = createHash('sha256')
  .update(await readFile(join(repositoryDirectory, 'public', 'psi-icon-512.png')))
  .digest('hex')
  .slice(0, 12);
const assetUrl = (fileName) => `${basePath}/${fileName}?v=${iconVersion}`;

const installHead = `<!-- PSI_INSTALL_METADATA_START -->
<meta name="theme-color" content="#050505" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<meta name="apple-mobile-web-app-title" content="PSI Performance" />
<link rel="apple-touch-icon" sizes="192x192" href="${assetUrl('psi-icon-192.png')}" />
<link rel="icon" type="image/png" sizes="192x192" href="${assetUrl('psi-icon-192.png')}" />
<link rel="icon" type="image/png" sizes="512x512" href="${assetUrl('psi-icon-512.png')}" />
<link rel="manifest" href="${assetUrl('manifest.webmanifest')}" />
<!-- PSI_INSTALL_METADATA_END -->`;

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listHtmlFiles(path) : path.endsWith('.html') ? [path] : [];
    }),
  );

  return files.flat();
}

await mkdir(distDirectory, { recursive: true });

for (const fileName of ['psi-icon-192.png', 'psi-icon-512.png', 'psi-favicon.png']) {
  await copyFile(join(repositoryDirectory, 'public', fileName), join(distDirectory, fileName));
}

const manifest = {
  id: `${basePath}/`,
  name: 'PSI Performance',
  short_name: 'PSI',
  description: 'PSI Performance customer app.',
  start_url: `${basePath}/`,
  scope: `${basePath}/`,
  display: 'standalone',
  background_color: '#050505',
  theme_color: '#050505',
  orientation: 'any',
  icons: [
    { src: assetUrl('psi-icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: assetUrl('psi-icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: assetUrl('psi-icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

await writeFile(
  join(distDirectory, 'manifest.webmanifest'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

const existingMetadata = /<!-- PSI_INSTALL_METADATA_START -->[\s\S]*?<!-- PSI_INSTALL_METADATA_END -->/g;
for (const htmlPath of await listHtmlFiles(distDirectory)) {
  const html = await readFile(htmlPath, 'utf8');
  const cleanHtml = html.replace(existingMetadata, '');
  if (!cleanHtml.includes('</head>')) {
    throw new Error(`Cannot add install metadata because </head> is missing from ${htmlPath}`);
  }
  await writeFile(htmlPath, cleanHtml.replace('</head>', `${installHead}\n</head>`), 'utf8');
}

console.log(`Prepared permanent PSI install metadata for ${basePath || 'site root'}/`);
