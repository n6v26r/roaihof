import type { Indexes } from '../app/indexes';
import type { Route } from '../app/routes';
import type { Scoreboard } from '../features/scoreboards/scoreboards';
import type { Dataset, RankingKind, RankingRow, Result } from './types';

const DEFAULT_SEO_ORIGIN = 'https://roaihof.vercel.app';
const SOCIAL_IMAGE_PATH = '/og.png';

export const SEO_ORIGIN = normalizeOrigin(import.meta.env.VITE_SEO_ORIGIN || DEFAULT_SEO_ORIGIN);

const SITE_NAME = 'Romanian AI Hall Of Fame';
const SITE_SHORT_NAME = 'ROAIHOF';
const HOME_TITLE = `${SITE_NAME} | ${SITE_SHORT_NAME}`;
const HOME_DESCRIPTION = 'Search Romanian AI olympiad results, rankings, scoreboards, contestants, schools, and counties across ONIA, ROAI, IAIO, IOAI, and CEOAI.';
const MANAGED_HEAD_ATTR = 'data-roaihof-seo';
const ITEM_LIST_LIMIT = 50;

type JsonLdScalar = string | number | boolean | null;
type JsonLdValue = JsonLdScalar | JsonLdObject | JsonLdValue[];
type JsonLdObject = { [key: string]: JsonLdValue | undefined };

type SeoHeadTag =
  | { tag: 'meta'; name: string; content: string }
  | { tag: 'meta'; property: string; content: string }
  | { tag: 'link'; rel: string; href: string }
  | { tag: 'script'; type: 'application/ld+json'; text: string };

