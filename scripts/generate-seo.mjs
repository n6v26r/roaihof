import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = path.join(root, 'dist');
const indexPath = path.join(distDir, 'index.html');

async function main() {
  const baseHtml = await readFile(indexPath, 'utf8');
  const server = await createServer({
    root,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false }
  });

  try {
    const [{ dataset }, { buildIndexes }, { parseRoute }, seo] = await Promise.all([
      server.ssrLoadModule('/src/app/data.ts'),
      server.ssrLoadModule('/src/app/indexes.ts'),
      server.ssrLoadModule('/src/app/routes.ts'),
      server.ssrLoadModule('/src/lib/seo.ts')
    ]);

    const indexes = buildIndexes(dataset);
    const paths = seo.publicSeoPaths(indexes);

    for (const routePath of paths) {
      const route = parseRoute(routePath);
      const routeSeo = seo.seoForRoute(route, indexes, dataset, routePath);
      await writeRouteHtml(routePath, injectSeo(baseHtml, seo.renderSeoTags(routeSeo)));
    }

    const notFoundSeo = seo.seoForRoute({ name: 'not-found' }, indexes, dataset, '/404');
    await writeFile(path.join(distDir, '404.html'), injectSeo(baseHtml, seo.renderSeoTags(notFoundSeo)));
    await writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(paths, dataset.generatedAt, seo.absoluteUrl));
    await writeFile(path.join(distDir, 'robots.txt'), renderRobots(seo.SEO_ORIGIN));

    console.log(`Generated SEO assets for ${paths.length} routes.`);
  } finally {
    await server.close();
  }
}

function injectSeo(html, tags) {
  const stripped = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/i, '')
    .replace(/\s*<(?:meta|link)\b[^>]*data-roaihof-seo=(?:"true"|'true')[^>]*>\s*/gi, '\n')
    .replace(/\s*<script\b[^>]*data-roaihof-seo=(?:"true"|'true')[^>]*>[\s\S]*?<\/script>\s*/gi, '\n');

  if (!stripped.includes('</head>')) {
    throw new Error('Could not find </head> in built index.html');
  }

  return stripped.replace('</head>', `${indent(tags, '  ')}\n</head>`);
}

async function writeRouteHtml(routePath, html) {
  const normalized = normalizePath(routePath);
  const file = normalized === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, ...normalized.slice(1).split('/'), 'index.html');
  if (!file.startsWith(distDir)) {
    throw new Error(`Refusing to write outside dist: ${file}`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

function renderSitemap(paths, generatedAt, absoluteUrl) {
  const lastmod = isoDate(generatedAt);
  const urls = paths.map((routePath) => [
    '  <url>',
    `    <loc>${escapeXml(absoluteUrl(routePath))}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : '',
    '  </url>'
  ].filter(Boolean).join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    ''
  ].join('\n');
}

function renderRobots(origin) {
  return [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${origin}/sitemap.xml`,
    ''
  ].join('\n');
}

function normalizePath(value) {
  const normalized = `/${value.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized;
}

function indent(value, prefix) {
  return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function isoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
