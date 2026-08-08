import { describe, expect, it } from 'vitest';
import { dataset } from '../app/data';
import { buildIndexes } from '../app/indexes';
import { parseRoute } from '../app/routes';
import { publicSeoPaths, SEO_ORIGIN, seoForRoute } from './seo';

describe('seo metadata', () => {
  const indexes = buildIndexes(dataset);

  it('builds canonical metadata for entity routes', () => {
    const person = dataset.people[0];
    const seo = seoForRoute(parseRoute(`/people/${person.id}`), indexes, dataset);

    expect(seo.title).toBe(`${person.name} | Romanian AI Hall Of Fame`);
    expect(seo.url).toBe(`${SEO_ORIGIN}/people/${person.id}`);
    expect(seo.noindex).toBeUndefined();
  });

  it('canonicalizes old contest routes to scoreboard URLs', () => {
    const seo = seoForRoute(parseRoute('/contests/onia-2026-nationala'), indexes, dataset);

    expect(seo.path).toBe('/scoreboards/onia-2026-nationala-full');
    expect(seo.url).toBe(`${SEO_ORIGIN}/scoreboards/onia-2026-nationala-full`);
  });

  it('marks the dataset with structured data license and creator fields', () => {
    const seo = seoForRoute(parseRoute('/'), indexes, dataset);
    const datasetJsonLd = seo.jsonLd.find((value) => value['@type'] === 'Dataset');

    expect(datasetJsonLd).toMatchObject({
      license: 'https://unlicense.org/',
      creator: {
        '@type': 'Organization',
        name: 'Romanian AI Hall Of Fame',
        url: `${SEO_ORIGIN}/`
      }
    });
  });

  it('marks missing dataset routes as noindex', () => {
    const seo = seoForRoute(parseRoute('/people/missing-person'), indexes, dataset, '/people/missing-person');

    expect(seo.noindex).toBe(true);
    expect(seo.url).toBe(`${SEO_ORIGIN}/people/missing-person`);
  });

  it('includes generated public routes for sitemap output', () => {
    const paths = publicSeoPaths(indexes);

    expect(paths).toContain('/');
    expect(paths).toContain('/rankings/people');
    expect(paths).toContain('/contests/ceoai');
    expect(paths).toContain('/contests/ioai');
    expect(paths).toContain('/scoreboards/ceoai-2026-global');
    expect(paths).toContain('/scoreboards/ioai-2026-individual');
    expect(paths).toContain('/scoreboards/onia-2026-nationala-full');
    expect(paths).toContain(`/people/${dataset.people[0].id}`);
    expect(paths).toContain(`/schools/${dataset.schools[0].id}`);
    expect(paths).toContain(`/counties/${dataset.counties[0].id}`);
  });

  it('builds canonical SEO metadata for CEOAI 2026 pages', () => {
    const familySeo = seoForRoute(parseRoute('/contests/ceoai'), indexes, dataset);
    const scoreboardSeo = seoForRoute(parseRoute('/scoreboards/ceoai-2026-global'), indexes, dataset);
    const familyItemList = familySeo.jsonLd.find((value) => value['@type'] === 'ItemList');
    const scoreboardItemList = scoreboardSeo.jsonLd.find((value) => value['@type'] === 'ItemList');

    expect(familySeo.title).toBe('CEOAI Results | Romanian AI Hall Of Fame');
    expect(familySeo.url).toBe(`${SEO_ORIGIN}/contests/ceoai`);
    expect(JSON.stringify(familyItemList)).toContain('CEOAI 2026 Global');

    expect(scoreboardSeo.title).toBe('CEOAI 2026 Global | Romanian AI Hall Of Fame');
    expect(scoreboardSeo.url).toBe(`${SEO_ORIGIN}/scoreboards/ceoai-2026-global`);
    expect(scoreboardSeo.description).toContain('Scoreboard for CEOAI 2026 Global');
    expect(JSON.stringify(scoreboardItemList)).toContain('Burloi Emil-Andrei');
  });

  it('builds canonical SEO metadata for IOAI 2026 pages', () => {
    const familySeo = seoForRoute(parseRoute('/contests/ioai'), indexes, dataset);
    const scoreboardSeo = seoForRoute(parseRoute('/scoreboards/ioai-2026-individual'), indexes, dataset);
    const familyItemList = familySeo.jsonLd.find((value) => value['@type'] === 'ItemList');
    const scoreboardItemList = scoreboardSeo.jsonLd.find((value) => value['@type'] === 'ItemList');

    expect(familySeo.title).toBe('IOAI Results | Romanian AI Hall Of Fame');
    expect(familySeo.url).toBe(`${SEO_ORIGIN}/contests/ioai`);
    expect(JSON.stringify(familyItemList)).toContain('IOAI 2026 Individual');

    expect(scoreboardSeo.title).toBe('IOAI 2026 Individual | Romanian AI Hall Of Fame');
    expect(scoreboardSeo.url).toBe(`${SEO_ORIGIN}/scoreboards/ioai-2026-individual`);
    expect(scoreboardSeo.description).toContain('Scoreboard for IOAI 2026 Individual');
    expect(JSON.stringify(scoreboardItemList)).toContain('Thury Burileanu Alexandru');
  });
});