export interface SeoMetadata {
  title: string;
  description: string;
  path: string;
  url: string;
  imageUrl: string;
  socialType: 'website' | 'profile';
  noindex?: boolean;
  jsonLd: JsonLdObject[];
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function seoForRoute(route: Route, indexes: Indexes, data: Dataset, currentPath?: string): SeoMetadata {
  switch (route.name) {
    case 'home':
      return metadata({
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        path: '/',
        jsonLd: [websiteJsonLd(), datasetJsonLd(data)]
      });

    case 'rankings':
      return rankingMetadata(route.kind, data);

    case 'person': {
      const person = indexes.people.get(route.id);
      if (!person) return notFoundMetadata(currentPath ?? `/people/${route.id}`);
      const path = `/people/${person.id}`;
      return metadata({
        title: `${person.name} | ${SITE_NAME}`,
        description: `${person.name}'s Romanian AI olympiad results, medals, selections, schools, counties, and scoreboards.`,
        path,
        socialType: 'profile',
        jsonLd: [
          breadcrumbJsonLd([{ name: 'People', path: '/rankings/people' }, { name: person.name, path }]),
          profileJsonLd(path, person.name, person.aliases)
        ]
      });
    }

    case 'school': {
      const school = indexes.schools.get(route.id);
      if (!school) return notFoundMetadata(currentPath ?? `/schools/${route.id}`);
      const path = `/schools/${school.id}`;
      return metadata({
        title: `${school.name} | ${SITE_NAME}`,
        description: `Romanian AI olympiad results and contestants for ${school.name}.`,
        path,
        jsonLd: [
          breadcrumbJsonLd([{ name: 'Schools', path: '/rankings/schools' }, { name: school.name, path }]),
          schoolJsonLd(path, school.name, school.county)
        ]
      });
    }

    case 'county': {
      const county = indexes.counties.get(route.id);
      if (!county) return notFoundMetadata(currentPath ?? `/counties/${route.id}`);
      const path = `/counties/${county.id}`;
      return metadata({
        title: `${county.name} | ${SITE_NAME}`,
        description: `Romanian AI olympiad results, schools, and contestants from ${county.name}.`,
        path,
        jsonLd: [
          breadcrumbJsonLd([{ name: 'Counties', path: '/rankings/counties' }, { name: county.name, path }]),
          placeJsonLd(path, county.name)
        ]
      });
    }

    case 'contest-family': {
      const path = `/contests/${route.family.toLowerCase()}`;
      const scoreboards = Array.from(indexes.scoreboards.values())
        .filter((scoreboard) => scoreboard.family === route.family)
        .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
      return metadata({
        title: `${route.family} Results | ${SITE_NAME}`,
        description: `Romanian ${route.family} AI contest scoreboards, rankings, sources, and participant results.`,
        path,
        jsonLd: [
          breadcrumbJsonLd([{ name: 'Contests', path: '/' }, { name: route.family, path }]),
          itemListJsonLd(`${route.family} scoreboards`, scoreboards.map((scoreboard, index) => ({
            position: index + 1,
            name: `${scoreboard.family} ${scoreboard.year} ${scoreboard.title}`,
            url: absoluteUrl(`/scoreboards/${scoreboard.id}`)
          })))
        ]
      });
    }

    case 'scoreboard': {
      const scoreboard = indexes.scoreboards.get(route.id);
      if (!scoreboard) return notFoundMetadata(currentPath ?? `/scoreboards/${route.id}`);
      return scoreboardMetadata(scoreboard);
    }

    case 'sources':
      return metadata({
        title: `Sources | ${SITE_NAME}`,
        description: 'Official source coverage and provenance for the Romanian AI Hall Of Fame dataset.',
        path: '/sources',
        jsonLd: [breadcrumbJsonLd([{ name: 'Sources', path: '/sources' }]), datasetJsonLd(data)]
      });

    case 'not-found':
      return notFoundMetadata(currentPath ?? '/not-found');
  }
}

export function publicSeoPaths(indexes: Indexes): string[] {
  const paths = new Set<string>([
    '/',
    '/rankings/people',
    '/rankings/schools',
    '/rankings/counties',
    '/sources',
    '/contests/onia',
    '/contests/roai',
    '/contests/iaio',
    '/contests/ioai',
    '/contests/ceoai'
  ]);

  for (const person of sortedById(indexes.people.values())) paths.add(`/people/${person.id}`);
  for (const school of sortedById(indexes.schools.values())) paths.add(`/schools/${school.id}`);
  for (const county of sortedById(indexes.counties.values())) paths.add(`/counties/${county.id}`);
  for (const scoreboard of sortedById(indexes.scoreboards.values())) paths.add(`/scoreboards/${scoreboard.id}`);

  return Array.from(paths);
}

export function absoluteUrl(path: string): string {
  return `${SEO_ORIGIN}${normalizePath(path)}`;
}

export function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] || '/';
  const normalized = `/${withoutQuery.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized;
}

export function renderSeoTags(seo: SeoMetadata): string {
  return [
    `<title>${escapeHtml(seo.title)}</title>`,
    ...headTagsForSeo(seo).map(renderHeadTag)
  ].join('\n');
}

export function applySeoMetadata(seo: SeoMetadata): void {
  if (typeof document === 'undefined') return;

  document.title = seo.title;
  document.head.querySelectorAll(`[${MANAGED_HEAD_ATTR}="true"]`).forEach((node) => node.remove());

  for (const tag of headTagsForSeo(seo)) {
    if (tag.tag === 'meta') {
      const element = document.createElement('meta');
      if ('name' in tag) element.name = tag.name;
      if ('property' in tag) element.setAttribute('property', tag.property);
      element.content = tag.content;
      element.setAttribute(MANAGED_HEAD_ATTR, 'true');
      document.head.appendChild(element);
    } else if (tag.tag === 'link') {
      const element = document.createElement('link');
      element.rel = tag.rel;
      element.href = tag.href;
      element.setAttribute(MANAGED_HEAD_ATTR, 'true');
      document.head.appendChild(element);
    } else {
      const element = document.createElement('script');
      element.type = tag.type;
      element.textContent = tag.text;
      element.setAttribute(MANAGED_HEAD_ATTR, 'true');
      document.head.appendChild(element);
    }
  }
}

function rankingMetadata(kind: RankingKind, data: Dataset): SeoMetadata {
  const labels: Record<RankingKind, { title: string; description: string }> = {
    people: {
      title: `People Ranking | ${SITE_NAME}`,
      description: 'Ranking of Romanian AI olympiad contestants by medals, prizes, best places, selections, participation, and international results.'
    },
    schools: {
      title: `Schools Ranking | ${SITE_NAME}`,
      description: 'Ranking of schools represented in Romanian AI olympiad results across ONIA, ROAI, IAIO, IOAI, and CEOAI.'
    },
    counties: {
      title: `County Ranking | ${SITE_NAME}`,
      description: 'County-level ranking of Romanian AI olympiad results, contestants, selections, and medals.'
    }
  };
  const path = `/rankings/${kind}`;
  const rows = data.rankings[kind];
  return metadata({
    ...labels[kind],
    path,
    jsonLd: [
      breadcrumbJsonLd([{ name: labels[kind].title.replace(` | ${SITE_NAME}`, ''), path }]),
      itemListJsonLd(labels[kind].title, rankingItems(kind, rows))
    ]
  });
}

function scoreboardMetadata(scoreboard: Scoreboard): SeoMetadata {
  const path = `/scoreboards/${scoreboard.id}`;
  const name = `${scoreboard.family} ${scoreboard.year} ${scoreboard.title}`;
  return metadata({
    title: `${name} | ${SITE_NAME}`,
    description: `Scoreboard for ${name}, including placements, scores, medals, schools, counties, and official sources.`,
    path,
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Contests', path: '/' },
        { name: scoreboard.family, path: `/contests/${scoreboard.family.toLowerCase()}` },
        { name, path }
      ]),
      itemListJsonLd(`${name} scoreboard`, scoreboardItems(scoreboard.results))
    ]
  });
}

function metadata(input: Omit<SeoMetadata, 'url' | 'imageUrl' | 'socialType' | 'jsonLd'> & {
  socialType?: SeoMetadata['socialType'];
  jsonLd?: JsonLdObject[];
}): SeoMetadata {
  const path = normalizePath(input.path);
  return {
    title: input.title,
    description: input.description,
    path,
    url: absoluteUrl(path),
    imageUrl: absoluteUrl(SOCIAL_IMAGE_PATH),
    socialType: input.socialType ?? 'website',
    noindex: input.noindex,
    jsonLd: input.jsonLd ?? []
  };
}

function notFoundMetadata(path: string): SeoMetadata {
  return metadata({
    title: `Not Found | ${SITE_NAME}`,
    description: 'The requested ROAIHOF page is not available in the current dataset.',
    path,
    noindex: true
  });
}

function websiteJsonLd(): JsonLdObject {
  return withContext({
    '@type': 'WebSite',
    '@id': `${SEO_ORIGIN}/#website`,
    url: absoluteUrl('/'),
    name: SITE_NAME,
    alternateName: SITE_SHORT_NAME,
    description: HOME_DESCRIPTION
  });
}

