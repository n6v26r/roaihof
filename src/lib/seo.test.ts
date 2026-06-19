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
    expect(paths).toContain('/scoreboards/onia-2026-nationala-full');
    expect(paths).toContain(`/people/${dataset.people[0].id}`);
    expect(paths).toContain(`/schools/${dataset.schools[0].id}`);
    expect(paths).toContain(`/counties/${dataset.counties[0].id}`);
  });
});