function datasetJsonLd(data: Dataset): JsonLdObject {
  return withContext({
    '@type': 'Dataset',
    '@id': `${SEO_ORIGIN}/#dataset`,
    name: `${SITE_NAME} dataset`,
    description: HOME_DESCRIPTION,
    url: absoluteUrl('/'),
    dateModified: isoDate(data.generatedAt),
    keywords: data.summary.circuits.join(', ')
  });
}

function profileJsonLd(path: string, name: string, aliases?: string[]): JsonLdObject {
  const person: JsonLdObject = {
    '@type': 'Person',
    '@id': `${absoluteUrl(path)}#person`,
    name,
    url: absoluteUrl(path)
  };
  if (aliases?.length) person.alternateName = aliases;

  return withContext({
    '@type': 'ProfilePage',
    '@id': `${absoluteUrl(path)}#profile`,
    url: absoluteUrl(path),
    name,
    mainEntity: person
  });
}

function schoolJsonLd(path: string, name: string, county?: string): JsonLdObject {
  const school: JsonLdObject = {
    '@type': 'EducationalOrganization',
    '@id': `${absoluteUrl(path)}#school`,
    name,
    url: absoluteUrl(path)
  };
  if (county) {
    school.address = {
      '@type': 'PostalAddress',
      addressRegion: county,
      addressCountry: 'RO'
    };
  }
  return withContext(school);
}

function placeJsonLd(path: string, name: string): JsonLdObject {
  return withContext({
    '@type': 'AdministrativeArea',
    '@id': `${absoluteUrl(path)}#county`,
    name,
    url: absoluteUrl(path),
    containedInPlace: {
      '@type': 'Country',
      name: 'Romania'
    }
  });
}

function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  const allItems = [{ name: SITE_SHORT_NAME, path: '/' }, ...items];
  return withContext({
    '@type': 'BreadcrumbList',
    itemListElement: allItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  });
}

function itemListJsonLd(name: string, items: JsonLdObject[]): JsonLdObject {
  return withContext({
    '@type': 'ItemList',
    name,
    itemListElement: items.slice(0, ITEM_LIST_LIMIT)
  });
}

function rankingItems(kind: RankingKind, rows: RankingRow[]): JsonLdObject[] {
  return rows.map((row, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: row.name,
    url: absoluteUrl(entityPath(kind, row.id))
  }));
}

function scoreboardItems(results: Result[]): JsonLdObject[] {
  return results.map((result, index) => {
    const item: JsonLdObject = {
      '@type': 'ListItem',
      position: index + 1,
      name: result.personName
    };
    if (result.personId) item.url = absoluteUrl(`/people/${result.personId}`);
    return item;
  });
}

function withContext(value: JsonLdObject): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    ...value
  };
}

function headTagsForSeo(seo: SeoMetadata): SeoHeadTag[] {
  const tags: SeoHeadTag[] = [
    { tag: 'meta', name: 'description', content: seo.description },
    { tag: 'link', rel: 'canonical', href: seo.url },
    { tag: 'meta', property: 'og:type', content: seo.socialType },
    { tag: 'meta', property: 'og:site_name', content: SITE_NAME },
    { tag: 'meta', property: 'og:title', content: seo.title },
    { tag: 'meta', property: 'og:description', content: seo.description },
    { tag: 'meta', property: 'og:url', content: seo.url },
    { tag: 'meta', property: 'og:image', content: seo.imageUrl },
    { tag: 'meta', property: 'og:image:width', content: '1200' },
    { tag: 'meta', property: 'og:image:height', content: '630' },
    { tag: 'meta', name: 'twitter:card', content: 'summary_large_image' },
    { tag: 'meta', name: 'twitter:title', content: seo.title },
    { tag: 'meta', name: 'twitter:description', content: seo.description },
    { tag: 'meta', name: 'twitter:image', content: seo.imageUrl }
  ];
  if (seo.noindex) tags.unshift({ tag: 'meta', name: 'robots', content: 'noindex,follow' });
  for (const value of seo.jsonLd) {
    tags.push({
      tag: 'script',
      type: 'application/ld+json',
      text: JSON.stringify(value)
    });
  }
  return tags;
}

function renderHeadTag(tag: SeoHeadTag): string {
  if (tag.tag === 'meta') {
    const key = 'name' in tag ? 'name' : 'property';
    const keyValue = 'name' in tag ? tag.name : tag.property;
    return `<meta ${key}="${escapeAttribute(keyValue)}" content="${escapeAttribute(tag.content)}" ${MANAGED_HEAD_ATTR}="true" />`;
  }
  if (tag.tag === 'link') {
    return `<link rel="${escapeAttribute(tag.rel)}" href="${escapeAttribute(tag.href)}" ${MANAGED_HEAD_ATTR}="true" />`;
  }
  return `<script type="${escapeAttribute(tag.type)}" ${MANAGED_HEAD_ATTR}="true">${escapeScript(tag.text)}</script>`;
}

function entityPath(kind: RankingKind, id: string): string {
  if (kind === 'people') return `/people/${id}`;
  if (kind === 'schools') return `/schools/${id}`;
  return `/counties/${id}`;
}

function sortedById<T extends { id: string }>(items: Iterable<T>): T[] {
  return Array.from(items).sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/g, '');
}

function isoDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeScript(value: string): string {
  return value.replace(/</g, '\\u003c');
}
